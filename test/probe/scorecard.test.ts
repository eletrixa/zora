/**
 * Tests for the scorecard read model: pass rates, latency percentiles, drift and findings
 * ordering, and the empty-database case.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/scorecard.test.ts
 * Deps:    bun:test, src/probe/scorecard.ts, test/fakes/d1.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createScorecardReadModel } from "../../src/probe/scorecard";
import { createTestDb } from "../fakes/d1";

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const at = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString();

function insertRun(db: D1Database, args: { runId: string; startedAt: string; finishedAt: string; verdict: "pass" | "fail"; passed: number; failed: number; skipped: number }) {
  return db
    .prepare("INSERT INTO probe_runs (run_id, started_at, finished_at, verdict, passed, failed, skipped) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(args.runId, args.startedAt, args.finishedAt, args.verdict, args.passed, args.failed, args.skipped)
    .run();
}

function insertStep(
  db: D1Database,
  args: { runId: string; check: string; step: string; verdict: "pass" | "fail" | "skip"; detail: string; latencyMs: number | null; at: string },
) {
  return db
    .prepare(
      "INSERT INTO probe_steps (run_id, check_name, step, verdict, http_status, error_code, latency_ms, request_id, detail, at) VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, NULL, ?6, ?7)",
    )
    .bind(args.runId, args.check, args.step, args.verdict, args.latencyMs, args.detail, args.at)
    .run();
}

describe("scorecard: empty database", () => {
  it("gives an empty report without throwing", async () => {
    const { d1 } = createTestDb();
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report).toEqual({
      latestRun: null,
      runs: [],
      passRate7d: null,
      passRate30d: null,
      latency: [],
      drift: [],
      findings: [],
      failingSteps: [],
    });
  });
});

describe("scorecard: runs and pass rate", () => {
  it("reports the latest run and pass rates over 7 and 30 days", async () => {
    const { d1 } = createTestDb();
    await insertRun(d1, { runId: "r1", startedAt: at(0), finishedAt: at(1000), verdict: "pass", passed: 9, failed: 0, skipped: 1 });
    await insertRun(d1, { runId: "r2", startedAt: at(10 * DAY), finishedAt: at(10 * DAY + 1000), verdict: "fail", passed: 8, failed: 2, skipped: 0 });
    await insertRun(d1, { runId: "r3", startedAt: at(29 * DAY), finishedAt: at(29 * DAY + 1000), verdict: "pass", passed: 10, failed: 0, skipped: 0 });

    const model = createScorecardReadModel(d1);
    const report = await model.report(30);

    expect(report.latestRun?.runId).toBe("r3");
    expect(report.runs.map((r) => r.runId)).toEqual(["r3", "r2", "r1"]);
    // window anchored on the latest run (r3 at day 29): 7d back reaches only r3.
    expect(report.passRate7d).toBe(10 / 10);
    // 30d back reaches all three: passed 27, failed 2.
    expect(report.passRate30d).toBeCloseTo(27 / 29);
  });

  it("gives a null pass rate when the window has no passed or failed steps", async () => {
    const { d1 } = createTestDb();
    await insertRun(d1, { runId: "r1", startedAt: at(0), finishedAt: at(1000), verdict: "pass", passed: 0, failed: 0, skipped: 3 });
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.passRate7d).toBeNull();
    expect(report.passRate30d).toBeNull();
  });
});

describe("scorecard: latency percentiles", () => {
  it("computes nearest-rank p50 and p95 for a check/step with at least 3 samples", async () => {
    const { d1 } = createTestDb();
    await insertRun(d1, { runId: "r1", startedAt: at(0), finishedAt: at(1000), verdict: "pass", passed: 10, failed: 0, skipped: 0 });
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    for (const [i, ms] of latencies.entries()) {
      await insertStep(d1, { runId: "r1", check: "catalogue-page", step: "list", verdict: "pass", detail: "ok", latencyMs: ms, at: at(i) });
    }
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.latency).toHaveLength(1);
    expect(report.latency[0]).toMatchObject({ check: "catalogue-page", step: "list", samples: 10, p50Ms: 500, p95Ms: 1000 });
  });

  it("leaves out a check/step with fewer than 3 samples", async () => {
    const { d1 } = createTestDb();
    await insertRun(d1, { runId: "r1", startedAt: at(0), finishedAt: at(1000), verdict: "pass", passed: 2, failed: 0, skipped: 0 });
    await insertStep(d1, { runId: "r1", check: "registration", step: "get", verdict: "pass", detail: "ok", latencyMs: 50, at: at(0) });
    await insertStep(d1, { runId: "r1", check: "registration", step: "get", verdict: "pass", detail: "ok", latencyMs: 60, at: at(1) });
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.latency).toHaveLength(0);
  });
});

describe("scorecard: drift and findings", () => {
  it("orders drift events newest first", async () => {
    const { d1 } = createTestDb();
    await d1.prepare("INSERT INTO drift_events (at, kind, from_value, to_value) VALUES (?1, 'guide', 'v1', 'v2')").bind(at(0)).run();
    await d1.prepare("INSERT INTO drift_events (at, kind, from_value, to_value) VALUES (?1, 'openapi', 'a', 'b')").bind(at(DAY)).run();
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.drift.map((d) => d.kind)).toEqual(["openapi", "guide"]);
  });

  it("orders findings blocker, major, minor, then newest first within a severity", async () => {
    const { d1 } = createTestDb();
    await d1.prepare("INSERT INTO findings (id, at, area, expected, observed, severity) VALUES ('f1', ?1, 'a', 'e', 'o', 'minor')").bind(at(0)).run();
    await d1.prepare("INSERT INTO findings (id, at, area, expected, observed, severity) VALUES ('f2', ?1, 'a', 'e', 'o', 'blocker')").bind(at(0)).run();
    await d1.prepare("INSERT INTO findings (id, at, area, expected, observed, severity) VALUES ('f3', ?1, 'a', 'e', 'o', 'major')").bind(at(0)).run();
    await d1.prepare("INSERT INTO findings (id, at, area, expected, observed, severity) VALUES ('f4', ?1, 'a', 'e', 'o', 'blocker')").bind(at(DAY)).run();
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.findings.map((f) => f.id)).toEqual(["f4", "f2", "f3", "f1"]);
  });
});

describe("scorecard: failing steps", () => {
  it("lists the failing steps of the latest run only", async () => {
    const { d1 } = createTestDb();
    await insertRun(d1, { runId: "r1", startedAt: at(0), finishedAt: at(1000), verdict: "fail", passed: 0, failed: 1, skipped: 0 });
    await insertRun(d1, { runId: "r2", startedAt: at(DAY), finishedAt: at(DAY + 1000), verdict: "fail", passed: 0, failed: 1, skipped: 0 });
    await insertStep(d1, { runId: "r1", check: "refusals", step: "state-outside-list", verdict: "fail", detail: "old failure", latencyMs: null, at: at(0) });
    await insertStep(d1, { runId: "r2", check: "refusals", step: "state-outside-list", verdict: "fail", detail: "latest failure", latencyMs: null, at: at(DAY) });
    const model = createScorecardReadModel(d1);
    const report = await model.report(30);
    expect(report.failingSteps).toHaveLength(1);
    expect(report.failingSteps[0]).toMatchObject({ runId: "r2", check: "refusals", step: "state-outside-list", detail: "latest failure" });
  });
});
