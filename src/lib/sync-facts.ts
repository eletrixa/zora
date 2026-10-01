/**
 * The three catalogue sync figures Price truth and the Scorecard both print, from the recorded runs.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/sync-facts.ts
 * Deps:    src/contracts/reports.ts, src/lib/clock.ts
 * Tested:  test/lib/sync-facts.test.ts, test/app/pages.test.ts
 */
import type { SyncRunRow, SyncStatus } from "../contracts/reports";
import { utcDay } from "./clock";

// One function for both pages: CEO review round 1 (loop 5) rejected the site because the two pages
// told different sync stories, and two copies of this logic had drifted again by the next merge.

const DELTA_EVERY_MS = 3 * 3_600_000;
/** How long a three-hour window may sit with no delta run at all before the figure calls it late. */
const LATE_GRACE_MS = 30 * 60_000;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "21:00 UTC". */
function timeText(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/** "30 Sep". */
function shortDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

/** "21:00 UTC" on `now`'s UTC day, "30 Sep, 21:00 UTC" on any other. */
function stampText(iso: string, now: number): string {
  const ms = Date.parse(iso);
  return utcDay(ms) === utcDay(now) ? timeText(ms) : `${shortDay(ms)}, ${timeText(ms)}`;
}

function newestFirst(runs: readonly SyncRunRow[], kind: SyncRunRow["kind"]): SyncRunRow[] {
  return runs.filter((run) => run.kind === kind).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export interface SyncFacts {
  /** The newest complete delta run's own stamp, plus what the current three-hour window is doing. */
  readonly lastDelta: string;
  /** The newest complete delta run's own stamp alone ("30 Sep, 21:01 UTC", "none yet"): a card's value. */
  readonly lastDeltaAt: string;
  /** What the newest runs are doing, as sentences ending in a period, or null when nothing is open, failed or late. */
  readonly lastDeltaNote: string | null;
  /** Complete delta runs started on `now`'s UTC day. */
  readonly deltasToday: number;
  /** The newest complete full load's own short day, or "none yet". */
  readonly lastFull: string;
}

export function syncFacts(sync: SyncStatus, now: number): SyncFacts {
  const deltas = newestFirst(sync.runs, "delta");
  const lastComplete = deltas.find((run) => run.status === "complete");
  const base = lastComplete ? stampText(lastComplete.finishedAt ?? lastComplete.startedAt, now) : "none yet";

  // Every true statement about the newest runs, in order: a run still open (even one left over from
  // an earlier window), a failure in this window, a late window. A window is never late while a run is
  // open: `runDeltaSync` continues the open run instead of starting one, so the window's call did run
  // (CEO review round 3, loop 5: "Late: the 03:00 UTC sync has not started" while it had started).
  const boundary = Math.floor(now / DELTA_EVERY_MS) * DELTA_EVERY_MS;
  // A run continued from an earlier window and finished in this one is this window's sync: the 1 Oct
  // recovery resumed the 00:01 UTC run and completed it at 04:50 UTC, and the pages still said "Late".
  const current = deltas.find(
    (run) => Date.parse(run.startedAt) >= boundary || (run.finishedAt !== null && Date.parse(run.finishedAt) >= boundary),
  );
  const running = deltas.find((run) => run.status === "running");
  const parts = [base];
  if (running) parts.push(`Running since ${stampText(running.startedAt, now)}`);
  if (current?.status === "failed") parts.push(`Failed at ${timeText(Date.parse(current.finishedAt ?? current.startedAt))}`);
  // Before any sync has run there is no schedule to be late on yet.
  if (!current && !running && sync.runs.length > 0 && now - boundary > LATE_GRACE_MS) parts.push(`Late: the ${timeText(boundary)} sync has not started`);
  const lastDelta = parts.join(". ");
  // A card's value column is narrow: CEO review round 2 (loop 5) saw the whole sentence stack one word per line.
  const lastDeltaNote = parts.length > 1 ? `${parts.slice(1).join(". ")}.` : null;

  const today = utcDay(now);
  const deltasToday = deltas.filter((run) => run.status === "complete" && utcDay(Date.parse(run.startedAt)) === today).length;

  const full = newestFirst(sync.runs, "full").find((run) => run.status === "complete");
  const lastFull = full ? shortDay(Date.parse(full.finishedAt ?? full.startedAt)) : "none yet";

  return { lastDelta, lastDeltaAt: base, lastDeltaNote, deltasToday, lastFull };
}
