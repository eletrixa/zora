/**
 * Tests for the probe runner: order, crash handling, empty checks, persisted rows, drift
 * detection, verdict and summary text, and the post-run cart sweep.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/run.test.ts
 * Deps:    bun:test, src/probe/run.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { runProbe } from "../../src/probe/run";
import type { ProbeCheck, ProbeContext, ProbeStepResult } from "../../src/contracts/ports";
import { makeWorld } from "../fakes/env";

function step(over: Partial<ProbeStepResult> & { check: ProbeStepResult["check"] }): ProbeStepResult {
  return {
    step: "step",
    verdict: "pass",
    httpStatus: 200,
    errorCode: null,
    latencyMs: 10,
    requestId: "req-1",
    detail: "ok",
    ...over,
  };
}

function makeCheck(name: ProbeStepResult["check"], run: ProbeCheck["run"]): ProbeCheck {
  return { name, run };
}

function makeCtx(world: ReturnType<typeof makeWorld>): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: (async () => new Response("")) as unknown as ProbeContext["fetch"],
    config: {
      openapiUrl: "https://example.test/openapi.json",
      expectedDisplayName: "Test Partner",
      knownOrderUuid: null,
      checkoutHost: "partner.groupon.com",
    },
  };
}

async function readSteps(world: ReturnType<typeof makeWorld>, runId: string) {
  const rows = await world.db.d1.prepare("SELECT * FROM probe_steps WHERE run_id = ?1 ORDER BY id").bind(runId).all<Record<string, unknown>>();
  return rows.results;
}

describe("runProbe: order and shape", () => {
  it("runs the checks one after another in the given order", async () => {
    const world = makeWorld();
    const order: string[] = [];
    const a = makeCheck("registration", async () => {
      order.push("registration");
      return [step({ check: "registration" })];
    });
    const b = makeCheck("guide-version", async () => {
      order.push("guide-version");
      return [step({ check: "guide-version" })];
    });
    await runProbe(makeCtx(world), [a, b]);
    expect(order).toEqual(["registration", "guide-version"]);
  });

  it("turns a throwing check into one crashed fail step, and goes on", async () => {
    const world = makeWorld();
    const crasher = makeCheck("registration", async () => {
      throw new Error("boom");
    });
    const after = makeCheck("guide-version", async () => [step({ check: "guide-version" })]);
    const summary = await runProbe(makeCtx(world), [crasher, after]);
    expect(summary.ok).toBe(false);

    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs ORDER BY started_at DESC LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect(rows).toHaveLength(3); // crashed, pass, sweep
    expect(rows[0]).toMatchObject({ check_name: "registration", step: "crashed", verdict: "fail", detail: "boom" });
    expect(rows[1]).toMatchObject({ check_name: "guide-version", step: "step", verdict: "pass" });
    expect(rows[2]).toMatchObject({ check_name: "cart-lifecycle", step: "sweep", verdict: "pass" });
  });

  it("cuts a crash message to 300 characters", async () => {
    const world = makeWorld();
    const long = "x".repeat(1000);
    const crasher = makeCheck("registration", async () => {
      throw new Error(long);
    });
    await runProbe(makeCtx(world), [crasher]);
    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect((rows[0]!.detail as string).length).toBe(300);
  });

  it("counts a check with no steps as one skip step", async () => {
    const world = makeWorld();
    const empty = makeCheck("registration", async () => []);
    const summary = await runProbe(makeCtx(world), [empty]);
    // the sweep step (no open carts) passes and adds to the passed count.
    expect(summary.summary).toContain("1 passed, 0 failed, 1 skipped");
    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ check_name: "registration", step: "empty", verdict: "skip" });
    expect(rows[1]).toMatchObject({ check_name: "cart-lifecycle", step: "sweep", verdict: "pass" });
  });
});

describe("runProbe: persisted rows", () => {
  it("writes one probe_runs row and every step into probe_steps", async () => {
    const world = makeWorld();
    const checks = [
      makeCheck("registration", async () => [step({ check: "registration", step: "a" }), step({ check: "registration", step: "b" })]),
    ];
    await runProbe(makeCtx(world), checks);
    const runs = await world.db.d1.prepare("SELECT * FROM probe_runs").all<Record<string, unknown>>();
    expect(runs.results).toHaveLength(1);
    const steps = await world.db.d1.prepare("SELECT * FROM probe_steps").all<Record<string, unknown>>();
    expect(steps.results).toHaveLength(3); // a, b, sweep
  });

  it("batches large step counts (over 40) without failing", async () => {
    const world = makeWorld();
    const many = Array.from({ length: 85 }, (_, i) => step({ check: "registration", step: `s${i}` }));
    const checks = [makeCheck("registration", async () => many)];
    await runProbe(makeCtx(world), checks);
    const steps = await world.db.d1.prepare("SELECT * FROM probe_steps").all<Record<string, unknown>>();
    expect(steps.results).toHaveLength(86); // 85 + sweep
  });
});

describe("runProbe: drift", () => {
  it("a first observation is not a drift", async () => {
    const world = makeWorld();
    const checks = [makeCheck("guide-version", async () => [step({ check: "guide-version", observed: { kind: "guide", value: "v7" } })])];
    await runProbe(makeCtx(world), checks);
    const drift = await world.db.d1.prepare("SELECT * FROM drift_events").all<Record<string, unknown>>();
    expect(drift.results).toHaveLength(0);
    const snapshot = await world.db.d1.prepare("SELECT * FROM contract_snapshots WHERE kind = 'guide'").first<Record<string, unknown>>();
    expect(snapshot).toMatchObject({ value: "v7" });
  });

  it("a changed value writes a drift_events row and moves the snapshot", async () => {
    const world = makeWorld();
    const first = [makeCheck("guide-version", async () => [step({ check: "guide-version", observed: { kind: "guide", value: "v7" } })])];
    await runProbe(makeCtx(world), first);
    world.clock.advance(60_000);
    const second = [makeCheck("guide-version", async () => [step({ check: "guide-version", observed: { kind: "guide", value: "v8" } })])];
    await runProbe(makeCtx(world), second);

    const drift = await world.db.d1.prepare("SELECT * FROM drift_events").all<Record<string, unknown>>();
    expect(drift.results).toHaveLength(1);
    expect(drift.results[0]).toMatchObject({ kind: "guide", from_value: "v7", to_value: "v8" });
    const snapshot = await world.db.d1.prepare("SELECT * FROM contract_snapshots WHERE kind = 'guide'").first<Record<string, unknown>>();
    expect(snapshot).toMatchObject({ value: "v8" });
  });

  it("the same value only moves observed_at, no drift row", async () => {
    const world = makeWorld();
    const check = () => [step({ check: "guide-version", observed: { kind: "guide", value: "v7" } })];
    await runProbe(makeCtx(world), [makeCheck("guide-version", async () => check())]);
    world.clock.advance(60_000);
    await runProbe(makeCtx(world), [makeCheck("guide-version", async () => check())]);
    const drift = await world.db.d1.prepare("SELECT * FROM drift_events").all<Record<string, unknown>>();
    expect(drift.results).toHaveLength(0);
  });
});

describe("runProbe: verdict and summary", () => {
  it("fails the verdict when any step failed, but skips don't fail it", async () => {
    const world = makeWorld();
    const checks = [
      makeCheck("registration", async () => [step({ check: "registration", step: "a", verdict: "pass" })]),
      makeCheck("guide-version", async () => []),
    ];
    const summary = await runProbe(makeCtx(world), checks);
    expect(summary.ok).toBe(true);
  });

  it("names up to five failed steps in the summary", async () => {
    const world = makeWorld();
    const fails = Array.from({ length: 7 }, (_, i) => step({ check: "registration", step: `f${i}`, verdict: "fail" }));
    const checks = [makeCheck("registration", async () => fails)];
    const summary = await runProbe(makeCtx(world), checks);
    expect(summary.ok).toBe(false);
    // the sweep step (no open carts) still passes.
    expect(summary.summary).toContain("1 passed, 7 failed, 0 skipped");
    expect(summary.summary.match(/registration\//g)?.length).toBe(5);
  });
});

const LINE = { productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1, expectedPriceMinor: 4900 } as const;

describe("runProbe: cart sweep", () => {
  it("gives a passing sweep step when there is no open cart", async () => {
    const world = makeWorld();
    const summary = await runProbe(makeCtx(world), []);
    expect(summary.ok).toBe(true);
    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ check_name: "cart-lifecycle", step: "sweep", verdict: "pass" });
  });

  it("abandons every open probe cart and gives a passing sweep step", async () => {
    const world = makeWorld();
    await world.carts.create([LINE], "probe");
    await world.carts.create([LINE], "probe");
    await world.carts.create([LINE], "web");
    expect(world.carts.log.filter((c) => c.status === "open")).toHaveLength(3);

    const summary = await runProbe(makeCtx(world), []);
    expect(summary.ok).toBe(true);

    const open = world.carts.log.filter((c) => c.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]!.source).toBe("web");

    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ check_name: "cart-lifecycle", step: "sweep", verdict: "pass" });
  });

  it("leaves carts of other sources alone", async () => {
    const world = makeWorld();
    await world.carts.create([LINE], "web");
    await world.carts.create([LINE], "monitor");
    await world.carts.create([LINE], "agent-api");
    await runProbe(makeCtx(world), []);
    const open = world.carts.log.filter((c) => c.status === "open");
    expect(open).toHaveLength(3);
  });

  it("fails the sweep step, the run and logs one line when an abandon fails", async () => {
    const world = makeWorld();
    const created = await world.carts.create([LINE], "probe");
    if (created.kind !== "created") throw new Error("test setup: expected the cart to be created");
    const failure = { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" as const };
    world.partner.failNext("carts.abandon", failure);

    const originalError = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => logged.push(args[0]);
    let summary;
    try {
      summary = await runProbe(makeCtx(world), []);
    } finally {
      console.error = originalError;
    }

    expect(summary.ok).toBe(false);
    expect(logged).toHaveLength(1);
    const logged0 = JSON.parse(logged[0] as string);
    expect(logged0).toMatchObject({ at: "probe.sweep", problem: "abandon failed", cartId: created.cart.id, code: "INTERNAL_SERVER_ERROR" });
    expect(typeof logged0.requestId).toBe("string");

    const runRow = await world.db.d1.prepare("SELECT run_id FROM probe_runs LIMIT 1").first<{ run_id: string }>();
    const rows = await readSteps(world, runRow!.run_id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ check_name: "cart-lifecycle", step: "sweep", verdict: "fail" });
    expect(rows[0]!.detail).toBe(`1 probe cart(s) could not be abandoned: ${created.cart.id}`);
  });
});
