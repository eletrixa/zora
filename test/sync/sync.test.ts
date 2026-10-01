/**
 * Catalogue sync: the full walk, resume, page size halving, the watermark, the delta and its budget,
 * a crashed delta, the full load start guard and the sync status.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/sync/sync.test.ts
 * Deps:    bun:test, src/sync/index.ts, src/sync/walk.ts, test/sync/harness.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it, spyOn } from "bun:test";
import type { OctoProduct } from "../../src/contracts/partner";
import { getSyncStatus, runDeltaSync, startFullSync } from "../../src/sync";
import { runWalk, type StepRunner } from "../../src/sync/walk";
import { FIXED_START } from "../fakes/clock";
import { makeEnv, makeWorld } from "../fakes/env";
import { FIXTURE_PRODUCTS } from "../fakes/fixtures";
import { partnerError } from "../fakes/partner";
import { harness, iso, queries, runRow, setWatermark, steps, TEN_MINUTES, watermark, type Harness } from "./harness";

function bulk(count: number): OctoProduct[] {
  const template = FIXTURE_PRODUCTS[0]!;
  return Array.from({ length: count }, (_, index) => ({ ...structuredClone(template), id: `bulk-${String(index).padStart(3, "0")}` }) as OctoProduct);
}

async function startedRun(h: Harness): Promise<string> {
  const summary = await startFullSync(h.world.deps, h.env);
  expect(summary.ok).toBe(true);
  const params = h.created.at(-1)?.params;
  const runId = params && "runId" in params ? params.runId : undefined;
  if (!runId) throw new Error("no workflow instance was created");
  return runId;
}

describe("full load", () => {
  it("walks 3 pages of 13 products and sets the watermark to the final page time minus 10 minutes", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    expect(h.created[0]).toEqual({ id: runId, params: { runId, pageSize: 5 } });

    const names: string[] = [];
    const results: unknown[] = [];
    const outcome = await runWalk(h.world.deps, runId, steps(h.world, names, results));

    expect(outcome.status).toBe("complete");
    expect(names.filter((name) => name.startsWith("page-"))).toEqual(["page-1", "page-2", "page-3"]);
    expect(queries(h.world)).toEqual([{ limit: 5 }, { limit: 5, cursor: "c:5" }, { limit: 5, cursor: "c:10" }]);
    const row = runRow(h.world, runId);
    expect(row).toMatchObject({ kind: "full", status: "complete", pages: 3, products: 13, cursor: null, errors: 0 });
    expect(row["finished_at"]).not.toBeNull();
    expect(watermark(h.world)).toBe(iso(FIXED_START + 3000 - TEN_MINUTES));
    // A step result stays small: never the products themselves.
    for (const result of results) expect(JSON.stringify(result)).not.toContain("products\":[");
    expect(Math.max(...results.map((result) => JSON.stringify(result).length))).toBeLessThan(500);
  });

  it("calls retireUnseen once, after the last page of a complete full load", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    await runWalk(h.world.deps, runId, steps(h.world));
    expect(h.retired).toEqual([runId]);
    expect(h.events).toEqual(["upsert", "upsert", "upsert", "retire"]);
  });

  it("resumes from the stored cursor after a crash on page 2, without counting a page twice", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    const upsert = h.world.catalogue.upsertProducts;
    let calls = 0;
    h.world.catalogue.upsertProducts = async (...args) => {
      if (++calls === 2) throw new Error("D1 went away");
      return upsert(...args);
    };

    await expect(runWalk(h.world.deps, runId, steps(h.world))).rejects.toThrow("D1 went away");
    expect(runRow(h.world, runId)).toMatchObject({ status: "running", pages: 1, products: 5, cursor: "c:5" });
    expect(watermark(h.world)).toBeNull();

    const outcome = await runWalk(h.world.deps, runId, steps(h.world));
    expect(outcome.status).toBe("complete");
    expect(queries(h.world).map((query) => query.cursor)).toEqual([undefined, "c:5", "c:5", "c:10"]);
    expect(runRow(h.world, runId)).toMatchObject({ status: "complete", pages: 3, products: 13 });
  });

  it("does not count a stored page again when its step is retried", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    // The step runs its work, then the result is lost, and the runtime retries the same step.
    let lost = false;
    const retrying: StepRunner = {
      async do(name, fn) {
        const result = await fn();
        if (name === "page-2" && !lost) {
          lost = true;
          return fn();
        }
        return result;
      },
    };
    const outcome = await runWalk(h.world.deps, runId, retrying);
    expect(outcome.status).toBe("complete");
    expect(queries(h.world)).toHaveLength(3);
    expect(runRow(h.world, runId)).toMatchObject({ pages: 3, products: 13 });
  });

  it("halves the page size after a timeout and restarts the walk from page 1", async () => {
    const h = harness("20", bulk(30));
    const runId = await startedRun(h);
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("TIMEOUT", "no answer in 30 s"));
        return runner.do(name, fn);
      },
    };
    const outcome = await runWalk(h.world.deps, runId, failing);

    expect(outcome.status).toBe("complete");
    expect(queries(h.world)).toEqual([
      { limit: 20 },
      { limit: 20, cursor: "c:20" },
      { limit: 10 },
      { limit: 10, cursor: "c:10" },
      { limit: 10, cursor: "c:20" },
    ]);
    const row = runRow(h.world, runId);
    expect(row).toMatchObject({ status: "complete", page_size: 10, pages: 3, products: 30, errors: 1 });
    expect(JSON.parse(String(row["error_log"]))).toMatchObject([{ code: "TIMEOUT", message: "no answer in 30 s" }]);
  });

  it("fails the run when a timeout arrives at the smallest page size", async () => {
    const h = harness("10", bulk(15));
    const runId = await startedRun(h);
    h.world.partner.failNext("products.list", partnerError("INTERNAL_SERVER_ERROR"));
    const outcome = await runWalk(h.world.deps, runId, steps(h.world));
    expect(outcome).toMatchObject({ status: "failed", code: "INTERNAL_SERVER_ERROR" });
    expect(runRow(h.world, runId)).toMatchObject({ status: "failed", page_size: 10 });
  });

  it("restarts the walk from page 1 at the same size after a cursor BAD_REQUEST on page 2", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("BAD_REQUEST", "expired cursor"));
        return runner.do(name, fn);
      },
    };
    const outcome = await runWalk(h.world.deps, runId, failing);

    expect(outcome.status).toBe("complete");
    expect(queries(h.world).map((query) => [query.limit, query.cursor])).toEqual([
      [5, undefined],
      [5, "c:5"],
      [5, undefined],
      [5, "c:5"],
      [5, "c:10"],
    ]);
    const row = runRow(h.world, runId);
    expect(row).toMatchObject({ status: "complete", page_size: 5, pages: 3, products: 13, errors: 1 });
    expect(JSON.parse(String(row["error_log"]))).toMatchObject([{ code: "BAD_REQUEST", message: "expired cursor" }]);
  });

  it("does not count a page twice when the step after a cursor restart is retried", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    let lost = false;
    const retrying: StepRunner = {
      async do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("BAD_REQUEST", "invalid cursor signature"));
        const result = await fn();
        if (name === "page-2" && !lost) {
          lost = true;
          return fn();
        }
        return result;
      },
    };
    const outcome = await runWalk(h.world.deps, runId, retrying);
    expect(outcome.status).toBe("complete");
    expect(runRow(h.world, runId)).toMatchObject({ status: "complete", pages: 3, products: 13 });
  });

  it("fails the run on the third cursor BAD_REQUEST", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        // Every second page call carries a cursor; each one is refused.
        if (h.world.partner.callsTo("products.list").length % 2 === 1) {
          h.world.partner.failNext("products.list", partnerError("BAD_REQUEST", "expired cursor"));
        }
        return runner.do(name, fn);
      },
    };
    const outcome = await runWalk(h.world.deps, runId, failing);

    expect(outcome).toMatchObject({ status: "failed", code: "BAD_REQUEST" });
    expect(queries(h.world).map((query) => query.cursor)).toEqual([undefined, "c:5", undefined, "c:5", undefined, "c:5"]);
    const row = runRow(h.world, runId);
    expect(row).toMatchObject({ status: "failed", errors: 3 });
    expect(JSON.parse(String(row["error_log"]))).toHaveLength(3);
    expect(watermark(h.world)).toBeNull();
  });

  it("fails at once on a BAD_REQUEST for page 1, where no cursor was sent", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    h.world.partner.failNext("products.list", partnerError("BAD_REQUEST", "limit out of range"));
    const outcome = await runWalk(h.world.deps, runId, steps(h.world));
    expect(outcome).toMatchObject({ status: "failed", code: "BAD_REQUEST" });
    expect(queries(h.world)).toHaveLength(1);
    expect(runRow(h.world, runId)).toMatchObject({ status: "failed", errors: 1 });
  });

  it("reports a stored error log that is not JSON once, and the walk goes on", async () => {
    const h = harness("20", bulk(30));
    const runId = await startedRun(h);
    h.world.db.sqlite.query("UPDATE sync_runs SET error_log = 'not json' WHERE run_id = ?1").run(runId);
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("TIMEOUT"));
        return runner.do(name, fn);
      },
    };
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const outcome = await runWalk(h.world.deps, runId, failing);
      expect(outcome.status).toBe("complete");
      expect(logged.mock.calls).toEqual([[JSON.stringify({ at: "sync.errorLog", problem: "stored error log is not JSON", runId })]]);
    } finally {
      logged.mockRestore();
    }
    expect(JSON.parse(String(runRow(h.world, runId)["error_log"]))).toMatchObject([{ code: "TIMEOUT" }]);
  });

  it("leaves the watermark and the catalogue alone after a failed run", async () => {
    const h = harness("5");
    setWatermark(h.world, "2026-09-01T00:00:00.000Z");
    const runId = await startedRun(h);
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("UNAUTHORIZED", "key revoked"));
        return runner.do(name, fn);
      },
    };
    const outcome = await runWalk(h.world.deps, runId, failing);

    expect(outcome).toMatchObject({ status: "failed", code: "UNAUTHORIZED" });
    expect(watermark(h.world)).toBe("2026-09-01T00:00:00.000Z");
    expect(h.retired).toEqual([]);
    const row = runRow(h.world, runId);
    expect(row).toMatchObject({ status: "failed", errors: 1 });
    expect(row["finished_at"]).not.toBeNull();
    expect(JSON.parse(String(row["error_log"]))[0]).toMatchObject({ code: "UNAUTHORIZED", message: "key revoked" });
  });

  it("keeps only the newest 50 entries in the error log", async () => {
    const h = harness("5");
    const runId = await startedRun(h);
    const old = Array.from({ length: 50 }, (_, index) => ({ at: iso(0), code: `OLD_${index}`, message: "old", requestId: null }));
    h.world.db.sqlite.query("UPDATE sync_runs SET error_log = ?1 WHERE run_id = ?2").run(JSON.stringify(old), runId);
    h.world.partner.failNext("products.list", partnerError("FORBIDDEN"));
    await runWalk(h.world.deps, runId, steps(h.world));
    const log = JSON.parse(String(runRow(h.world, runId)["error_log"])) as { code: string }[];
    expect(log).toHaveLength(50);
    expect(log[0]?.code).toBe("OLD_1");
    expect(log.at(-1)?.code).toBe("FORBIDDEN");
  });

  it("refuses a second full load while one runs, and allows it after 6 hours", async () => {
    const h = harness("5");
    const first = await startedRun(h);
    const refused = await startFullSync(h.world.deps, h.env);
    expect(refused.ok).toBe(false);
    expect(refused.job).toBe("sync-full");
    expect(refused.summary).toContain("still running");
    expect(h.created).toHaveLength(1);

    h.world.clock.advance(6 * 3_600_000 + 1);
    const second = await startFullSync(h.world.deps, h.env);
    expect(second.ok).toBe(true);
    expect(h.created).toHaveLength(2);
    expect(runRow(h.world, first)).toMatchObject({ status: "failed" });
  });

  it("marks the run failed when the Workflow instance cannot be created", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await startFullSync(world.deps, env);
    expect(summary.ok).toBe(false);
    const rows = world.db.sqlite.query("SELECT status FROM sync_runs").all() as { status: string }[];
    expect(rows).toEqual([{ status: "failed" }]);
  });
});

describe("delta refresh", () => {
  it("does nothing before the first full load", async () => {
    const h = harness("5");
    const summary = await runDeltaSync(h.world.deps, h.env);
    expect(summary).toMatchObject({ job: "sync-delta", ok: false, summary: "no full load yet" });
    expect(queries(h.world)).toEqual([]);
    expect(h.world.db.sqlite.query("SELECT count(*) AS n FROM sync_runs").get()).toEqual({ n: 0 });
  });

  it("sends updatedSince from the watermark, never active, and moves the watermark", async () => {
    const h = harness("5");
    const mark = iso(FIXED_START + 1);
    setWatermark(h.world, mark);
    h.world.clock.advance(60_000);
    h.world.partner.setRetail("p-pizza-chi", "o-pizza-chi", 3100);

    const summary = await runDeltaSync(h.world.deps, h.env);
    expect(summary.ok).toBe(true);
    expect(queries(h.world)).toEqual([{ limit: 5, updatedSince: mark }]);
    expect(queries(h.world).every((query) => !("active" in query))).toBe(true);
    expect(watermark(h.world)).toBe(iso(FIXED_START + 60_000 - TEN_MINUTES));
    expect(h.retired).toEqual([]);
    const row = h.world.db.sqlite.query("SELECT * FROM sync_runs").get() as Record<string, unknown>;
    expect(row).toMatchObject({ kind: "delta", status: "complete", updated_since: mark, pages: 1, products: 1 });
  });

  it("stops after 40 pages and continues the same walk on the next call", async () => {
    const h = harness("1", bulk(45));
    setWatermark(h.world, iso(FIXED_START - 1));

    const first = await runDeltaSync(h.world.deps, h.env);
    expect(first.ok).toBe(true);
    expect(queries(h.world)).toHaveLength(40);
    const runs = h.world.db.sqlite.query("SELECT * FROM sync_runs").all() as Record<string, unknown>[];
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "running", pages: 40, cursor: "c:40" });
    expect(watermark(h.world)).toBe(iso(FIXED_START - 1));

    const second = await runDeltaSync(h.world.deps, h.env);
    expect(second.ok).toBe(true);
    expect(queries(h.world)).toHaveLength(45);
    expect(queries(h.world)[40]).toEqual({ limit: 1, updatedSince: iso(FIXED_START - 1), cursor: "c:40" });
    expect(h.world.db.sqlite.query("SELECT status, pages, products FROM sync_runs").all()).toEqual([{ status: "complete", pages: 45, products: 45 }]);
    expect(watermark(h.world)).toBe(iso(FIXED_START - TEN_MINUTES));
  });

  it("marks a delta older than 24 hours failed and starts a new walk", async () => {
    const h = harness("1", bulk(45));
    setWatermark(h.world, iso(FIXED_START - 1));
    await runDeltaSync(h.world.deps, h.env);
    h.world.clock.advance(24 * 3_600_000 + 1);

    await runDeltaSync(h.world.deps, h.env);
    const runs = h.world.db.sqlite.query("SELECT status, pages FROM sync_runs ORDER BY started_at").all();
    expect(runs).toEqual([
      { status: "failed", pages: 40 },
      { status: "running", pages: 40 },
    ]);
    expect(queries(h.world)[40]?.cursor).toBeUndefined();
  });

  const CRASH = "D1_ERROR: too many SQL variables";

  /** Makes every upsert throw, as the catalogue did at 00:01 and 03:01 UTC on 1 Oct. Answers the restore. */
  function crashUpserts(h: Harness): () => void {
    const upsert = h.world.catalogue.upsertProducts;
    h.world.catalogue.upsertProducts = async () => {
      throw new Error(CRASH);
    };
    return () => {
      h.world.catalogue.upsertProducts = upsert;
    };
  }

  it("fails a delta run whose walk throws, with code CRASH, the message and its finish time", async () => {
    const h = harness("5", bulk(3));
    const mark = iso(FIXED_START - 1);
    setWatermark(h.world, mark);
    h.world.clock.advance(60_000);
    crashUpserts(h);

    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const summary = await runDeltaSync(h.world.deps, h.env);
      const row = h.world.db.sqlite.query("SELECT * FROM sync_runs").get() as Record<string, unknown>;
      expect(summary).toMatchObject({ job: "sync-delta", ok: false, summary: `Delta ${String(row["run_id"])} crashed: ${CRASH}. The watermark did not move.` });
      expect(row).toMatchObject({ kind: "delta", status: "failed", finished_at: iso(h.world.clock.now()), pages: 0, errors: 1 });
      expect(JSON.parse(String(row["error_log"]))).toEqual([{ at: iso(h.world.clock.now()), code: "CRASH", message: CRASH, requestId: null }]);
      expect(logged.mock.calls).toEqual([[JSON.stringify({ at: "sync.runDeltaSync", runId: row["run_id"], error: CRASH })]]);
    } finally {
      logged.mockRestore();
    }
    expect(watermark(h.world)).toBe(mark);
  });

  it("opens a new run from the watermark on the call after a crash", async () => {
    const h = harness("5", bulk(3));
    const mark = iso(FIXED_START - 1);
    setWatermark(h.world, mark);
    const restore = crashUpserts(h);
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      await runDeltaSync(h.world.deps, h.env);
    } finally {
      logged.mockRestore();
    }
    restore();
    h.world.clock.advance(3 * 3_600_000);

    const summary = await runDeltaSync(h.world.deps, h.env);
    expect(summary.ok).toBe(true);
    expect(h.world.db.sqlite.query("SELECT status, updated_since, pages, products FROM sync_runs ORDER BY started_at").all()).toEqual([
      { status: "failed", updated_since: mark, pages: 0, products: 0 },
      { status: "complete", updated_since: mark, pages: 1, products: 3 },
    ]);
    expect(queries(h.world)).toEqual([
      { limit: 5, updatedSince: mark },
      { limit: 5, updatedSince: mark },
    ]);
  });

  it("fails a resumed open run when its walk throws", async () => {
    const h = harness("1", bulk(45));
    setWatermark(h.world, iso(FIXED_START - 1));
    await runDeltaSync(h.world.deps, h.env);
    h.world.clock.advance(3 * 3_600_000);
    crashUpserts(h);

    const logged = spyOn(console, "error").mockImplementation(() => {});
    let summary;
    try {
      summary = await runDeltaSync(h.world.deps, h.env);
    } finally {
      logged.mockRestore();
    }
    expect(summary?.ok).toBe(false);
    expect(h.world.db.sqlite.query("SELECT status, pages, finished_at FROM sync_runs").all()).toEqual([
      { status: "failed", pages: 40, finished_at: iso(h.world.clock.now()) },
    ]);
    expect(queries(h.world)[40]?.cursor).toBe("c:40");
  });
});

describe("sync status", () => {
  it("shows the last 20 runs newest first, the watermark and the product counts", async () => {
    const h = harness("5");
    const insert = h.world.db.sqlite.query(
      "INSERT INTO sync_runs (run_id, kind, status, started_at, finished_at, page_size, pages, products, errors) VALUES (?1, 'delta', 'complete', ?2, ?2, 5, 1, 2, 0)",
    );
    for (let index = 0; index < 25; index++) insert.run(`run-${index}`, iso(FIXED_START + index * 1000));
    setWatermark(h.world, "2026-09-30T00:00:00.000Z");

    const status = await getSyncStatus(h.world.deps.db, h.world.catalogue);
    expect(status.lastRefreshAt).toBe("2026-09-30T00:00:00.000Z");
    expect(status.runs).toHaveLength(20);
    expect(status.runs[0]).toEqual({
      runId: "run-24",
      kind: "delta",
      status: "complete",
      startedAt: iso(FIXED_START + 24_000),
      finishedAt: iso(FIXED_START + 24_000),
      pages: 1,
      products: 2,
      errors: 0,
    });
    expect(status.runs.at(-1)?.runId).toBe("run-5");
    const counts = await h.world.catalogue.countProducts();
    expect(status.totalProducts).toBe(counts.total);
    expect(status.listableProducts).toBe(counts.listable);
  });

  it("answers null for the watermark and no runs on an empty database", async () => {
    const h = harness("5");
    const status = await getSyncStatus(h.world.deps.db, h.world.catalogue);
    expect(status.lastRefreshAt).toBeNull();
    expect(status.runs).toEqual([]);
  });
});
