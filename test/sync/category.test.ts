/**
 * The daily category walk: the category1 filter, the tags and their cleanup, the cycle of 38 runs in
 * one Workflow instance, its start guards, and its absence from the sync status.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/sync/category.test.ts
 * Deps:    bun:test, src/sync/*, test/sync/harness.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_CYCLE_GUARD_MS, getSyncStatus, startCategoryWalk, startFullSync } from "../../src/sync";
import { CATEGORY1_VALUES, categoryRunId, runCategoryCycle } from "../../src/sync/category";
import { fetchPage, insertRunStatement, runWalk, type StepRunner } from "../../src/sync/walk";
import { FIXED_START } from "../fakes/clock";
import { makeEnv, makeWorld, type FakeWorld } from "../fakes/env";
import { FIXTURE_CATEGORY1, FIXTURE_PRODUCTS } from "../fakes/fixtures";
import { partnerError } from "../fakes/partner";
import { seedCatalogue, seedCategories } from "../fakes/seed";
import { harness, iso, queries, runRow, setWatermark, steps, TEN_MINUTES, watermark, type Harness } from "./harness";

const SIX_HOURS = 6 * 3_600_000;
const YESTERDAY = "2026-09-30T00:30:00.000Z";
const OLD_RUN = "category-yesterday-things-to-do";

interface Tag {
  readonly product_id: string;
  readonly category1: string;
  readonly run_id: string;
}

const tags = (world: FakeWorld, category1?: string): Tag[] =>
  (world.db.sqlite.query("SELECT product_id, category1, run_id FROM product_categories ORDER BY category1, product_id").all() as Tag[]).filter(
    (tag) => category1 === undefined || tag.category1 === category1,
  );

/** One category run row, as startCategoryWalk writes it, at the harness page size. */
async function categoryRun(h: Harness, category1: string, runId = `category-test-${category1}`): Promise<string> {
  await insertRunStatement(h.world.deps.db, {
    runId,
    kind: "category",
    startedAt: iso(h.world.clock.now()),
    pageSize: Number(h.env.SYNC_PAGE_SIZE),
    updatedSince: null,
    category1,
  }).run();
  return runId;
}

/** The Workflow instance the last start created, as a cycle. */
function lastCycle(h: Harness): { cycleId: string; runIds: readonly string[] } {
  const created = h.created.at(-1);
  const params = created?.params;
  if (!created?.id || !params || !("cycle" in params)) throw new Error("no category cycle was created");
  return { cycleId: created.id, runIds: params.runIds };
}

/** The 38 category1 values as the guide lists them. */
function guideCategory1(): string[] {
  const guide = readFileSync(join(import.meta.dir, "..", "..", "docs", "reference", "partner-guide-v7.txt"), "utf8");
  const lines = guide.split("\n");
  const heading = lines.findIndex((line) => line.startsWith("### category1:"));
  const list = lines.slice(heading + 1).find((line) => line.trim().length > 0) ?? "";
  return list.split(",").map((value) => value.trim());
}

describe("category walk", () => {
  it("sends the category1 filter on every page and tags every product the walk sees", async () => {
    const h = harness("2");
    seedCatalogue(h.world.db);
    const runId = await categoryRun(h, "things-to-do");

    const outcome = await runWalk(h.world.deps, runId, steps(h.world));

    expect(outcome.status).toBe("complete");
    expect(queries(h.world)).toEqual([
      { limit: 2, category1: "things-to-do" },
      { limit: 2, category1: "things-to-do", cursor: "c:2" },
    ]);
    expect(tags(h.world)).toEqual([
      { product_id: "p-bowling-chi", category1: "things-to-do", run_id: runId },
      { product_id: "p-escape-nyc", category1: "things-to-do", run_id: runId },
      { product_id: "p-kayak-chi", category1: "things-to-do", run_id: runId },
    ]);
    expect(runRow(h.world, runId)).toMatchObject({ kind: "category", category1: "things-to-do", status: "complete", pages: 2, products: 3, cursor: null });
  });

  it("untags a product that left the category once the walk is complete", async () => {
    const h = harness("2");
    seedCatalogue(h.world.db);
    seedCategories(h.world.db, { "p-pizza-chi": ["things-to-do"] }, YESTERDAY, OLD_RUN);
    const runId = await categoryRun(h, "things-to-do");

    const halfway = await runWalk(h.world.deps, runId, steps(h.world), { maxPages: 1 });
    expect(halfway.status).toBe("running");
    expect(tags(h.world, "things-to-do").map((tag) => tag.product_id)).toContain("p-pizza-chi");

    const outcome = await runWalk(h.world.deps, runId, steps(h.world));
    expect(outcome.status).toBe("complete");
    expect(tags(h.world, "things-to-do")).toEqual([
      { product_id: "p-bowling-chi", category1: "things-to-do", run_id: runId },
      { product_id: "p-escape-nyc", category1: "things-to-do", run_id: runId },
      { product_id: "p-kayak-chi", category1: "things-to-do", run_id: runId },
    ]);
  });

  it("keeps yesterday's tags when the walk fails", async () => {
    const h = harness("2");
    seedCatalogue(h.world.db);
    seedCategories(h.world.db, { "p-bowling-chi": ["things-to-do"], "p-kayak-chi": ["things-to-do"], "p-pizza-chi": ["things-to-do"] }, YESTERDAY, OLD_RUN);
    const runId = await categoryRun(h, "things-to-do");
    const runner = steps(h.world);
    const failing: StepRunner = {
      do(name, fn) {
        if (name === "page-2") h.world.partner.failNext("products.list", partnerError("UNAUTHORIZED", "key revoked"));
        return runner.do(name, fn);
      },
    };

    const outcome = await runWalk(h.world.deps, runId, failing);

    expect(outcome).toMatchObject({ status: "failed", code: "UNAUTHORIZED" });
    expect(tags(h.world, "things-to-do")).toEqual([
      { product_id: "p-bowling-chi", category1: "things-to-do", run_id: runId },
      { product_id: "p-escape-nyc", category1: "things-to-do", run_id: runId },
      { product_id: "p-kayak-chi", category1: "things-to-do", run_id: OLD_RUN },
      { product_id: "p-pizza-chi", category1: "things-to-do", run_id: OLD_RUN },
    ]);
  });

  it("never upserts, retires or moves the watermark on a category walk", async () => {
    const h = harness("2");
    seedCatalogue(h.world.db);
    setWatermark(h.world, "2026-09-01T00:00:00.000Z");
    const runId = await categoryRun(h, "things-to-do");

    const outcome = await runWalk(h.world.deps, runId, steps(h.world));

    expect(outcome).toEqual({ status: "complete", pages: 2, products: 3, watermark: iso(FIXED_START + 2000 - TEN_MINUTES), retired: null });
    expect(h.events).toEqual([]);
    expect(h.retired).toEqual([]);
    expect(watermark(h.world)).toBe("2026-09-01T00:00:00.000Z");
  });

  it("skips a product the catalogue does not hold yet", async () => {
    const h = harness("5");
    seedCatalogue(h.world.db, FIXTURE_PRODUCTS.filter((product) => product.id !== "p-kayak-chi"));
    const runId = await categoryRun(h, "things-to-do");

    const outcome = await runWalk(h.world.deps, runId, steps(h.world));

    expect(outcome.status).toBe("complete");
    expect(tags(h.world).map((tag) => tag.product_id)).toEqual(["p-bowling-chi", "p-escape-nyc"]);
    expect(runRow(h.world, runId)).toMatchObject({ status: "complete", products: 3 });
  });

  it("keeps a product's other category tag when one category is re-walked", async () => {
    const h = harness("5");
    seedCatalogue(h.world.db);
    seedCategories(h.world.db, FIXTURE_CATEGORY1, YESTERDAY, OLD_RUN);
    const runId = await categoryRun(h, "things-to-do");

    await runWalk(h.world.deps, runId, steps(h.world));

    const all = tags(h.world);
    const expected = Object.entries(FIXTURE_CATEGORY1).flatMap(([productId, categories]) => categories.map((category1) => ({ productId, category1 })));
    expect(all).toHaveLength(expected.length);
    expect(all.filter((tag) => tag.category1 === "things-to-do").every((tag) => tag.run_id === runId)).toBe(true);
    expect(all.filter((tag) => tag.category1 !== "things-to-do").every((tag) => tag.run_id === OLD_RUN)).toBe(true);
    expect(all).toContainEqual({ product_id: "p-bowling-chi", category1: "food-and-drink", run_id: OLD_RUN });
  });

  it("throws on a category run without a category1, before any request", async () => {
    const h = harness("5");
    await insertRunStatement(h.world.deps.db, { runId: "category-broken", kind: "category", startedAt: iso(FIXED_START), pageSize: 5, updatedSince: null, category1: null }).run();
    await expect(fetchPage(h.world.deps, "category-broken", 0, 5)).rejects.toThrow("category-broken");
    expect(queries(h.world)).toEqual([]);
  });
});

describe("category walk start", () => {
  it("holds the guide's 38 category1 values with things-to-do first", () => {
    const guide = guideCategory1();
    expect(guide).toHaveLength(38);
    expect(CATEGORY1_VALUES[0]).toBe("things-to-do");
    expect(CATEGORY1_VALUES.slice(1)).toEqual(guide.filter((value) => value !== "things-to-do"));
  });

  it("starts one Workflow instance for 38 runs with things-to-do first", async () => {
    const h = harness("5");
    const summary = await startCategoryWalk(h.world.deps, h.env);

    const { cycleId, runIds } = lastCycle(h);
    expect(cycleId).toMatch(/^category-[0-9a-f-]{36}$/);
    expect(summary).toMatchObject({ job: "category-walk", ok: true, summary: `Category walk ${cycleId} started: 38 categories, things-to-do first, 5 products per page.` });
    expect(h.created).toEqual([{ id: cycleId, params: { cycle: true, runIds: CATEGORY1_VALUES.map((category1) => categoryRunId(cycleId, category1)) } }]);
    expect(runIds[0]).toBe(`${cycleId}-things-to-do`);
    const rows = h.world.db.sqlite.query("SELECT run_id, kind, status, category1, page_size, updated_since FROM sync_runs ORDER BY rowid").all();
    expect(rows).toEqual(
      CATEGORY1_VALUES.map((category1) => ({
        run_id: `${cycleId}-${category1}`,
        kind: "category",
        status: "running",
        category1,
        page_size: 5,
        updated_since: null,
      })),
    );
  });

  it("refuses while a category walk younger than 6 hours runs, and replaces a stale one", async () => {
    const h = harness("5");
    await startCategoryWalk(h.world.deps, h.env);
    const first = lastCycle(h);
    const startedAt = iso(FIXED_START);

    h.world.clock.advance(CATEGORY_CYCLE_GUARD_MS - 1);
    const refused = await startCategoryWalk(h.world.deps, h.env);
    expect(refused).toMatchObject({ job: "category-walk", ok: false, summary: `A category walk started at ${startedAt} is still running, so no new one was started.` });
    expect(h.created).toHaveLength(1);

    h.world.clock.advance(2);
    const second = await startCategoryWalk(h.world.deps, h.env);
    expect(second.ok).toBe(true);
    expect(h.created).toHaveLength(2);
    for (const runId of first.runIds) {
      const row = runRow(h.world, runId);
      expect(row["status"]).toBe("failed");
      expect(JSON.parse(String(row["error_log"]))).toMatchObject([{ code: "STALE", message: "still running after 6 hours, replaced by a new category walk" }]);
    }
    const running = h.world.db.sqlite.query("SELECT count(*) AS n FROM sync_runs WHERE kind = 'category' AND status = 'running'").get();
    expect(running).toEqual({ n: 38 });
  });

  it("refuses while a full load is running", async () => {
    const h = harness("5");
    expect((await startFullSync(h.world.deps, h.env)).ok).toBe(true);

    const refused = await startCategoryWalk(h.world.deps, h.env);
    expect(refused).toMatchObject({
      job: "category-walk",
      ok: false,
      summary: `A full load started at ${iso(FIXED_START)} is running, so the category walk waits for tomorrow.`,
    });
    expect(h.created).toHaveLength(1);
    expect(h.world.db.sqlite.query("SELECT count(*) AS n FROM sync_runs WHERE kind = 'category'").get()).toEqual({ n: 0 });

    h.world.clock.advance(SIX_HOURS + 1);
    expect((await startCategoryWalk(h.world.deps, h.env)).ok).toBe(true);
  });

  it("marks every run failed when the Workflow instance cannot be created", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const logged = spyOn(console, "error").mockImplementation(() => {});
    let summary;
    let calls: unknown[][] = [];
    try {
      summary = await startCategoryWalk(world.deps, env);
      calls = [...logged.mock.calls];
    } finally {
      logged.mockRestore();
    }

    const rows = world.db.sqlite.query("SELECT run_id, status, error_log FROM sync_runs").all() as { run_id: string; status: string; error_log: string }[];
    expect(rows).toHaveLength(38);
    const cycleId = rows[0]!.run_id.replace(/-things-to-do$/, "");
    const message = "the test environment has no Workflow runtime";
    expect(summary).toMatchObject({ job: "category-walk", ok: false, summary: `The category walk ${cycleId} could not start: ${message}` });
    for (const row of rows) {
      expect(row.status).toBe("failed");
      expect(JSON.parse(row.error_log)).toMatchObject([{ code: "WORKFLOW_CREATE", message }]);
    }
    expect(calls).toEqual([[JSON.stringify({ at: "sync.startCategoryWalk", cycle: cycleId, error: message })]]);
  });
});

describe("category cycle", () => {
  /** Step names carry the run id, as the Workflow shell names them. */
  function cycleSteps(h: Harness, names: string[], hook: (runId: string, name: string) => void = () => {}): (runId: string) => StepRunner {
    const runner = steps(h.world, names);
    return (runId) => ({
      do(name, fn) {
        hook(runId, name);
        return runner.do(`${runId}:${name}`, fn);
      },
    });
  }

  it("walks every run of a cycle in order and goes on after a failed category", async () => {
    const h = harness("5");
    seedCatalogue(h.world.db);
    await startCategoryWalk(h.world.deps, h.env);
    const { runIds } = lastCycle(h);
    const broken = categoryRunId(lastCycle(h).cycleId, "air-inclusive");
    const names: string[] = [];
    const stepsFor = cycleSteps(h, names, (runId, name) => {
      if (runId === broken && name === "page-1") h.world.partner.failNext("products.list", partnerError("UNAUTHORIZED", "key revoked"));
    });

    const outcome = await runCategoryCycle(h.world.deps, runIds, stepsFor);

    expect(outcome).toEqual({ complete: 37, failed: 1 });
    expect(names.filter((name) => name.endsWith(":load"))).toEqual(runIds.map((runId) => `${runId}:load`));
    expect([...new Set(queries(h.world).map((query) => query.category1))]).toEqual([...CATEGORY1_VALUES]);
    expect(runRow(h.world, broken)).toMatchObject({ status: "failed" });
    for (const runId of runIds.filter((id) => id !== broken)) expect(runRow(h.world, runId)["status"]).toBe("complete");
    const tagged = tags(h.world);
    const expected = Object.values(FIXTURE_CATEGORY1).reduce((sum, categories) => sum + categories.length, 0);
    expect(tagged).toHaveLength(expected);
  });

  it("records a crash on a category run and continues with the next", async () => {
    const h = harness("5");
    seedCatalogue(h.world.db);
    await startCategoryWalk(h.world.deps, h.env);
    const runIds = lastCycle(h).runIds.slice(0, 3);
    const crashed = runIds[0]!;
    const names: string[] = [];
    const runner = cycleSteps(h, names);
    // The step retries are spent: the runtime throws out of step.do without running the work.
    const stepsFor = (runId: string): StepRunner => ({
      do(name, fn) {
        if (runId === crashed && name === "page-1") return Promise.reject(new Error("D1 went away"));
        return runner(runId).do(name, fn);
      },
    });
    const logged = spyOn(console, "error").mockImplementation(() => {});
    let outcome;
    let calls: unknown[][] = [];
    try {
      outcome = await runCategoryCycle(h.world.deps, runIds, stepsFor);
      calls = [...logged.mock.calls];
    } finally {
      logged.mockRestore();
    }

    expect(outcome).toEqual({ complete: 2, failed: 1 });
    expect(calls).toEqual([[JSON.stringify({ at: "sync.categoryCycle", runId: crashed, error: "D1 went away" })]]);
    expect(names).toContain(`${crashed}:record-crash`);
    const row = runRow(h.world, crashed);
    expect(row["status"]).toBe("failed");
    expect(JSON.parse(String(row["error_log"]))).toMatchObject([{ code: "CRASH", message: "D1 went away" }]);
    expect(runRow(h.world, runIds[1]!)["status"]).toBe("complete");
    expect(runRow(h.world, runIds[2]!)["status"]).toBe("complete");
  });
});

describe("sync status with category walks", () => {
  it("leaves category walks out of the sync status", async () => {
    const h = harness("5");
    h.world.db.sqlite
      .query("INSERT INTO sync_runs (run_id, kind, status, started_at, finished_at, page_size, pages, products, errors) VALUES ('delta-1', 'delta', 'complete', ?1, ?1, 5, 1, 2, 0)")
      .run(iso(FIXED_START - 1000));
    await startCategoryWalk(h.world.deps, h.env);

    const status = await getSyncStatus(h.world.deps.db, h.world.catalogue);

    expect(status.runs.map((run) => [run.runId, run.kind])).toEqual([["delta-1", "delta"]]);
  });
});
