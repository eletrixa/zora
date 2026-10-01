/**
 * Price truth: the verdict on whether the API's price holds through the cart and the public site,
 * the catalogue-wide promo gap, and the freshness of the delta sync. Cut from the boards, built from
 * the shared blocks. CEO review round 1 (loop 5): the Freshness "Next sync" card and the Changes-today
 * tile now read `props.sync` through `syncFacts`, the function the Scorecard uses, instead of inventing a sync
 * history from clock and cron arithmetic; the verdict banner and tiles name the newest sample's own
 * day instead of assuming "today", say when today's sample runs while it has not landed yet, and the
 * 30-day rates carry their own day-coverage count and a note on how the carts and pages are chosen;
 * the Promo gap section names the snapshot's own day and time. CEO review round 2: the Options-by-gap
 * box draws its histogram only when the bands sum to the caption's promo count, otherwise naming the
 * snapshot and the next arrival instead of nine empty bars; the banner's two 30-day figures carry the
 * rate alone in their value, the day coverage moved into the label, so the sentence beside them no
 * longer stacks one word per line; the Next-sync card's "Last delta sync" value is the stamp alone
 * (`syncFacts`'s `lastDeltaAt`), with `lastDeltaNote` (open, failed or late) as its own line under the
 * card's rows instead of packed into one `<dd>`. CEO review round 3: the Freshness note states only the
 * schedule ("The weekly full load runs on Mondays at 05:00 UTC.") with no claim about Monday counts;
 * the "no mismatch" notes under the two Last-30-days strips name how many sampled days the claim
 * actually rests on ("No mismatch on the 2 sampled days of the last 30.") instead of implying a full
 * month of evidence.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/price-truth.tsx
 * Deps:    src/contracts/pages.ts, src/contracts/reports.ts, src/lib/html.ts, src/lib/money.ts, src/lib/sync-facts.ts, src/ui/components/blocks.ts, src/ui/components/shell.ts
 * Tested:  test/ui/pages/price-truth.test.tsx, test/app/pages.test.ts
 */
import type { PageRenderer, PriceTruthPageProps } from "../../contracts/pages";
import type { CartSampleDay, GapBand, PriceTruthReport, PublicPriceComparison, SyncRunRow, SyncStatus, WorstGapDeal } from "../../contracts/reports";
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import { syncFacts } from "../../lib/sync-facts";
import {
  box,
  columnChart,
  dayStrip,
  emptyState,
  figureRow,
  hero,
  histogram,
  labelledList,
  pageFoot,
  pageSection,
  rankList,
  rankRow,
  sideBoxes,
  statTiles,
  verdictBanner,
  type ColumnChartBar,
  type DayTone,
  type HeroLead,
  type HistogramBar,
  type StripDay,
} from "../components/blocks";
import { shell } from "../components/shell";

const pct = (share: number): string => `${(share * 100).toFixed(1)} %`;
const usd = (minor: number): string => formatMoney(minor, "USD", 2);
const fmt = (n: number): string => n.toLocaleString("en-US");

const NO_SNAPSHOT_SENTENCE = "No snapshot yet. The promo-gap job runs after the catalogue load, then daily at 04:30 UTC.";
const NO_CART_SAMPLE_SENTENCE = "No cart sample yet. The job runs daily at 04:30 UTC: 20 options, every cart abandoned at once.";
const NO_PUBLIC_SENTENCE = "No public price observed yet. The collector on zora runs once a day at 06:00 UTC and posts to /ingest/observations.";

const DAY_STRIP_LEGEND = { pass: "Matched", fail: "Mismatched", none: "No sample" } as const;

/** The strip, and every 30-day aggregate next to it, keep the same window. */
const WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Sep": the board's day label, from a `YYYY-MM-DD` day. `dayStrip` and `columnChart` take their day text pre-formatted this way. */
function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_ABBR[m! - 1]}`;
}

// ------------------------------------------------------------------ day order helpers

/** Oldest first, so a day strip's `slice(-30)` keeps the newest days. */
function byDayAsc<T extends { day: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** The entry with the largest `day`, or null when the list is empty. */
function newestByDay<T extends { day: string }>(rows: readonly T[]): T | null {
  return rows.reduce<T | null>((newest, row) => (!newest || row.day > newest.day ? row : newest), null);
}

/** The most recent day (already oldest-first) for which `bad` holds, or null when none did. */
function mostRecentMatching<T extends { day: string }>(rows: readonly T[], bad: (row: T) => boolean): T | null {
  const hits = rows.filter(bad);
  return hits.length ? hits[hits.length - 1]! : null;
}

const sumBy = <T,>(rows: readonly T[], f: (row: T) => number): number => rows.reduce((sum, row) => sum + f(row), 0);

/** A cart day is clean when it charged nothing unexpected and sampled without error. */
const cartOk = (day: CartSampleDay): boolean => day.priceMismatch === 0 && day.errors === 0;
/** A public day is clean when every matched page showed the price the shopper pays. */
const pubOk = (day: PublicPriceComparison): boolean => day.showsOther === 0;

/** The last 30 calendar UTC days ending today, oldest first. */
function last30CalendarDays(now: number): readonly string[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => isoDay(now - (WINDOW_DAYS - 1 - i) * DAY_MS));
}

/** One strip square per calendar day of the window, "No sample" where the job named by `rows` did not run. */
function stripDays<T extends { day: string }>(rows: readonly T[], now: number, ok: (row: T) => boolean): StripDay[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return last30CalendarDays(now).map((day) => {
    const row = byDay.get(day);
    const tone: DayTone = !row ? "none" : ok(row) ? "pass" : "fail";
    const label = shortDate(day);
    return { day: label, tone, title: `${label}: ${DAY_STRIP_LEGEND[tone]}` };
  });
}

// ------------------------------------------------------------------ verdict

export interface Verdict {
  readonly tone: "pass" | "fail" | "neutral";
  readonly title: string;
  readonly text: string;
}

const cartSentence = (day: CartSampleDay): string =>
  `The price the API quotes is the price the cart charges: ${day.matched} of ${day.sampled} carts on ${day.day}.`;
const publicSentence = (day: PublicPriceComparison): string =>
  `groupon.com showed the same price on ${day.showsRetail} of ${day.matchedDeals} listing pages on ${day.day}.`;

/** Today's answer: the newest cart day against the newest public day, either day missing read as neutral. */
export function verdictOf(report: PriceTruthReport): Verdict {
  const cart = newestByDay(report.cartSamples);
  const pub = newestByDay(report.publicComparison);
  if (!cart || !pub) {
    return {
      tone: "neutral",
      title: "Pending",
      text: "The first cart sample runs at 04:30 UTC; the public comparison follows the collector's first run.",
    };
  }
  const cartClean = cartOk(cart);
  const pubClean = pubOk(pub);
  // The sentence that disagrees is named first; when both agree the cart leads, as the board draws it.
  const order = !cartClean ? [cartSentence(cart), publicSentence(pub)] : !pubClean ? [publicSentence(pub), cartSentence(cart)] : [cartSentence(cart), publicSentence(pub)];
  return {
    tone: cartClean && pubClean ? "pass" : "fail",
    title: cartClean && pubClean ? "Matched" : "Mismatched",
    text: order.join(" "),
  };
}

/** The hero's lead, verdictOf's own sentence with today's two counts bold (PriceTruth.png). */
function heroLead(report: PriceTruthReport, verdict: Verdict): HeroLead {
  const cart = newestByDay(report.cartSamples);
  const pub = newestByDay(report.publicComparison);
  const strong = [cart ? `${cart.matched} of ${cart.sampled}` : null, pub ? `${pub.showsRetail} of ${pub.matchedDeals}` : null].filter(
    (phrase): phrase is string => phrase !== null,
  );
  return strong.length ? { text: verdict.text, strong } : verdict.text;
}

/** Only the records that fall inside the last 30 calendar days ending today (CEO review 1: a rate and
 *  its own coverage count must read the same window, not "whatever records happen to be stored"). */
function sampledInLast30<T extends { day: string }>(rows: readonly T[], now: number): readonly T[] {
  const window = new Set(last30CalendarDays(now));
  return rows.filter((row) => window.has(row.day));
}

/** Before today's own sample has landed, the day clause must say when it runs instead of "today". */
function stalenessClause(cart: CartSampleDay, pub: PublicPriceComparison, now: number): string {
  const today = isoDay(now);
  const cartStale = cart.day < today;
  const pubStale = pub.day < today;
  if (cartStale && pubStale) return " Today's cart sample runs at 04:30 UTC; the public comparison at 06:00 UTC.";
  if (cartStale) return " Today's cart sample runs at 04:30 UTC.";
  if (pubStale) return " Today's public comparison runs at 06:00 UTC.";
  return "";
}

/** Sampling coverage and selection, named beside the reliability headline (CEO review 1). */
function sourcingNote(cart: CartSampleDay): string {
  return (
    `Carts are ${countWord(cart.sampled, "sellable option")} of listable products, drawn per UTC day; ` +
    `the public comparison reads the groupon.com listing page of each matched deal.`
  );
}

/**
 * The banner's own sentence: never the hero's (that was the round 1 bug). It names the newest
 * sample's own day, not "today" (CEO review 1: the capture day and the sample day can differ), then
 * the same shape over the last 30 days, with the two 30-day rates and their own day coverage at the
 * banner's right.
 */
function bannerFor(report: PriceTruthReport, verdict: Verdict, now: number): string {
  if (verdict.tone === "neutral") {
    return verdictBanner({ tone: verdict.tone, title: verdict.title, text: verdict.text });
  }
  // verdictOf only returns "neutral" when either newest day is missing, so both exist here.
  const cart = newestByDay(report.cartSamples)!;
  const pub = newestByDay(report.publicComparison)!;
  const cartWindow = sampledInLast30(report.cartSamples, now);
  const pubWindow = sampledInLast30(report.publicComparison, now);
  const cartSampled30 = sumBy(cartWindow, (d) => d.sampled);
  const cartBad30 = sumBy(cartWindow, (d) => d.priceMismatch + d.errors);
  const pubMatched30 = sumBy(pubWindow, (d) => d.matchedDeals);
  const pubBad30 = sumBy(pubWindow, (d) => d.showsOther);

  const dayClause =
    cartOk(cart) && pubOk(pub)
      ? `No cart and no page disagreed with the API on ${shortDate(cart.day)}.`
      : `${fmt(cart.priceMismatch + cart.errors)} of ${fmt(cart.sampled)} carts and ${fmt(pub.showsOther)} of ${fmt(pub.matchedDeals)} pages disagreed with the API on ${shortDate(cart.day)}.`;
  const thirtyClause = `In 30 days, ${fmt(cartBad30)} of ${fmt(cartSampled30)} carts and ${fmt(pubBad30)} of ${fmt(pubMatched30)} pages did.`;

  return verdictBanner({
    tone: verdict.tone,
    title: verdict.title,
    text: `${dayClause}${stalenessClause(cart, pub, now)} ${thirtyClause} ${sourcingNote(cart)}`,
    // CEO review 2: the value is the rate alone, never "95.0 % · 1 of 30 days sampled" in one nowrap
    // span (that stacked the sentence beside it one word per line); the day coverage moves to the label.
    figures: [
      {
        label: `Carts, 30 days, ${fmt(cartWindow.length)} sampled`,
        value: cartSampled30 > 0 ? pct((cartSampled30 - cartBad30) / cartSampled30) : "n/a",
      },
      {
        label: `Pages, 30 days, ${fmt(pubWindow.length)} sampled`,
        value: pubMatched30 > 0 ? pct((pubMatched30 - pubBad30) / pubMatched30) : "n/a",
      },
    ],
  });
}

// ------------------------------------------------------------------ the page's one tiles row

const isoDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** Whole days between a `YYYY-MM-DD` day and `now`'s UTC calendar day. */
function daysSince(day: string, now: number): number {
  const [y, m, d] = day.split("-").map(Number);
  const dayMs = Date.UTC(y!, m! - 1, d!);
  const n = new Date(now);
  const todayMs = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((todayMs - dayMs) / 86_400_000);
}

/** "8 days", "1 day": every day count on the page follows this rule. */
const dayWord = (n: number): string => `${fmt(n)} day${n === 1 ? "" : "s"}`;

/** "20 carts", "1 cart", "59 listing pages", "1 listing page": every counted noun on the page follows this rule. */
const countWord = (n: number, noun: string): string => `${fmt(n)} ${noun}${n === 1 ? "" : "s"}`;

/** Called only once a mismatch exists, so at least one of the two days is given. */
const sinceMismatchHint = (pubDay: string | null, cartDay: string | null): string =>
  [pubDay ? `pages last on ${pubDay}` : null, cartDay ? `carts on ${cartDay}` : null].filter((b): b is string => b !== null).join(", ");

/** The earlier of the cart and the public sample's own first day, or null before either has run. */
function firstSampleDay(report: PriceTruthReport): string | null {
  const cartFirst = byDayAsc(report.cartSamples)[0]?.day ?? null;
  const pubFirst = byDayAsc(report.publicComparison)[0]?.day ?? null;
  if (cartFirst && pubFirst) return cartFirst < pubFirst ? cartFirst : pubFirst;
  return cartFirst ?? pubFirst;
}

/** The four headline tiles: carts matched, pages matched, since a mismatch, changes today. */
function tilesRow(report: PriceTruthReport, sync: SyncStatus, now: number): string {
  const cart = newestByDay(report.cartSamples);
  const pub = newestByDay(report.publicComparison);
  const cartMismatch = mostRecentMatching(report.cartSamples, (d) => !cartOk(d));
  const pubMismatch = mostRecentMatching(report.publicComparison, (d) => !pubOk(d));
  const mostRecentMismatch = [cartMismatch?.day, pubMismatch?.day].filter((d): d is string => Boolean(d)).sort().pop() ?? null;
  const firstDay = firstSampleDay(report);
  const changesToday = report.priceChangesPerDay.find((row) => row.day === isoDay(now))?.changes ?? 0;
  // Read from the recorded runs through the same function the Scorecard uses (CEO review round 1).
  const syncs = syncFacts(sync, now).deltasToday;

  return statTiles(
    [
      {
        label: "Carts matched",
        value: cart ? `${fmt(cart.matched)} of ${fmt(cart.sampled)}` : "No sample yet",
        hint: cart ? `sampled on ${shortDate(cart.day)} at 04:30 UTC, every cart abandoned at once` : "sampled daily at 04:30 UTC, every cart abandoned at once",
        tone: cart ? (cartOk(cart) ? "pass" : "fail") : undefined,
      },
      {
        label: "Pages matched",
        value: pub ? `${fmt(pub.showsRetail)} of ${fmt(pub.matchedDeals)}` : "No sample yet",
        hint: pub ? `groupon.com on ${shortDate(pub.day)}, read at 06:00 UTC` : "groupon.com, read at 06:00 UTC",
        tone: pub ? (pubOk(pub) ? "pass" : "fail") : undefined,
      },
      {
        label: "Since a mismatch",
        value: mostRecentMismatch ? dayWord(daysSince(mostRecentMismatch, now)) : firstDay ? dayWord(daysSince(firstDay, now)) : "No sample yet",
        hint: mostRecentMismatch
          ? sinceMismatchHint(pubMismatch?.day ?? null, cartMismatch?.day ?? null)
          : firstDay
            ? `no mismatch since ${shortDate(firstDay)}` // short, so the pixel look's two lines never end in an ellipsis
            : undefined,
      },
      {
        label: "Changes today",
        value: fmt(changesToday),
        hint: `${syncs} delta sync${syncs === 1 ? "" : "s"} so far, the next at ${nextDeltaText(now)}`,
      },
    ],
    { panel: true, lead: true },
  );
}

// ------------------------------------------------------------------ catalogue against cart

/** "No mismatch on the 2 sampled days of the last 30." names the evidence the "no mismatch" claim
 *  actually rests on (CEO review 3: a month-long claim from as little as one sampled day overstates
 *  it), instead of the generic "No mismatch in the last 30 days." */
function cartMismatchNote(day: CartSampleDay | null, sampledDays: number): string {
  if (!day) return `No mismatch on the ${countWord(sampledDays, "sampled day")} of the last 30.`;
  const bits: string[] = [];
  if (day.priceMismatch > 0) bits.push(`${day.priceMismatch} of ${day.sampled} carts charged a price the API did not quote`);
  if (day.errors > 0) bits.push(`${day.errors} of ${day.sampled} carts errored`);
  return `Last mismatch on ${day.day}: ${bits.join(", and ")}.`;
}

function cartSamplesBody(report: PriceTruthReport, now: number): string {
  const newest = newestByDay(report.cartSamples);
  if (!newest) return emptyState(NO_CART_SAMPLE_SENTENCE);
  const shown = byDayAsc(report.cartSamples).slice(-WINDOW_DAYS);
  const sampled30 = sumBy(shown, (d) => d.sampled);
  const matched30 = sumBy(shown, (d) => d.matched);
  const strip = dayStrip({ legend: DAY_STRIP_LEGEND, days: stripDays(report.cartSamples, now, cartOk) });
  const left = box({
    title: `Last 30 days: ${fmt(matched30)} of ${fmt(sampled30)} carts matched`,
    body: strip,
    note: cartMismatchNote(mostRecentMatching(shown, (d) => !cartOk(d)), shown.length),
  });
  const right = box({
    title: `Latest day: ${shortDate(newest.day)}`,
    body:
      `<p><strong>${esc(countWord(newest.sampled, "cart"))} sampled</strong></p>` +
      labelledList([
        { label: "Matched", value: fmt(newest.matched), tone: "pass" },
        { label: "Mismatched", value: fmt(newest.priceMismatch), tone: newest.priceMismatch > 0 ? "fail" : undefined },
        { label: "Unavailable", value: fmt(newest.unavailable) },
        { label: "Errors", value: fmt(newest.errors), tone: newest.errors > 0 ? "fail" : undefined },
      ]),
  });
  // No table under the pair any more (round 5 miss 1): the walkthrough and the app test now read the
  // short "Latest day" title and the labelled rows above, not a per-day table row.
  return sideBoxes(left, right);
}

// ------------------------------------------------------------------ API against groupon.com

/** See `cartMismatchNote`: the same CEO review 3 fix, for the public-comparison window. */
function publicMismatchNote(day: PublicPriceComparison | null, sampledDays: number): string {
  if (!day) return `No mismatch on the ${countWord(sampledDays, "sampled day")} of the last 30.`;
  return `Last mismatch on ${day.day}: ${day.showsOther} of ${day.matchedDeals} pages showed another price.`;
}

function publicComparisonBody(report: PriceTruthReport, now: number): string {
  const newest = newestByDay(report.publicComparison);
  if (!newest) return emptyState(NO_PUBLIC_SENTENCE);
  const shown = byDayAsc(report.publicComparison).slice(-WINDOW_DAYS);
  const matched30 = sumBy(shown, (d) => d.showsRetail);
  const total30 = sumBy(shown, (d) => d.matchedDeals);
  const strip = dayStrip({ legend: DAY_STRIP_LEGEND, days: stripDays(report.publicComparison, now, pubOk) });
  const left = box({
    title: `Last 30 days: ${fmt(matched30)} of ${fmt(total30)} pages matched`,
    body: strip,
    note: publicMismatchNote(mostRecentMatching(shown, (d) => !pubOk(d)), shown.length),
  });
  const right = box({
    title: `Latest day: ${shortDate(newest.day)}`,
    body:
      `<p><strong>${esc(countWord(newest.matchedDeals, "listing page"))}</strong></p>` +
      labelledList([
        { label: "Showed the price you pay", value: fmt(newest.showsRetail), tone: "pass" },
        { label: "Showed the promo price", value: fmt(newest.showsPromo) },
        { label: "Showed another price", value: fmt(newest.showsOther), tone: newest.showsOther > 0 ? "fail" : undefined },
      ]),
  });
  // No table under the pair any more: see cartSamplesBody.
  return sideBoxes(left, right);
}

// ------------------------------------------------------------------ promo gap, whole catalogue

/** "0 to 5 %", ..., "over 40 %" (toPct null = open ended); bar share is relative to the tallest band. */
function gapBandBars(bands: readonly GapBand[]): readonly HistogramBar[] {
  if (bands.length === 0) return [];
  const max = Math.max(...bands.map((band) => band.options), 1);
  return bands.map((band) => ({
    label: band.toPct === null ? `over ${band.fromPct} %` : `${band.fromPct} to ${band.toPct} %`,
    value: band.options,
    share: band.options / max,
  }));
}

/** The board shows the catalogue's largest gaps, never all of them (round 3: 8, not 50). */
const MAX_GAP_ROWS = 8;

/** The gap list this page exists to show: You pay and the gap only; the promo price lives only in the promo line (rule 2 of AGENTS.md). */
function largestGapsList(worst: readonly WorstGapDeal[]): string {
  const shown = worst.slice(0, MAX_GAP_ROWS);
  if (shown.length === 0) return "";
  const rows = shown.map((deal, i) =>
    rankRow({
      rank: i + 1,
      href: `/deals/${deal.productId}`,
      title: deal.title,
      cells: [
        { label: "You pay", kind: "pay", text: usd(deal.retailMinor) },
        { label: "Gap", kind: "bar", text: pct(deal.gap), pct: deal.gap * 100 },
      ],
      promo: deal.promoCode ? { code: deal.promoCode, priceText: usd(deal.promoMinor) } : undefined,
    }),
  );
  return rankList({ head: ["#", "Deal", "You pay", "Gap"], rows, title: `The ${shown.length} largest gaps` });
}

/** "Snapshot of 30 Sep, 12:21 UTC; the next at 04:30 UTC.": when the catalogue-wide figures below were
 *  taken, named beside them (CEO review 1: the figures mix a live count with a stored snapshot, so the
 *  page must say which moment they describe instead of leaving the reader to assume "now"). */
function snapshotTimingSentence(takenAt: string): string {
  const d = new Date(takenAt);
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
  return `Snapshot of ${shortDate(takenAt.slice(0, 10))}, ${time}; the next at 04:30 UTC.`;
}

/** CEO review 2: when the bands do not sum to the caption's count, the box names the snapshot and the
 *  next arrival instead of drawing bars that disagree with it (nine empty bands labelled 0). */
function gapDistributionPendingText(takenAt: string): string {
  const d = new Date(takenAt);
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
  return `Snapshot of ${shortDate(takenAt.slice(0, 10))}, ${time}. The distribution follows the next promo-gap snapshot, daily at 04:30 UTC.`;
}

function promoGapBody(report: PriceTruthReport): string {
  const snapshot = report.latest;
  if (!snapshot) return emptyState(NO_SNAPSHOT_SENTENCE);
  const figures = figureRow([
    { label: "Sellable options", value: fmt(snapshot.listableOptions) },
    { label: "With a code", value: pct(snapshot.promoShare) },
    { label: "Median gap", value: pct(snapshot.medianGap) },
    { label: "90th percentile", value: pct(snapshot.p90Gap) },
  ]);
  const bars = gapBandBars(report.gapBands);
  // The bands and the caption's promo count must come from the same observation (CEO review 2): draw
  // the histogram only when they agree, otherwise say when the real distribution lands.
  const bandsReconcile = report.gapBands.length > 0 && sumBy(report.gapBands, (band) => band.options) === snapshot.optionsWithPromo;
  const caption =
    `${fmt(snapshot.optionsWithPromo)} of ${fmt(snapshot.listableOptions)} sellable options carry a promo code. ` +
    `Half of those take off ${pct(snapshot.medianGap)} or more (the median), one in ten ${pct(snapshot.p90Gap)} or more (the 90th percentile).`;
  const distribution = box({
    title: "Options by gap",
    body: bandsReconcile
      ? `<p class="section-lead">Every sellable option with a promo, by gap between the shown price and the price with the code.</p>${histogram(bars)}`
      : emptyState(gapDistributionPendingText(snapshot.takenAt)),
    note: caption,
  });
  return `<p>${esc(snapshotTimingSentence(snapshot.takenAt))}</p>` + figures + distribution + largestGapsList(report.worst);
}

// ------------------------------------------------------------------ freshness

const DELTA_EVERY_MS = 3 * 3_600_000; // the "0 */3 * * *" cron in wrangler.jsonc

/** "13:00 UTC": the next run of the three-hourly delta sync after `now`. Still cron math: it names a
 *  future time, never a past run (CEO review 1 only forbids treating a schedule as a measured fact). */
export function nextDeltaText(now: number): string {
  const next = new Date(Math.floor(now / DELTA_EVERY_MS) * DELTA_EVERY_MS + DELTA_EVERY_MS);
  return `${String(next.getUTCHours()).padStart(2, "0")}:${String(next.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** Minutes from `now` to the next three-hour boundary, the same arithmetic as `nextDeltaText`. */
function minutesToNextDelta(now: number): number {
  const next = Math.floor(now / DELTA_EVERY_MS) * DELTA_EVERY_MS + DELTA_EVERY_MS;
  return Math.round((next - now) / 60_000);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** One slot per calendar day of the window, 0 where the delta sync reported no changes that day. */
function changesByCalendarDay(rows: PriceTruthReport["priceChangesPerDay"], now: number): ReadonlyArray<{ day: string; changes: number }> {
  const byDay = new Map(rows.map((row) => [row.day, row.changes]));
  return last30CalendarDays(now).map((day) => ({ day, changes: byDay.get(day) ?? 0 }));
}

function freshnessColumns(days: ReadonlyArray<{ day: string; changes: number }>): readonly ColumnChartBar[] {
  const max = Math.max(...days.map((row) => row.changes), 1);
  return days.map((row) => ({ title: `${shortDate(row.day)}: ${fmt(row.changes)}`, share: row.changes / max }));
}

function freshnessBody(report: PriceTruthReport, sync: SyncStatus, now: number): string {
  if (report.priceChangesPerDay.length === 0) {
    return emptyState(`No delta sync has finished yet. The next one runs at ${nextDeltaText(now)}; its price changes appear here.`);
  }
  // One slot per calendar day of the 30-day window, zero height where no sync landed (round 5 miss 2):
  // the chart now matches the day strip's own window instead of only the days the report happens to hold.
  const days = changesByCalendarDay(report.priceChangesPerDay, now);
  const peak = days.reduce((best, row) => (row.changes > best.changes ? row : best));
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const todaysDay = isoDay(now);
  const axisEnd = `${shortDate(last.day)}${last.day === todaysDay ? ", so far" : ""}`;
  const left = box({
    title: "Price changes per day, last 30 days",
    body: columnChart({ peakText: `Peak ${fmt(peak.changes)} on ${shortDate(peak.day)}`, bars: freshnessColumns(days), axisStart: shortDate(first.day), axisEnd }),
  });
  const minutes = minutesToNextDelta(now);
  // The same three figures the Scorecard prints, from the one shared function (CEO review round 1, row 4).
  const facts = syncFacts(sync, now);
  const right = box({
    title: `Next sync: ${nextDeltaText(now)}, scheduled`,
    body:
      `<p><strong>Delta sync every 3 hours</strong></p>` +
      labelledList([
        // The value is the stamp alone (CEO review 2): a run still open, failed or a late window is
        // its own line below, instead of one `<dd>` stacking the whole sentence word by word.
        { label: "Last delta sync", value: facts.lastDeltaAt },
        { label: "Delta syncs today", value: fmt(facts.deltasToday) },
        { label: "Last full load", value: facts.lastFull },
      ]) +
      (facts.lastDeltaNote ? `<p>${esc(facts.lastDeltaNote)}</p>` : "") +
      `<p>${esc(`In ${minutes} minute${minutes === 1 ? "" : "s"}.`)}</p>`,
  });
  return sideBoxes(left, right);
}

// ------------------------------------------------------------------ page

const footText = (now: number): string =>
  `The promo-gap snapshot runs daily at 04:30 UTC, the cart sample daily at 04:30 UTC, and the delta sync every 3 hours; the next one runs at ${nextDeltaText(now)}.`;

export const renderPriceTruth: PageRenderer<PriceTruthPageProps> = ({ report, sync, now }) => {
  const verdict = verdictOf(report);
  const body =
    hero({ eyebrow: "Product 1 · Price truth monitor", title: "Price truth", lead: heroLead(report, verdict) }) +
    bannerFor(report, verdict, now) +
    tilesRow(report, sync, now) +
    pageSection({
      title: "Catalogue against cart",
      refresh: "Refreshes daily at 04:30 UTC",
      note: "Every day 20 options go into a cart at the price the API quotes, and every cart is abandoned at once. A day is matched when no cart charged another price.",
      body: cartSamplesBody(report, now),
    }) +
    pageSection({
      title: "API against groupon.com",
      refresh: "Refreshes daily at 06:00 UTC",
      note: "Deals on groupon.com listing pages, matched to the API by deal slug. A day is matched when every page showed the price you pay.",
      body: publicComparisonBody(report, now),
    }) +
    pageSection({
      title: "Promo gap, whole catalogue",
      refresh: "Refreshes daily at 04:30 UTC",
      note: "How much a promo code takes off the price you pay, over every sellable option that has one. Without the code the shopper pays the price shown.",
      body: promoGapBody(report),
    }) +
    pageSection({
      title: "Freshness",
      refresh: "Refreshes every 3 hours",
      note: "Price changes the delta sync picked up, per day. The weekly full load runs on Mondays at 05:00 UTC.",
      body: freshnessBody(report, sync, now),
    }) +
    pageFoot(footText(now));
  return shell({ title: "Price truth", active: "price-truth", body });
};
