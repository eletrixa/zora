/**
 * Partner experience scorecard: the hero states how old the latest probe run is, the verdict banner
 * names the failing step with the 7 and 30 day step rates, one tiles row leads into the Runs, Failing
 * steps, Latency, Catalogue sync, Contract drift and Findings sections, built from the shared blocks.
 * The Catalogue sync card reads the recorded sync runs, so it tells a complete delta sync from one
 * still running, one that failed, or one that is simply late, through the same `syncFacts` Price truth
 * uses; the card's value column stays a plain stamp, and that open or late state is its own line under
 * the rows (CEO review round 2, loop 5).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/scorecard.tsx
 * Deps:    src/contracts/pages.ts, src/contracts/reports.ts, src/lib/clock.ts, src/lib/sync-facts.ts, src/ui/components/shell.ts, src/ui/components/blocks.ts
 * Tested:  test/ui/pages/scorecard.test.tsx, test/app/pages.test.ts
 */
import type { PageRenderer, ScorecardPageProps } from "../../contracts/pages";
import type { DriftEvent, EndpointLatency, Finding, ProbeRunRow, ScorecardReport, SyncRunRow, SyncStatus } from "../../contracts/reports";
import { utcDay } from "../../lib/clock";
import { syncFacts } from "../../lib/sync-facts";
import { shell } from "../components/shell";
import { esc } from "../../lib/html";
import {
  box,
  checkRows,
  dataTable,
  dayStrip,
  emptyState,
  findingCard,
  findingList,
  hero,
  labelledList,
  latencyBars,
  pageFoot,
  pageSection,
  sideBoxes,
  statTiles,
  verdictBanner,
} from "../components/blocks";
import type { DayTone, FindingCardProps, HeroLead, LabelledValue, LatencyBar, StatTile, StripDay } from "../components/blocks";

/** "3 minutes ago", "5 hours ago", "2 days ago"; whole units, never negative. */
export function ageText(fromIso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const int = (n: number): string => n.toLocaleString("en-US");
/** "97.0 %", one decimal and a space, as every other percent on the site. */
const pct = (share: number): string => `${(share * 100).toFixed(1)} %`;
const NO_RATE_TEXT = "no runs yet in this window";
const SCHEDULE_TEXT = "The probe runs daily at 04:00 UTC.";
const SCHEDULE_REFRESH = "Refreshes daily at 04:00 UTC";
const NO_TILES_SENTENCE = "Tiles appear after the first probe run; the probe runs daily at 04:00 UTC.";
const RUNS_EMPTY_SENTENCE = "The run history appears after the first probe run; the probe runs daily at 04:00 UTC.";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Sep", the strip's own short date; the full moment stays in the square's title. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "2026-09-30 21:00 UTC"; a column that already names the unit asks for `withUnit: false`. */
function stampText(iso: string, withUnit = true): string {
  const d = new Date(iso);
  const s = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  return withUnit ? `${s} UTC` : s;
}

/** "04:00 UTC", the clock time with no date. */
function timeText(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

const DAILY_WALK_SENTENCE = "Every day at 04:00 UTC the probe walks the partner journey on production, as an outside builder would.";

// `now` comes from the render props, never from the clock, so this stays a pure function of its input.
// The run's counts are the lead's one bold phrase; the rest, including the daily-walk sentence, stays
// regular weight.
function ageLine(run: ProbeRunRow | null, now: number): HeroLead {
  if (!run) return "No probe run yet.";
  const counts = `${run.verdict}, ${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped`;
  return {
    text: `Last probe run ${ageText(run.finishedAt, now)} (${stampText(run.finishedAt)}): ${counts}. ${DAILY_WALK_SENTENCE}`,
    strong: [counts],
  };
}

export interface Verdict {
  readonly tone: "pass" | "fail" | "neutral";
  readonly title: string;
  readonly text: string;
  /** The 7 and 30 day step rates, at the banner's right; absent when there is no run yet. */
  readonly figures?: readonly LabelledValue[];
}

/** PASS or FAIL from the latest run, naming the failing step; the schedule when no run has happened yet. */
export function verdictOf(report: ScorecardReport): Verdict {
  const { latestRun, passRate7d, passRate30d, failingSteps } = report;
  if (!latestRun) return { tone: "neutral", title: "No runs yet", text: SCHEDULE_TEXT };
  const figures: LabelledValue[] = [
    { label: "Steps, 7 days", value: passRate7d == null ? NO_RATE_TEXT : pct(passRate7d) },
    { label: "Steps, 30 days", value: passRate30d == null ? NO_RATE_TEXT : pct(passRate30d) },
  ];
  if (latestRun.verdict === "pass") {
    return {
      tone: "pass",
      title: "PASS",
      text: `Every step that ran passed: ${latestRun.passed} of ${latestRun.passed}, and ${latestRun.skipped} skipped.`,
      figures,
    };
  }
  const total = latestRun.passed + latestRun.failed + latestRun.skipped;
  const worst = failingSteps[0];
  const text = worst ? `${latestRun.failed} of ${total} steps failed: ${failSentence(worst.detail)}` : `${latestRun.failed} of ${total} steps failed.`;
  return { tone: "fail", title: "FAIL", text, figures };
}

// ------------------------------------------------------------------ the page's one tiles row

function daysWithRunTile(runs: readonly ProbeRunRow[], now: number): StatTile {
  const windowStart = now - 29 * 24 * 3_600_000;
  const inWindow = runs.filter((run) => Date.parse(run.finishedAt) >= windowStart);
  const days = new Set(inWindow.map((run) => run.finishedAt.slice(0, 10))).size;
  const missing = 30 - days;
  return {
    label: "Days with a run",
    value: `${days} of 30`,
    hint: missing > 0 ? `no run on ${missing} day${missing === 1 ? "" : "s"} in the last 30` : "a run every day in the last 30",
  };
}

function slowestP95Tile(latency: readonly EndpointLatency[]): StatTile {
  if (latency.length === 0) return { label: "Slowest p95", value: "pending", hint: "appears after the first week of probe runs" };
  const max = Math.max(...latency.map((row) => row.p95Ms));
  const slowest = latency.filter((row) => row.p95Ms === max);
  const lead = slowest[0] ?? latency[0];
  if (!lead) return { label: "Slowest p95", value: "pending", hint: "appears after the first week of probe runs" };
  const hint = slowest.length > 1 ? `${slowest.length} steps tied, led by ${lead.check} · ${lead.step}` : `${lead.check} · ${lead.step}`;
  return { label: "Slowest p95", value: `${int(Math.round(max))} ms`, hint };
}

function openFindingsTile(findings: readonly Finding[]): StatTile {
  if (findings.length === 0) return { label: "Open findings", value: "0 of 0", hint: "no finding recorded yet" };
  const open = findings.filter((finding) => finding.status === "open").length;
  const majorReported = findings.find((finding) => finding.status === "reported" && finding.severity === "major");
  const hint = majorReported ? "the major one reported to Groupon" : open === 0 ? "none open" : `${findings.length - open} reported or fixed`;
  return { label: "Open findings", value: `${open} of ${findings.length}`, hint };
}

/** The page's one tiles row: steps passed leads, capped in the fail tone when a step failed today. */
function tilesOrEmpty(report: ScorecardReport, now: number): string {
  const run = report.latestRun;
  if (!run) return emptyState(NO_TILES_SENTENCE);
  const total = run.passed + run.failed + run.skipped;
  const tiles: StatTile[] = [
    {
      label: "Steps passed",
      value: `${run.passed} of ${total}`,
      tone: run.failed > 0 ? "fail" : "neutral",
      hint: `${run.failed} failed, ${run.skipped} skipped in the run of ${shortDate(run.finishedAt)}, ${timeText(run.finishedAt)}`,
    },
    daysWithRunTile(report.runs, now),
    slowestP95Tile(report.latency),
    openFindingsTile(report.findings),
  ];
  return statTiles(tiles, { lead: true });
}

// ------------------------------------------------------------------ runs

const DAY_MS = 24 * 3_600_000;
const STRIP_DAYS = 30;
const DAY_WORD: Record<DayTone, string> = { pass: "Pass", fail: "Fail", none: "No run" };

interface DayBucket {
  readonly dayKey: string; // YYYY-MM-DD
  /** The day's last run, or null when the job did not run that day. */
  readonly run: ProbeRunRow | null;
}

/** The last 30 calendar days ending today, oldest first; each day keeps only its own last run. */
function last30Days(runs: readonly ProbeRunRow[], now: number): DayBucket[] {
  const lastOfDay = new Map<string, ProbeRunRow>();
  for (const run of runs) {
    const key = utcDay(Date.parse(run.finishedAt));
    const prev = lastOfDay.get(key);
    if (!prev || Date.parse(run.finishedAt) > Date.parse(prev.finishedAt)) lastOfDay.set(key, run);
  }
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const dayKey = utcDay(now - (STRIP_DAYS - 1 - i) * DAY_MS);
    return { dayKey, run: lastOfDay.get(dayKey) ?? null };
  });
}

const RUN_HOUR_UTC = 4; // the probe's own daily schedule, "The probe runs daily at 04:00 UTC."

/** True for today's own bucket, before its 04:00 UTC run is due; such a day is not yet missed. */
function dueToday(dayKey: string, now: number): boolean {
  return dayKey === utcDay(now) && now < Date.parse(`${dayKey}T${pad2(RUN_HOUR_UTC)}:00:00.000Z`);
}

function toStripDay({ dayKey, run }: DayBucket, now: number): StripDay {
  const tone: DayTone = run ? run.verdict : "none";
  const label = shortDate(dayKey);
  const title = !run && dueToday(dayKey, now) ? `${label}: due at 04:00 UTC` : `${label}: ${DAY_WORD[tone]}`;
  return { day: label, tone, title };
}

/** "17 Sep", "17 and 18 Sep", "17, 18 and 19 Sep": the plain join the board's own sentences use. */
function englishList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "2 to 28 Sep" (same month) or "2 Sep to 3 Oct": one run of missing days' own range words. */
function rangeDates(fromKey: string, toKey: string): string {
  const from = new Date(`${fromKey}T00:00:00.000Z`);
  const to = new Date(`${toKey}T00:00:00.000Z`);
  const fromLabel = from.getUTCMonth() === to.getUTCMonth() ? String(from.getUTCDate()) : shortDate(fromKey);
  return `${fromLabel} to ${shortDate(toKey)}`;
}

/**
 * Each maximal run of consecutive missing days, phrased "on <day>" (one or two days, as before) or
 * "from <day> to <day>" (three or more), so a long outage reads as a range, not a list of every date.
 */
function noRunPhrases(days: readonly DayBucket[]): string[] {
  const phrases: string[] = [];
  let i = 0;
  while (i < days.length) {
    if (days[i]!.run) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < days.length && !days[j + 1]!.run) j++;
    phrases.push(
      j - i + 1 >= 3
        ? `from ${rangeDates(days[i]!.dayKey, days[j]!.dayKey)}`
        : `on ${englishList(days.slice(i, j + 1).map((bucket) => shortDate(bucket.dayKey)))}`,
    );
    i = j + 1;
  }
  return phrases;
}

/** The most recent fail among the shown days, and which days carried no run at all; today, before its
 *  run time, is neither counted nor named as missed. */
function lastFailNote(days: readonly DayBucket[], now: number): string {
  const today = days[days.length - 1]!;
  const todayDue = !today.run && dueToday(today.dayKey, now);
  const counted = todayDue ? days.slice(0, -1) : days;
  const noRun = noRunPhrases(counted);
  const lastFail = [...days].reverse().find((bucket) => bucket.run?.verdict === "fail");
  const run = lastFail?.run;
  const failSentence = run
    ? `Last fail on ${shortDate(lastFail!.dayKey)}: ${run.failed} of ${run.passed + run.failed + run.skipped} steps failed.`
    : "No fail in the last 30 days.";
  const noRunSentence = noRun.length > 0 ? ` No run ${englishList(noRun)}: the job did not run.` : "";
  const dueSentence = todayDue ? " Today's run is due at 04:00 UTC." : "";
  return failSentence + noRunSentence + dueSentence;
}

function latestRunBox(run: ProbeRunRow): string {
  const total = run.passed + run.failed + run.skipped;
  const figures: LabelledValue[] = [
    { label: "Steps", value: `${total} at ${timeText(run.finishedAt)}` },
    { label: "Passed", value: String(run.passed) },
    { label: "Failed", value: String(run.failed), tone: run.failed > 0 ? "fail" : undefined },
    { label: "Skipped", value: String(run.skipped) },
  ];
  return box({ title: `Latest run: ${shortDate(run.finishedAt)}`, body: labelledList(figures) });
}

/** The strip card (one square a day, the legend, the last fail) beside the Latest run card. */
function runsSectionBody(report: ScorecardReport, now: number): string {
  if (!report.latestRun || report.runs.length === 0) return emptyState(RUNS_EMPTY_SENTENCE);
  const days = last30Days(report.runs, now);
  const withRun = days.filter((bucket) => bucket.run);
  const passed = withRun.filter((bucket) => bucket.run!.verdict === "pass").length;
  const stripBox = box({
    title: `Last 30 days: ${passed} of ${withRun.length} runs passed`,
    body: dayStrip({ days: days.map((bucket) => toStripDay(bucket, now)), legend: { pass: "Pass", fail: "Fail", none: "No run" } }),
    note: lastFailNote(days, now),
  });
  return sideBoxes(stripBox, latestRunBox(report.latestRun));
}

// ------------------------------------------------------------------ failing steps, latency, drift, findings

/**
 * A check's "guide: X; the call itself failed with Y" or "...; observed Y" detail, split at its own "; ".
 * The halves sit under their own "Expected"/"Observed" labels, so neither repeats its label in its own
 * words: a leading "guide:" reads "Guide:", and a leading "observed " is dropped from the second half.
 */
function splitFailDetail(detail: string): { expected: string; observed: string } {
  const idx = detail.indexOf("; ");
  const first = idx === -1 ? detail : detail.slice(0, idx);
  const second = idx === -1 ? "" : detail.slice(idx + 2);
  const expected = first.startsWith("guide:") ? `Guide:${first.slice("guide:".length)}` : first;
  const observed = second.startsWith("observed ") ? second.slice("observed ".length) : second;
  return { expected, observed };
}

/**
 * The verdict banner's one plain sentence for the worst failing step: what was observed, then what
 * the guide promises instead. Never the check's raw "guide: …; observed …" detail, whose label words
 * and semicolon the banner must not repeat (the Failing steps card keeps those, under its own labels).
 */
function failSentence(detail: string): string {
  const { expected, observed } = splitFailDetail(detail);
  const promise = expected.replace(/^guide:\s*/i, "").trimStart();
  return observed ? `${observed} where the guide promises ${promise}.` : `${promise}.`;
}

function failingStepsBody(rows: ScorecardReport["failingSteps"], latestRun: ProbeRunRow | null): string {
  if (rows.length === 0) return emptyState("Every step of the latest run passed.");
  const total = latestRun ? latestRun.passed + latestRun.failed + latestRun.skipped : rows.length;
  const rowsHtml = checkRows(
    rows.map((row) => ({ name: `${row.check} · ${row.step}`, verdict: "fail" as const, detail: row.detail, ...splitFailDetail(row.detail) })),
  );
  const otherSteps = Math.max(total - rows.length, 0);
  const note = `The other ${otherSteps} steps: ${latestRun?.passed ?? 0} passed, ${latestRun?.skipped ?? 0} skipped.`;
  return box({ title: `${rows.length} of ${total} steps failed`, body: rowsHtml, note });
}

/** The slowest steps by p95 first, as the board orders them; p50 in front of p95 on each track. */
function latencyBody(rows: readonly EndpointLatency[]): string {
  if (rows.length === 0) return emptyState("Latency appears after the first probe run; the probe runs daily at 04:00 UTC.");
  const bars: LatencyBar[] = [...rows]
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .map((row) => ({ label: `${row.check} · ${row.step}`, p50Ms: row.p50Ms, p95Ms: row.p95Ms }));
  return box({ body: latencyBars(bars) });
}

function driftBody(rows: readonly DriftEvent[]): string {
  if (rows.length === 0) return emptyState("No drift seen. The openapi.json hash and the guide version are compared on every daily run.");
  return box({ body: dataTable(["Seen at", "Kind", "From", "To"], rows.map((row) => [stampText(row.at), row.kind, row.from, row.to])) });
}

function findingsBody(rows: readonly Finding[]): string {
  if (rows.length === 0) return emptyState("No finding recorded yet.");
  const cards: FindingCardProps[] = rows.map((row) => ({
    id: row.id,
    severity: row.severity,
    area: row.area,
    expected: row.expected,
    observed: row.observed,
    status: row.status,
  }));
  return findingList(cards.map((card) => findingCard(card)));
}

// ------------------------------------------------------------------ catalogue sync

const DELTA_EVERY_MS = 3 * 3_600_000; // the "0 */3 * * *" cron in wrangler.jsonc

/** The next three-hour boundary after `now`, epoch milliseconds. */
function nextDeltaAt(now: number): number {
  return Math.floor(now / DELTA_EVERY_MS) * DELTA_EVERY_MS + DELTA_EVERY_MS;
}

const kindLabel = (kind: SyncRunRow["kind"]): string => (kind === "full" ? "Full load" : "Delta sync");

function latestSyncsBox(sync: SyncStatus): string {
  if (sync.runs.length === 0) {
    return box({ body: emptyState("Sync runs appear once the first catalogue load has run; the delta sync then runs every 3 hours.") });
  }
  const errors = sync.runs.reduce((n, run) => n + run.errors, 0);
  const rows = sync.runs.map((run) => [kindLabel(run.kind), stampText(run.startedAt, false), int(run.products), int(run.errors)]);
  return box({
    title: `Latest syncs: ${errors} error${errors === 1 ? "" : "s"}`,
    body: dataTable(["Sync", "Started, UTC", "Deals read", "Errors"], rows, { numeric: [2, 3] }),
    note: "A delta sync reads only the deals that changed; the full load reads them all, Mondays at 05:00 UTC.",
  });
}

function nextSyncBox(sync: SyncStatus, now: number): string {
  const nextAtMs = nextDeltaAt(now);
  const nextAtIso = new Date(nextAtMs).toISOString();
  // The same three figures Price truth prints, from the one shared function (CEO review round 1, row 4).
  const facts = syncFacts(sync, now);
  const minutes = Math.max(0, Math.round((nextAtMs - now) / 60_000));
  const figures: LabelledValue[] = [
    { label: "Schedule", value: "Delta sync every 3 hours" },
    { label: "Last delta sync", value: facts.lastDeltaAt },
    { label: "Delta syncs today", value: String(facts.deltasToday) },
    { label: "Last full load", value: facts.lastFull },
    { label: "Listable deals", value: `${int(sync.listableProducts)} of ${int(sync.totalProducts)}` },
  ];
  // CEO review round 2: the value column is narrow, so the open/failed/late state is its own line
  // under the rows (the same split Price truth makes), never pasted onto the stamp as one sentence.
  const deltaNote = facts.lastDeltaNote ? `<p class="box-note">${esc(facts.lastDeltaNote)}</p>` : "";
  return box({
    title: `Next sync: ${timeText(nextAtIso)}, scheduled`,
    body: labelledList(figures) + deltaNote,
    note: `In ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  });
}

function catalogueSyncBody(sync: SyncStatus, now: number): string {
  return sideBoxes(latestSyncsBox(sync), nextSyncBox(sync, now));
}

// ------------------------------------------------------------------ page

export const renderScorecard: PageRenderer<ScorecardPageProps> = ({ report, sync, now }) => {
  const verdict = verdictOf(report);
  const body =
    hero({ eyebrow: "Product 2 · Partner experience daily probe", title: "Scorecard", lead: ageLine(report.latestRun, now) }) +
    verdictBanner({ tone: verdict.tone, title: verdict.title, text: verdict.text, figures: verdict.figures }) +
    tilesOrEmpty(report, now) +
    pageSection({
      title: "Runs",
      refresh: SCHEDULE_REFRESH,
      note: "A run passes when every step that ran passed. One square per day, the day's last run.",
      body: runsSectionBody(report, now),
    }) +
    pageSection({
      title: "Failing steps",
      refresh: SCHEDULE_REFRESH,
      note: "Steps of the latest run that did not pass.",
      body: failingStepsBody(report.failingSteps, report.latestRun),
    }) +
    pageSection({
      title: "Latency per endpoint",
      refresh: SCHEDULE_REFRESH,
      note: "Seven days of probe runs.",
      body: latencyBody(report.latency),
    }) +
    pageSection({
      title: "Catalogue sync",
      refresh: "Refreshes every 3 hours",
      note: "The partner catalogue every other page reads, kept current by the delta sync.",
      body: catalogueSyncBody(sync, now),
    }) +
    pageSection({
      title: "Contract drift",
      refresh: SCHEDULE_REFRESH,
      note: "The probe compares the guide and the openapi.json hash with the previous run.",
      body: driftBody(report.drift),
    }) +
    pageSection({
      title: "Findings",
      refresh: SCHEDULE_REFRESH,
      note: "What stopped us, and what the guide did not say.",
      body: findingsBody(report.findings),
    }) +
    pageFoot("The probe runs daily at 04:00 UTC. The catalogue's delta sync runs every 3 hours and the full load runs Mondays at 05:00 UTC.");
  return shell({ title: "Scorecard", active: "scorecard", body });
};
