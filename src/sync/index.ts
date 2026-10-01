/**
 * Catalogue sync jobs and status: start a full load as a Workflow instance, start the daily category
 * walk as another, run the delta refresh inside a cron call, read the sync status. Must not import
 * cloudflare:workers (tests import this file).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/sync/index.ts
 * Deps:    src/contracts, src/sync/walk.ts, src/sync/category.ts
 * Tested:  test/sync/sync.test.ts, test/sync/category.test.ts
 */
import type { Env } from "../contracts/env";
import type { CatalogueStore, Job, JobSummary } from "../contracts/ports";
import type { SyncRunRow, SyncStatus } from "../contracts/reports";
import { iso } from "../lib/clock";
import { CATEGORY1_VALUES, categoryRunId, type CycleParams } from "./category";
import { DEFAULT_PAGE_SIZE, failRun, inlineSteps, insertRun, insertRunStatement, readRun, readWatermark, runWalk, type RunKind, type RunRow, type WalkOutcome } from "./walk";
import type { SyncParams } from "./workflow";

const FULL_RUN_GUARD_MS = 6 * 3_600_000;
/** A category cycle still running after this long is taken for dead and replaced. */
export const CATEGORY_CYCLE_GUARD_MS = 6 * 3_600_000;
/** A cursor lives 24 hours; a delta walk older than that cannot continue. */
const CURSOR_LIFETIME_MS = 24 * 3_600_000;
/** Pages one cron call may fetch; at one request per second this stays well inside the call. */
export const DELTA_PAGE_BUDGET = 40;
const STATUS_RUNS = 20;

export function pageSizeOf(env: Env): number {
  const parsed = Number(env.SYNC_PAGE_SIZE);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE_SIZE;
}

const newRunId = (kind: "full" | "delta"): string => `${kind}-${crypto.randomUUID()}`;

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** The running runs of one kind, newest first. */
async function runningRuns(db: D1Database, kind: RunKind): Promise<Pick<RunRow, "run_id" | "started_at">[]> {
  const rows = await db
    .prepare("SELECT run_id, started_at FROM sync_runs WHERE kind = ?1 AND status = 'running' ORDER BY started_at DESC")
    .bind(kind)
    .all<Pick<RunRow, "run_id" | "started_at">>();
  return rows.results;
}

/** Starts a full catalogue load as a Workflow instance. Refuses while another full load runs. */
export const startFullSync: Job = async (deps, env) => {
  const startedAt = iso(deps.clock.now());
  const done = (ok: boolean, summary: string): JobSummary => ({ job: "sync-full", ok, startedAt, finishedAt: iso(deps.clock.now()), summary });

  for (const run of await runningRuns(deps.db, "full")) {
    if (deps.clock.now() - Date.parse(run.started_at) < FULL_RUN_GUARD_MS) {
      return done(false, `A full load started at ${run.started_at} is still running, so no new one was started.`);
    }
    await failRun(deps.db, run.run_id, { code: "STALE", message: "still running after 6 hours, replaced by a new full load", requestId: null }, startedAt);
  }

  const pageSize = pageSizeOf(env);
  const runId = newRunId("full");
  await insertRun(deps.db, { runId, kind: "full", startedAt, pageSize, updatedSince: null, category1: null });
  const params: SyncParams = { runId, pageSize };
  try {
    await env.SYNC_WORKFLOW.create({ id: runId, params });
  } catch (cause) {
    const message = messageOf(cause);
    console.error(JSON.stringify({ at: "sync.startFullSync", runId, error: message }));
    await failRun(deps.db, runId, { code: "WORKFLOW_CREATE", message, requestId: null }, iso(deps.clock.now()));
    return done(false, `The full load ${runId} could not start: ${message}`);
  }
  return done(true, `Full load ${runId} started with ${pageSize} products per page.`);
};

/**
 * Starts the daily walk of Groupon's 38 category1 values as one Workflow instance, one run per category.
 * Waits while a full load runs: two walks at once would send two requests per second.
 */
export const startCategoryWalk: Job = async (deps, env) => {
  const startedAt = iso(deps.clock.now());
  const done = (ok: boolean, summary: string): JobSummary => ({ job: "category-walk", ok, startedAt, finishedAt: iso(deps.clock.now()), summary });

  const full = (await runningRuns(deps.db, "full")).find((run) => deps.clock.now() - Date.parse(run.started_at) < FULL_RUN_GUARD_MS);
  if (full) return done(false, `A full load started at ${full.started_at} is running, so the category walk waits for tomorrow.`);

  for (const run of await runningRuns(deps.db, "category")) {
    if (deps.clock.now() - Date.parse(run.started_at) < CATEGORY_CYCLE_GUARD_MS) {
      return done(false, `A category walk started at ${run.started_at} is still running, so no new one was started.`);
    }
    await failRun(deps.db, run.run_id, { code: "STALE", message: "still running after 6 hours, replaced by a new category walk", requestId: null }, startedAt);
  }

  const pageSize = pageSizeOf(env);
  const cycleId = `category-${crypto.randomUUID()}`;
  const runs = CATEGORY1_VALUES.map((category1) => ({ runId: categoryRunId(cycleId, category1), category1 }));
  const runIds = runs.map((run) => run.runId);
  await deps.db.batch(runs.map(({ runId, category1 }) => insertRunStatement(deps.db, { runId, kind: "category", startedAt, pageSize, updatedSince: null, category1 })));
  const params: CycleParams = { cycle: true, runIds };
  try {
    await env.SYNC_WORKFLOW.create({ id: cycleId, params });
  } catch (cause) {
    const message = messageOf(cause);
    console.error(JSON.stringify({ at: "sync.startCategoryWalk", cycle: cycleId, error: message }));
    const at = iso(deps.clock.now());
    for (const runId of runIds) await failRun(deps.db, runId, { code: "WORKFLOW_CREATE", message, requestId: null }, at);
    return done(false, `The category walk ${cycleId} could not start: ${message}`);
  }
  return done(true, `Category walk ${cycleId} started: ${runIds.length} categories, things-to-do first, ${pageSize} products per page.`);
};

/**
 * One delta walk with updatedSince = the stored watermark. No watermark yet: does nothing, ok=false.
 * A walk that throws fails its run with code CRASH, so the next call opens a fresh run from the watermark.
 */
export const runDeltaSync: Job = async (deps, env) => {
  const startedAt = iso(deps.clock.now());
  const done = (ok: boolean, summary: string): JobSummary => ({ job: "sync-delta", ok, startedAt, finishedAt: iso(deps.clock.now()), summary });

  let runId: string | null = null;
  const open = await deps.db
    .prepare("SELECT run_id, started_at FROM sync_runs WHERE kind = 'delta' AND status = 'running' ORDER BY started_at DESC LIMIT 1")
    .first<Pick<RunRow, "run_id" | "started_at">>();
  if (open) {
    if (deps.clock.now() - Date.parse(open.started_at) <= CURSOR_LIFETIME_MS) runId = open.run_id;
    else await failRun(deps.db, open.run_id, { code: "CURSOR_EXPIRED", message: "the walk is older than the 24 hour cursor lifetime", requestId: null }, startedAt);
  }

  if (runId === null) {
    const watermark = await readWatermark(deps.db);
    if (watermark === null) return done(false, "no full load yet");
    runId = newRunId("delta");
    await insertRun(deps.db, { runId, kind: "delta", startedAt, pageSize: pageSizeOf(env), updatedSince: watermark, category1: null });
  }

  let outcome: WalkOutcome;
  try {
    outcome = await runWalk(deps, runId, inlineSteps, { maxPages: DELTA_PAGE_BUDGET });
  } catch (cause) {
    // Left running, the run would be continued call after call and the pages would read it as open.
    const message = messageOf(cause);
    console.error(JSON.stringify({ at: "sync.runDeltaSync", runId, error: message }));
    const run = await readRun(deps.db, runId);
    if (run?.status === "running") await failRun(deps.db, runId, { code: "CRASH", message, requestId: null }, iso(deps.clock.now()));
    return done(false, `Delta ${runId} crashed: ${message}. The watermark did not move.`);
  }
  switch (outcome.status) {
    case "complete":
      return done(true, `Delta ${runId} complete: ${outcome.pages} pages, ${outcome.products} products, next refresh from ${outcome.watermark}.`);
    case "running":
      return done(true, `Delta ${runId} has ${outcome.pages} pages so far and continues on the next call.`);
    case "failed":
      return done(false, `Delta ${runId} failed with ${outcome.code}. The watermark did not move.`);
  }
};

type StatusRow = Pick<RunRow, "run_id" | "status" | "started_at" | "finished_at" | "pages" | "products" | "errors"> & { readonly kind: SyncRunRow["kind"] };

/** Full and delta runs only: 38 category runs a day would push the real runs out of the 20 shown. */
export async function getSyncStatus(db: D1Database, catalogue: CatalogueStore): Promise<SyncStatus> {
  const [rows, lastRefreshAt, counts] = await Promise.all([
    db
      .prepare(
        "SELECT run_id, kind, status, started_at, finished_at, pages, products, errors FROM sync_runs WHERE kind IN ('full', 'delta') ORDER BY started_at DESC, rowid DESC LIMIT ?1",
      )
      .bind(STATUS_RUNS)
      .all<StatusRow>(),
    readWatermark(db),
    catalogue.countProducts(),
  ]);
  const runs: SyncRunRow[] = rows.results.map((row) => ({
    runId: row.run_id,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    pages: row.pages,
    products: row.products,
    errors: row.errors,
  }));
  return { lastRefreshAt, runs, totalProducts: counts.total, listableProducts: counts.listable };
}
