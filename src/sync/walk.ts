/**
 * The catalogue walk: one page per step, bookkeeping in sync_runs, the watermark in sync_state.
 * A category walk tags the products it sees instead of storing them. Pure of the Workflow runtime,
 * so the Workflow shell and the delta cron job share it.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/sync/walk.ts
 * Deps:    src/contracts/ports.ts, src/lib/clock.ts, src/sync/tags.ts
 * Tested:  test/sync/sync.test.ts, test/sync/category.test.ts
 */
import type { ProductsQuery } from "../contracts/partner";
import type { Deps, PartnerError } from "../contracts/ports";
import { iso } from "../lib/clock";
import { tagProducts, untagOthersStatement } from "./tags";

/** What a Workflow's `step` offers, narrowed. A step may run its work more than once. */
export interface StepRunner {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

/** Runs each step once, at once. For the delta job, which runs inside a cron invocation. */
export const inlineSteps: StepRunner = { do: (_name, fn) => fn() };

export type RunKind = "full" | "delta" | "category";

export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 10;
export const WATERMARK_KEY = "last_refresh_at";
const WATERMARK_OVERLAP_MS = 10 * 60_000;
const ERROR_LOG_LIMIT = 50;
/** Errors the guide lets us answer with a smaller page and a fresh walk. */
const SHRINK_CODES: ReadonlySet<string> = new Set(["TIMEOUT", "INTERNAL_SERVER_ERROR"]);
/** Walks restarted per run after the API refused a cursor (expired, malformed, bad signature). */
const MAX_CURSOR_RESTARTS = 2;

export interface RunRow {
  readonly run_id: string;
  readonly kind: RunKind;
  readonly status: "running" | "complete" | "failed";
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly page_size: number;
  readonly updated_since: string | null;
  readonly cursor: string | null;
  readonly pages: number;
  readonly products: number;
  readonly errors: number;
  readonly last_page_timestamp: string | null;
  readonly error_log: string;
  /** The filter a category walk sends on every page; null for full and delta walks. */
  readonly category1: string | null;
}

export interface LoggedError {
  readonly code: string;
  readonly message: string;
  readonly requestId: string | null;
}

/** A step result: small on purpose, a Workflow step result is capped at 1 MiB. */
export type PageStep =
  | { readonly kind: "page"; readonly pages: number; readonly count: number; readonly done: boolean }
  | { readonly kind: "restart"; readonly pageSize: number }
  | { readonly kind: "failed"; readonly code: string };

export type WalkOutcome =
  | { readonly status: "complete"; readonly pages: number; readonly products: number; readonly watermark: string; readonly retired: number | null }
  | { readonly status: "running"; readonly pages: number }
  | { readonly status: "failed"; readonly code: string };

interface Progress {
  readonly status: RunRow["status"];
  readonly pages: number;
  readonly pageSize: number;
  readonly done: boolean;
  readonly code: string | null;
}

// ---------------------------------------------------------------- sync_runs and sync_state

export async function readRun(db: D1Database, runId: string): Promise<RunRow | null> {
  return db.prepare("SELECT * FROM sync_runs WHERE run_id = ?1").bind(runId).first<RunRow>();
}

export interface NewRun {
  readonly runId: string;
  readonly kind: RunKind;
  readonly startedAt: string;
  readonly pageSize: number;
  readonly updatedSince: string | null;
  readonly category1: string | null;
}

/** The insert of a new running run, unsent, so a caller can put many in one batch. */
export function insertRunStatement(db: D1Database, run: NewRun): D1PreparedStatement {
  return db
    .prepare("INSERT INTO sync_runs (run_id, kind, status, started_at, page_size, updated_since, category1) VALUES (?1, ?2, 'running', ?3, ?4, ?5, ?6)")
    .bind(run.runId, run.kind, run.startedAt, run.pageSize, run.updatedSince, run.category1);
}

export async function insertRun(db: D1Database, run: NewRun): Promise<void> {
  await insertRunStatement(db, run).run();
}

/** Marks a run failed and appends the error to its log, keeping the newest 50. */
export async function failRun(db: D1Database, runId: string, error: LoggedError, at: string): Promise<void> {
  const run = await readRun(db, runId);
  if (!run) throw new Error(`no sync run ${runId}`);
  await db
    .prepare("UPDATE sync_runs SET status = 'failed', finished_at = ?1, errors = errors + 1, error_log = ?2 WHERE run_id = ?3")
    .bind(at, appendError(run, error, at), runId)
    .run();
}

export async function readWatermark(db: D1Database): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM sync_state WHERE key = ?1").bind(WATERMARK_KEY).first<{ value: string }>();
  return row?.value ?? null;
}

/** The stored error log as an array. A log that is not JSON should never exist, so it is reported, then read as empty. */
function readErrorLog(run: RunRow): unknown[] {
  try {
    const parsed: unknown = JSON.parse(run.error_log);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error(JSON.stringify({ at: "sync.errorLog", problem: "stored error log is not JSON", runId: run.run_id }));
    return [];
  }
}

function appendError(run: RunRow, error: LoggedError, at: string): string {
  // A broken log must not stop the run from recording its error; it starts a fresh one.
  const entries = readErrorLog(run);
  entries.push({ at, code: error.code, message: error.message, requestId: error.requestId });
  return JSON.stringify(entries.slice(-ERROR_LOG_LIMIT));
}

// ---------------------------------------------------------------- steps

async function loadProgress(db: D1Database, runId: string): Promise<Progress> {
  const run = await readRun(db, runId);
  if (!run) throw new Error(`no sync run ${runId}`);
  return {
    status: run.status,
    pages: run.pages,
    pageSize: run.page_size,
    done: run.pages > 0 && run.cursor === null,
    code: run.status === "failed" ? lastErrorCode(run) : null,
  };
}

/** The category of a category walk, null for the other kinds. A category walk without one is a programmer error. */
function categoryOf(run: RunRow): string | null {
  if (run.kind !== "category") return null;
  if (run.category1 === null) throw new Error(`sync run ${run.run_id} is a category walk without a category1`);
  return run.category1;
}

function lastErrorCode(run: RunRow): string {
  const last: unknown = readErrorLog(run).at(-1);
  if (typeof last === "object" && last !== null && "code" in last && typeof last.code === "string") return last.code;
  return "UNKNOWN";
}

/**
 * Fetches and stores the page after `pagesBefore` pages of a walk at `pageSize`. When the row shows
 * this work already happened (a retried step), answers from the row and fetches nothing.
 */
export async function fetchPage(deps: Deps, runId: string, pagesBefore: number, pageSize: number): Promise<PageStep> {
  const run = await readRun(deps.db, runId);
  if (!run) throw new Error(`no sync run ${runId}`);
  if (run.status === "failed") return { kind: "failed", code: lastErrorCode(run) };
  if (run.page_size !== pageSize) return { kind: "restart", pageSize: run.page_size };
  if (run.pages > pagesBefore) return { kind: "page", pages: run.pages, count: 0, done: run.cursor === null };
  // Fewer pages than the step expects: a restart was already written by an earlier try of this step.
  if (run.pages < pagesBefore) return { kind: "restart", pageSize: run.page_size };
  const category1 = categoryOf(run);

  const query: ProductsQuery = {
    limit: run.page_size,
    ...(run.category1 !== null ? { category1: run.category1 } : {}),
    ...(run.updated_since !== null ? { updatedSince: run.updated_since } : {}),
    ...(run.cursor !== null ? { cursor: run.cursor } : {}),
  };
  const result = await deps.partner.listProducts(query);
  const now = iso(deps.clock.now());
  if (!result.ok) return answerError(deps.db, run, result.error, result.meta.requestId, now);

  const page = result.value;
  if (page.hasMore && !page.nextCursor) {
    await failRun(deps.db, runId, { code: "MISSING_CURSOR", message: "hasMore is true but nextCursor is empty", requestId: result.meta.requestId }, now);
    return { kind: "failed", code: "MISSING_CURSOR" };
  }
  // A category walk only learns which products sit in its category; the catalogue is the full and delta walks' job.
  if (category1 !== null) {
    await tagProducts(deps.db, runId, category1, page.products.map((product) => product.id), now);
  } else {
    await deps.catalogue.upsertProducts(page.products, runId, now);
  }
  // The WHERE clause makes a second write of the same page a no-op.
  await deps.db
    .prepare(
      "UPDATE sync_runs SET pages = pages + 1, products = products + ?1, cursor = ?2, last_page_timestamp = ?3 WHERE run_id = ?4 AND pages = ?5 AND page_size = ?6",
    )
    .bind(page.products.length, page.hasMore ? page.nextCursor : null, page.timestamp, runId, pagesBefore, pageSize)
    .run();
  return { kind: "page", pages: pagesBefore + 1, count: page.products.length, done: !page.hasMore };
}

async function answerError(db: D1Database, run: RunRow, error: PartnerError, requestId: string, now: string): Promise<PageStep> {
  const logged: LoggedError = { code: error.code, message: error.message, requestId };
  const smaller = Math.floor(run.page_size / 2);
  if (SHRINK_CODES.has(error.code) && smaller >= MIN_PAGE_SIZE) {
    // The guide wants identical parameters across one walk, so a new size means a new walk from page 1.
    await restartWalk(db, run, smaller, appendError(run, logged, now));
    return { kind: "restart", pageSize: smaller };
  }
  if (error.code === "BAD_REQUEST" && run.cursor !== null && cursorRestarts(run) < MAX_CURSOR_RESTARTS) {
    // Guide, Rules for every walk: a refused cursor is discarded and the walk starts again from page 1.
    await restartWalk(db, run, run.page_size, appendError(run, logged, now));
    return { kind: "restart", pageSize: run.page_size };
  }
  await failRun(db, run.run_id, logged, now);
  return { kind: "failed", code: error.code };
}

async function restartWalk(db: D1Database, run: RunRow, pageSize: number, errorLog: string): Promise<void> {
  await db
    .prepare(
      "UPDATE sync_runs SET page_size = ?1, cursor = NULL, pages = 0, products = 0, last_page_timestamp = NULL, errors = errors + 1, error_log = ?2 WHERE run_id = ?3",
    )
    .bind(pageSize, errorLog, run.run_id)
    .run();
}

/** A BAD_REQUEST that did not fail the run was a cursor restart, so the log counts them. */
function cursorRestarts(run: RunRow): number {
  return readErrorLog(run).filter((entry) => typeof entry === "object" && entry !== null && "code" in entry && entry.code === "BAD_REQUEST").length;
}

/**
 * Closes a complete walk: retire unseen products (full load only), then move the watermark. A category
 * walk instead drops the tags of its category that this walk did not see, and leaves the watermark:
 * one category cannot vouch for the whole catalogue.
 */
export async function finishRun(deps: Deps, runId: string): Promise<WalkOutcome> {
  const run = await readRun(deps.db, runId);
  if (!run) throw new Error(`no sync run ${runId}`);
  if (run.last_page_timestamp === null) throw new Error(`sync run ${runId} has no page to finish on`);
  const watermark = iso(Date.parse(run.last_page_timestamp) - WATERMARK_OVERLAP_MS);
  if (run.status === "complete") return { status: "complete", pages: run.pages, products: run.products, watermark, retired: null };

  const category1 = categoryOf(run);
  if (category1 !== null) {
    await deps.db.batch([
      untagOthersStatement(deps.db, category1, runId),
      deps.db.prepare("UPDATE sync_runs SET status = 'complete', finished_at = ?1 WHERE run_id = ?2").bind(iso(deps.clock.now()), runId),
    ]);
    return { status: "complete", pages: run.pages, products: run.products, watermark, retired: null };
  }

  const retired = run.kind === "full" ? await deps.catalogue.retireUnseen(runId) : null;
  await deps.db.batch([
    deps.db
      .prepare("INSERT INTO sync_state (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .bind(WATERMARK_KEY, watermark),
    deps.db.prepare("UPDATE sync_runs SET status = 'complete', finished_at = ?1 WHERE run_id = ?2").bind(iso(deps.clock.now()), runId),
  ]);
  return { status: "complete", pages: run.pages, products: run.products, watermark, retired };
}

// ---------------------------------------------------------------- the walk

/**
 * Walks a run from where its row stands until the last page, one step per page named `page-<n>`.
 * `maxPages` bounds the pages fetched in this call; the run then stays `running` for the next call.
 */
export async function runWalk(deps: Deps, runId: string, steps: StepRunner, options: { readonly maxPages?: number } = {}): Promise<WalkOutcome> {
  const start = await steps.do("load", () => loadProgress(deps.db, runId));
  if (start.status === "failed") return { status: "failed", code: start.code ?? "UNKNOWN" };

  let pages = start.pages;
  let pageSize = start.pageSize;
  let done = start.done;
  let step = 0;
  while (!done) {
    if (options.maxPages !== undefined && step >= options.maxPages) return { status: "running", pages };
    step++;
    const pagesBefore = pages;
    const size = pageSize;
    const answer = await steps.do(`page-${step}`, () => fetchPage(deps, runId, pagesBefore, size));
    if (answer.kind === "failed") return { status: "failed", code: answer.code };
    if (answer.kind === "restart") {
      pages = 0;
      pageSize = answer.pageSize;
      continue;
    }
    pages = answer.pages;
    done = answer.done;
  }
  return steps.do("finish", () => finishRun(deps, runId));
}
