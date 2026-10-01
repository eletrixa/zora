/**
 * Read model for the partner experience scorecard: latest run, run history, pass rates,
 * endpoint latency percentiles, drift events and findings.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/scorecard.ts
 * Deps:    src/contracts/reports.ts
 * Tested:  test/probe/scorecard.test.ts
 */
import type { DriftEvent, EndpointLatency, Finding, ProbeRunRow, ScorecardReadModel, ScorecardReport } from "../contracts/reports";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_LATENCY_SAMPLES = 3;

interface RunRow {
  readonly run_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly verdict: string;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

export function createScorecardReadModel(db: D1Database): ScorecardReadModel {
  return {
    async report(days: number): Promise<ScorecardReport> {
      const allRuns = (await db.prepare("SELECT run_id, started_at, finished_at, verdict, passed, failed, skipped FROM probe_runs ORDER BY started_at DESC").all<RunRow>()).results.map(
        toRunRow,
      );
      const latestRun = allRuns[0] ?? null;
      // Windows are anchored on the latest run, not the wall clock: a report reads the same
      // way whenever it is asked for.
      const anchorMs = latestRun ? Date.parse(latestRun.startedAt) : null;

      const runs = anchorMs === null ? [] : allRuns.filter((run) => Date.parse(run.startedAt) >= anchorMs - days * DAY_MS);
      const passRate7d = anchorMs === null ? null : await passRate(db, anchorMs - 7 * DAY_MS);
      const passRate30d = anchorMs === null ? null : await passRate(db, anchorMs - 30 * DAY_MS);

      const latency = await latencyStats(db);
      const drift = await driftEvents(db);
      const findings = await findingRows(db);
      const failingSteps = latestRun ? await failingStepsOf(db, latestRun.runId) : [];

      return { latestRun, runs, passRate7d, passRate30d, latency, drift, findings, failingSteps };
    },
  };
}

function toRunRow(row: RunRow): ProbeRunRow {
  return {
    runId: row.run_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    verdict: row.verdict as "pass" | "fail",
    passed: row.passed,
    failed: row.failed,
    skipped: row.skipped,
  };
}

async function passRate(db: D1Database, sinceMs: number): Promise<number | null> {
  const since = new Date(sinceMs).toISOString();
  const row = await db
    .prepare("SELECT COALESCE(SUM(passed), 0) AS passed, COALESCE(SUM(failed), 0) AS failed FROM probe_runs WHERE started_at >= ?1")
    .bind(since)
    .first<{ passed: number; failed: number }>();
  const passed = row?.passed ?? 0;
  const failed = row?.failed ?? 0;
  const total = passed + failed;
  return total === 0 ? null : passed / total;
}

async function latencyStats(db: D1Database): Promise<readonly EndpointLatency[]> {
  const rows = await db
    .prepare("SELECT check_name, step, latency_ms FROM probe_steps WHERE latency_ms IS NOT NULL ORDER BY check_name, step, latency_ms")
    .all<{ check_name: string; step: string; latency_ms: number }>();

  const groups = new Map<string, { check: string; step: string; values: number[] }>();
  for (const row of rows.results) {
    const key = `${row.check_name}\u0000${row.step}`;
    let group = groups.get(key);
    if (!group) {
      group = { check: row.check_name, step: row.step, values: [] };
      groups.set(key, group);
    }
    group.values.push(row.latency_ms);
  }

  const result: EndpointLatency[] = [];
  for (const group of groups.values()) {
    if (group.values.length < MIN_LATENCY_SAMPLES) continue;
    result.push({
      check: group.check,
      step: group.step,
      samples: group.values.length,
      p50Ms: nearestRank(group.values, 50),
      p95Ms: nearestRank(group.values, 95),
    });
  }
  return result;
}

/** Nearest-rank percentile over values already sorted ascending. */
function nearestRank(sortedValues: readonly number[], percentile: number): number {
  const rank = Math.ceil((percentile / 100) * sortedValues.length);
  const index = Math.min(Math.max(rank, 1), sortedValues.length) - 1;
  return sortedValues[index]!;
}

async function driftEvents(db: D1Database): Promise<readonly DriftEvent[]> {
  const rows = await db
    .prepare("SELECT at, kind, from_value, to_value FROM drift_events ORDER BY at DESC, id DESC")
    .all<{ at: string; kind: string; from_value: string; to_value: string }>();
  return rows.results.map((row) => ({ at: row.at, kind: row.kind as "openapi" | "guide", from: row.from_value, to: row.to_value }));
}

async function findingRows(db: D1Database): Promise<readonly Finding[]> {
  const rows = await db
    .prepare(
      "SELECT id, at, area, expected, observed, severity, status FROM findings " +
        "ORDER BY CASE severity WHEN 'blocker' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, at DESC",
    )
    .all<{ id: string; at: string; area: string; expected: string; observed: string; severity: string; status: string }>();
  return rows.results.map((row) => ({
    id: row.id,
    at: row.at,
    area: row.area,
    expected: row.expected,
    observed: row.observed,
    severity: row.severity as "blocker" | "major" | "minor",
    status: row.status as "open" | "reported" | "fixed",
  }));
}

async function failingStepsOf(db: D1Database, runId: string): Promise<readonly { readonly runId: string; readonly check: string; readonly step: string; readonly detail: string }[]> {
  const rows = await db
    .prepare("SELECT run_id, check_name, step, detail FROM probe_steps WHERE run_id = ?1 AND verdict = 'fail' ORDER BY id")
    .bind(runId)
    .all<{ run_id: string; check_name: string; step: string; detail: string }>();
  return rows.results.map((row) => ({ runId: row.run_id, check: row.check_name, step: row.step, detail: row.detail }));
}
