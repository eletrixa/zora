/**
 * Runs the probe checks in order, writes probe_runs and probe_steps, tracks contract drift
 * against contract_snapshots and drift_events, and sweeps the carts the probe leaves behind.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/run.ts
 * Deps:    src/contracts/ports.ts, src/lib/crypto.ts
 * Tested:  test/probe/run.test.ts
 */
import { newId } from "../lib/crypto";
import type { JobSummary, ProbeCheck, ProbeContext, ProbeStepResult } from "../contracts/ports";

const MAX_DETAIL = 500;
const MAX_ERROR_CODE = 60;
const MAX_CRASH_DETAIL = 300;
const BATCH_CHUNK = 40;
const MAX_FAILED_NAMES = 5;

const iso = (ms: number): string => new Date(ms).toISOString();

/** A step with the timestamp of the check run that produced it. */
interface StoredStep extends ProbeStepResult {
  readonly at: string;
}

export async function runProbe(ctx: ProbeContext, checks: readonly ProbeCheck[]): Promise<JobSummary> {
  const startedAt = iso(ctx.clock.now());
  const steps: StoredStep[] = [];

  for (const check of checks) {
    let results: readonly ProbeStepResult[];
    try {
      results = await check.run(ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results = [
        {
          check: check.name,
          step: "crashed",
          verdict: "fail",
          httpStatus: null,
          errorCode: null,
          latencyMs: null,
          requestId: null,
          detail: message.slice(0, MAX_CRASH_DETAIL),
        },
      ];
    }
    const at = iso(ctx.clock.now());
    if (results.length === 0) {
      steps.push({
        check: check.name,
        step: "empty",
        verdict: "skip",
        httpStatus: null,
        errorCode: null,
        latencyMs: null,
        requestId: null,
        detail: "check produced no steps",
        at,
      });
      continue;
    }
    for (const result of results) steps.push({ ...result, at });
  }

  steps.push(await sweepProbeCarts(ctx));

  const finishedAt = iso(ctx.clock.now());
  const passed = steps.filter((s) => s.verdict === "pass").length;
  const failedSteps = steps.filter((s) => s.verdict === "fail");
  const skipped = steps.filter((s) => s.verdict === "skip").length;
  const verdict: "pass" | "fail" = failedSteps.length > 0 ? "fail" : "pass";
  const runId = newId();

  await writeRun(ctx.db, { runId, startedAt, finishedAt, verdict, passed, failed: failedSteps.length, skipped }, steps);
  await recordDrift(ctx.db, steps, finishedAt);

  const failedNames = failedSteps.slice(0, MAX_FAILED_NAMES).map((s) => `${s.check}/${s.step}`);
  let summary = `${passed} passed, ${failedSteps.length} failed, ${skipped} skipped`;
  if (failedNames.length > 0) summary += `; failed: ${failedNames.join(", ")}`;

  return { job: "probe", ok: verdict === "pass", startedAt, finishedAt, summary };
}

async function writeRun(
  db: D1Database,
  run: { runId: string; startedAt: string; finishedAt: string; verdict: "pass" | "fail"; passed: number; failed: number; skipped: number },
  steps: readonly StoredStep[],
): Promise<void> {
  const runStmt = db
    .prepare("INSERT INTO probe_runs (run_id, started_at, finished_at, verdict, passed, failed, skipped) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(run.runId, run.startedAt, run.finishedAt, run.verdict, run.passed, run.failed, run.skipped);
  await db.batch([runStmt]);

  const stepStmts = steps.map((step) =>
    db
      .prepare(
        "INSERT INTO probe_steps (run_id, check_name, step, verdict, http_status, error_code, latency_ms, request_id, detail, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
      )
      .bind(
        run.runId,
        step.check,
        step.step,
        step.verdict,
        step.httpStatus,
        step.errorCode === null || step.errorCode === undefined ? null : step.errorCode.slice(0, MAX_ERROR_CODE),
        step.latencyMs,
        step.requestId,
        step.detail.slice(0, MAX_DETAIL),
        step.at,
      ),
  );
  for (let i = 0; i < stepStmts.length; i += BATCH_CHUNK) {
    await db.batch(stepStmts.slice(i, i + BATCH_CHUNK));
  }
}

/** No row for the kind: a first observation, not a drift. A changed value: one drift_events
 *  row plus the moved snapshot. An unchanged value: only observed_at moves. */
async function recordDrift(db: D1Database, steps: readonly StoredStep[], observedAt: string): Promise<void> {
  for (const step of steps) {
    if (!step.observed) continue;
    const { kind, value } = step.observed;
    const existing = await db.prepare("SELECT value FROM contract_snapshots WHERE kind = ?1").bind(kind).first<{ value: string }>();
    if (!existing) {
      await db.prepare("INSERT INTO contract_snapshots (kind, value, observed_at) VALUES (?1, ?2, ?3)").bind(kind, value, observedAt).run();
      continue;
    }
    if (existing.value !== value) {
      await db.prepare("INSERT INTO drift_events (at, kind, from_value, to_value) VALUES (?1, ?2, ?3, ?4)").bind(observedAt, kind, existing.value, value).run();
    }
    await db.prepare("UPDATE contract_snapshots SET value = ?1, observed_at = ?2 WHERE kind = ?3").bind(value, observedAt, kind).run();
  }
}

const MAX_FAILED_CART_IDS = 5;

/** The probe leaves nothing behind: every open cart it created gets abandoned. Reported as one
 *  step ("cart-lifecycle"/"sweep") so a cart Groupon still holds open is never silent. */
async function sweepProbeCarts(ctx: ProbeContext): Promise<StoredStep> {
  const openCarts = await ctx.carts.listOpen(0);
  const probeCarts = openCarts.filter((cart) => cart.source === "probe");
  const failedIds: string[] = [];

  for (const cart of probeCarts) {
    const result = await ctx.carts.abandon(cart.cartId);
    if (!result.ok) {
      failedIds.push(cart.cartId);
      console.error(
        JSON.stringify({ at: "probe.sweep", problem: "abandon failed", cartId: cart.cartId, code: result.error.code, requestId: result.meta.requestId }),
      );
    }
  }

  const at = iso(ctx.clock.now());
  if (failedIds.length === 0) {
    return {
      check: "cart-lifecycle",
      step: "sweep",
      verdict: "pass",
      httpStatus: null,
      errorCode: null,
      latencyMs: null,
      requestId: null,
      detail: probeCarts.length === 0 ? "no open probe carts" : `abandoned ${probeCarts.length} probe cart(s)`,
      at,
    };
  }
  const shown = failedIds.slice(0, MAX_FAILED_CART_IDS).join(", ");
  return {
    check: "cart-lifecycle",
    step: "sweep",
    verdict: "fail",
    httpStatus: null,
    errorCode: null,
    latencyMs: null,
    requestId: null,
    detail: `${failedIds.length} probe cart(s) could not be abandoned: ${shown}`,
    at,
  };
}
