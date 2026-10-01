/**
 * The price truth page: a verdict, the page's one tiles row and four comparisons rendered with the
 * designed hero, verdict banner, day strip, figure row, rank list and table components. Every empty
 * case names what will fill it and when.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/price-truth.test.tsx
 * Deps:    bun:test, src/ui/pages/price-truth.tsx, src/contracts/reports.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { nextDeltaText, renderPriceTruth, verdictOf } from "../../../src/ui/pages/price-truth";
import type { CartSampleDay, GapBand, PriceTruthReport, PublicPriceComparison, SyncRunRow, SyncStatus, WorstGapDeal } from "../../../src/contracts/reports";

// The page now receives the recorded sync runs (CEO review 1, loop 5); none recorded here.
const EMPTY_SYNC: SyncStatus = { lastRefreshAt: null, runs: [], totalProducts: 0, listableProducts: 0 };

function syncRun(overrides: Partial<SyncRunRow>): SyncRunRow {
  return {
    runId: "run-1",
    kind: "delta",
    status: "complete",
    startedAt: "2026-09-30T12:00:00.000Z",
    finishedAt: "2026-09-30T12:01:00.000Z",
    pages: 1,
    products: 10,
    errors: 0,
    ...overrides,
  };
}

function syncWith(...runs: readonly SyncRunRow[]): SyncStatus {
  return { lastRefreshAt: runs[0]?.finishedAt ?? null, runs, totalProducts: 100, listableProducts: 80 };
}

const EMPTY_REPORT: PriceTruthReport = {
  latest: null,
  history: [],
  worst: [],
  cartSamples: [],
  publicComparison: [],
  priceChangesPerDay: [],
  gapBands: [],
};

function worstDeal(overrides: Partial<WorstGapDeal>): WorstGapDeal {
  return {
    productId: "p-1",
    optionId: "o-1",
    title: "Hydrafacial at Glow Studio",
    retailMinor: 9900,
    promoMinor: 8415,
    gap: 0.15,
    promoCode: "GLOW15",
    ...overrides,
  };
}

function cartDay(overrides: Partial<CartSampleDay>): CartSampleDay {
  return { day: "2026-09-30", sampled: 20, matched: 20, priceMismatch: 0, unavailable: 0, errors: 0, ...overrides };
}

function publicDay(overrides: Partial<PublicPriceComparison>): PublicPriceComparison {
  return { day: "2026-09-30", matchedDeals: 10, showsRetail: 10, showsPromo: 0, showsOther: 0, ...overrides };
}

const NOW = Date.UTC(2026, 8, 30, 11, 40);

const GAP_BANDS: readonly GapBand[] = [
  { fromPct: 0, toPct: 5, options: 18 },
  { fromPct: 5, toPct: 10, options: 42 },
  { fromPct: 10, toPct: 15, options: 96 },
  { fromPct: 15, toPct: 20, options: 150 },
  { fromPct: 20, toPct: 25, options: 118 },
  { fromPct: 25, toPct: 30, options: 54 },
  { fromPct: 30, toPct: 35, options: 14 },
  { fromPct: 35, toPct: 40, options: 6 },
  { fromPct: 40, toPct: null, options: 2 },
];

function fullReport(): PriceTruthReport {
  return {
    latest: {
      takenAt: "2026-09-30T04:30:00.000Z",
      listableOptions: 1316,
      optionsWithPromo: 500,
      promoShare: 0.38,
      medianGap: 0.185,
      p90Gap: 0.27,
      totalGapMinor: 1_250_000,
    },
    history: [
      { takenAt: "2026-09-30T04:30:00.000Z", listableOptions: 1316, optionsWithPromo: 500, promoShare: 0.38, medianGap: 0.185, p90Gap: 0.27, totalGapMinor: 1_250_000 },
    ],
    worst: [
      worstDeal({ title: "Hydrafacial at Glow Studio", gap: 0.02 }),
      worstDeal({ title: "Swedish Massage at Foot Smile Spa", gap: 0.08, promoCode: "SAVE20" }),
      worstDeal({ title: "Ten Yoga Classes at Sunrise Yoga", gap: 0.33, promoCode: null }),
    ],
    cartSamples: [cartDay({ matched: 19, priceMismatch: 1 })],
    publicComparison: [publicDay({ matchedDeals: 10, showsRetail: 7, showsPromo: 2, showsOther: 1 })],
    priceChangesPerDay: [{ day: "2026-09-30", changes: 12 }],
    gapBands: GAP_BANDS,
  };
}

describe("nextDeltaText", () => {
  it("names the next three-hour boundary in UTC", () => {
    expect(nextDeltaText(Date.UTC(2026, 8, 30, 11, 40))).toBe("12:00 UTC");
  });
});

describe("verdictOf", () => {
  it("passes with the newest cart day and public day and their counts, cart named first", () => {
    const report: PriceTruthReport = { ...EMPTY_REPORT, cartSamples: [cartDay({})], publicComparison: [publicDay({})] };
    const verdict = verdictOf(report);
    expect(verdict.tone).toBe("pass");
    expect(verdict.title).toBe("Matched");
    expect(verdict.text).toBe(
      "The price the API quotes is the price the cart charges: 20 of 20 carts on 2026-09-30. groupon.com showed the same price on 10 of 10 listing pages on 2026-09-30.",
    );
  });
  it("fails and names the cart counts first when a cart mismatched", () => {
    const report: PriceTruthReport = {
      ...EMPTY_REPORT,
      cartSamples: [cartDay({ matched: 19, priceMismatch: 1 })],
      publicComparison: [publicDay({})],
    };
    const verdict = verdictOf(report);
    expect(verdict.tone).toBe("fail");
    expect(verdict.title).toBe("Mismatched");
    expect(verdict.text.startsWith("The price the API quotes is the price the cart charges: 19 of 20 carts on 2026-09-30.")).toBe(true);
  });
  it("fails and names the public counts first when a public page showed another price", () => {
    const report: PriceTruthReport = {
      ...EMPTY_REPORT,
      cartSamples: [cartDay({})],
      publicComparison: [publicDay({ showsRetail: 7, showsOther: 1 })],
    };
    const verdict = verdictOf(report);
    expect(verdict.tone).toBe("fail");
    expect(verdict.title).toBe("Mismatched");
    expect(verdict.text.startsWith("groupon.com showed the same price on 7 of 10 listing pages on 2026-09-30.")).toBe(true);
  });
  it("is neutral with the schedule when no day exists yet", () => {
    const verdict = verdictOf(EMPTY_REPORT);
    expect(verdict.tone).toBe("neutral");
    expect(verdict.text).toBe("The first cart sample runs at 04:30 UTC; the public comparison follows the collector's first run.");
  });
});

describe("renderPriceTruth, empty report", () => {
  it("states the neutral verdict with the schedule in the hero and the banner", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    const sentence = "The first cart sample runs at 04:30 UTC; the public comparison follows the collector&#39;s first run.";
    expect(html).toContain(`<p class="lead">${sentence}</p>`);
    expect(html).toContain('class="verdict verdict--neutral"');
    expect(html).toContain(sentence);
  });
  it("says no snapshot yet, with the job schedule, and no placeholder text", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    expect(html).toContain("No snapshot yet. The promo-gap job runs after the catalogue load, then daily at 04:30 UTC.");
  });
  it("says no public price observed yet, with the collector schedule", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    expect(html).toContain("No public price observed yet. The collector on zora runs once a day at 06:00 UTC and posts to /ingest/observations.");
  });
  it("says no cart sample yet, with the job schedule", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    expect(html).toContain("No cart sample yet. The job runs daily at 04:30 UTC: 20 options, every cart abandoned at once.");
  });
  it("says no delta sync yet, naming the next run", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    expect(html).toContain(`No delta sync has finished yet. The next one runs at ${nextDeltaText(NOW)}; its price changes appear here.`);
  });
  it("names the source of every schedule sentence instead of saying 'no data'", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: EMPTY_REPORT, now: NOW });
    expect(html).not.toContain("no data");
    expect(html).not.toContain("No data yet");
    expect(html).not.toContain("not working yet");
  });
});

describe("renderPriceTruth, full report", () => {
  it("states the fail verdict in the hero (today's counts, bold) and a different sentence in the banner", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('class="verdict verdict--fail"');
    expect(html).toContain("Mismatched");
    // the hero's lead is verdictOf's own sentence, cart named first, its two counts bold
    expect(html).toContain("<strong>19 of 20</strong> carts on 2026-09-30");
    expect(html).toContain("<strong>7 of 10</strong> listing pages on 2026-09-30");
    // the banner names the newest sample's own day, never "today" (CEO review 1), then the 30 day shape
    expect(html).toContain("1 of 20 carts and 1 of 10 pages disagreed with the API on 30 Sep.");
    expect(html).toContain("In 30 days, 1 of 20 carts and 1 of 10 pages did.");
    expect(html).toContain("Carts, 30 days");
    expect(html).toContain("Pages, 30 days");
  });
  it("states the pass verdict in the hero with bold counts, and a no-disagreement sentence with 30-day rates in the banner", async () => {
    const report = fullReport();
    const pass: PriceTruthReport = { ...report, cartSamples: [cartDay({})], publicComparison: [publicDay({})] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: pass, now: NOW });
    expect(html).toContain('class="verdict verdict--pass"');
    expect(html).toContain("Matched");
    expect(html).toContain("<strong>20 of 20</strong> carts on 2026-09-30");
    expect(html).toContain("<strong>10 of 10</strong> listing pages on 2026-09-30");
    expect(html).toContain("No cart and no page disagreed with the API on 30 Sep.");
    expect(html).toContain("In 30 days, 0 of 20 carts and 0 of 10 pages did.");
  });
  it("never claims 'today' in the banner, and says when today's sample runs while the newest one is from a day before now", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: Date.UTC(2026, 9, 1, 3, 3) });
    expect(html).not.toContain("disagreed with the API today");
    expect(html).toContain("disagreed with the API on 30 Sep.");
    expect(html).toContain("Today&#39;s cart sample runs at 04:30 UTC; the public comparison at 06:00 UTC.");
  });
  it("names how many of the last 30 days had a sample, in the figure's label, and keeps the rate alone in its value", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Carts, 30 days, 1 sampled");
    expect(html).toContain('<span class="figure-value">95.0 %</span>');
    expect(html).toContain("Pages, 30 days, 1 sampled");
    expect(html).toContain('<span class="figure-value">90.0 %</span>');
  });
  it("names how the carts are chosen and which pages the public comparison reads, in the banner", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Carts are 20 sellable options of listable products, drawn per UTC day");
    expect(html).toContain("the public comparison reads the groupon.com listing page of each matched deal.");
  });
  it("gives the hero and the banner different sentences", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    const lead = html.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1];
    const bannerText = html.match(/<p class="verdict-text">([\s\S]*?)<\/p>/)?.[1];
    expect(lead).toBeTruthy();
    expect(bannerText).toBeTruthy();
    expect(lead).not.toBe(bannerText);
  });
  it("shows the page's tiles row as carts matched, pages matched, since a mismatch and changes today", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('<div class="tiles tiles--panel">');
    expect(html).toContain('<div class="tile tile--fail tile--lead">');
    expect(html).toContain("Carts matched");
    expect(html).toContain('<span class="tile-value">19 of 20</span>');
    expect(html).toContain("Pages matched");
    expect(html).toContain('<span class="tile-value">7 of 10</span>');
    expect(html).toContain("Since a mismatch");
    expect(html).toContain("Changes today");
    expect(html).toContain('<span class="tile-value">12</span>');
    expect(html).not.toContain("Share with a promo");
    expect(html).not.toContain("Total gap");
  });
  it("shows days since the first sample when no mismatch has happened yet, naming that day short in the hint", async () => {
    const report: PriceTruthReport = { ...fullReport(), cartSamples: [cartDay({})], publicComparison: [publicDay({})] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: Date.UTC(2026, 9, 1, 10, 0) });
    expect(html).toContain('<span class="tile-value">1 day</span>');
    expect(html).toContain("no mismatch since 30 Sep");
    expect(html).not.toContain("No mismatch yet");
    expect(html).not.toContain("the first sample on");
  });
  it("names one delta sync in the singular when only one complete delta run started today", async () => {
    const sync = syncWith(syncRun({ startedAt: "2026-09-30T00:10:00.000Z", finishedAt: "2026-09-30T00:11:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: Date.UTC(2026, 8, 30, 1, 0) });
    expect(html).toContain("1 delta sync so far");
    expect(html).not.toContain("1 delta syncs so far");
  });
  it("counts a delta sync from a day before now as not run today", async () => {
    const sync = syncWith(syncRun({ startedAt: "2026-09-29T21:00:00.000Z", finishedAt: "2026-09-29T21:01:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: Date.UTC(2026, 8, 30, 1, 0) });
    expect(html).toContain("0 delta syncs so far");
  });
  it("shows the promo-gap figures, the histogram and the largest-gaps list", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("carry a promo code");
    expect(html).toContain("median");
    expect(html).toContain("The 3 largest gaps"); // fullReport's worst has 3 deals, all shown
    expect(html).toContain("1,316"); // listableOptions, comma-formatted
    expect(html).toContain("Hydrafacial at Glow Studio");
    expect(html).toContain("/deals/p-1");
    expect(html).toContain("GLOW15");
    // histogram bands come from report.gapBands, not the worst list
    expect(html).toContain("0 to 5 %");
    expect(html).toContain("over 40 %");
    expect(html).toContain("Every sellable option with a promo, by gap between the shown price and the price with the code.");
  });
  it("says the gap distribution is pending when gapBands is empty, with no gap-band histogram", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: { ...fullReport(), gapBands: [] }, now: NOW });
    expect(html).toContain("Snapshot of 30 Sep, 04:30 UTC.");
    expect(html).toContain("The distribution follows the next promo-gap snapshot, daily at 04:30 UTC.");
    expect(html).not.toContain("0 to 5 %");
    expect(html).not.toContain('class="histogram"');
    // the catalogue caption still states the snapshot's own count (CEO review 2: it stays)
    expect(html).toContain("500 of 1,316 sellable options carry a promo code.");
  });
  it("says the gap distribution is pending, with no 0-count bars, when the bands do not sum to the snapshot's promo count", async () => {
    const report = fullReport();
    const mismatched = report.gapBands.map((band, i) => (i === 0 ? { ...band, options: band.options + 1 } : band));
    expect(mismatched.reduce((sum, b) => sum + b.options, 0)).not.toBe(report.latest!.optionsWithPromo);
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: { ...report, gapBands: mismatched }, now: NOW });
    expect(html).toContain("Snapshot of 30 Sep, 04:30 UTC.");
    expect(html).toContain("The distribution follows the next promo-gap snapshot, daily at 04:30 UTC.");
    expect(html).not.toContain("0 to 5 %");
    expect(html).not.toContain('class="histogram"');
    expect(html).toContain("500 of 1,316 sellable options carry a promo code.");
  });
  it("ranks the largest gaps with the retail as You pay and the gap only, the promo price never a price", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('<span class="rank-pay" data-label="You pay">$99.00</span>');
    expect(html).toContain('<a href="/deals/p-1">Hydrafacial at Glow Studio</a>');
    expect(html).not.toContain('data-label="With code"');
    expect(html).not.toContain('data-label="Code"');
    expect(html).not.toContain('data-label="You pay">$84.15');
    // the promo price lives only in the row's own promo line
    expect(html).toContain('<span class="promo-line">Type code GLOW15 at Groupon checkout to pay $84.15.</span>');
    // two worst deals share that promo price, each inside its own line and nowhere else
    expect(html.split("$84.15").length - 1).toBe(2);
    expect((html.match(/class="promo-line"/g) ?? []).length).toBe(2);
    expect(html).not.toContain("promo-notes");
  });
  it("gives a deal with no promo code no promo line", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    // worst[2] ("Ten Yoga Classes...") has promoCode: null, rank 3
    const yoga = html.split('<div class="rank-row" data-rank="3">')[1]?.split("</div>")[0] ?? "";
    expect(yoga).toContain("Ten Yoga Classes at Sunrise Yoga");
    expect(yoga).not.toContain("promo-line");
  });
  it("shows at most 8 of the largest gaps, each with its promo line", async () => {
    const many = Array.from({ length: 50 }, (_, i) => worstDeal({ title: `Deal number ${i + 1}`, productId: `p-${i + 1}`, promoCode: `CODE${i + 1}` }));
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: { ...fullReport(), worst: many }, now: NOW });
    expect(html).toContain("The 8 largest gaps");
    expect((html.match(/class="rank-row"/g) ?? []).length).toBe(8);
    expect((html.match(/class="promo-line"/g) ?? []).length).toBe(8);
    expect(html).not.toContain("Deal number 9");
  });
  it("puts the catalogue's promo-gap summary as the Options-by-gap box's own note", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('<p class="box-note">500 of 1,316 sellable options carry a promo code.');
  });
  it("names the snapshot's own day and time, and when the next one is taken", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    // fullReport's snapshot.takenAt is "2026-09-30T04:30:00.000Z"
    expect(html).toContain("Snapshot of 30 Sep, 04:30 UTC; the next at 04:30 UTC.");
  });
  it("shows the catalogue total when the gap bands sum to the snapshot's optionsWithPromo", async () => {
    const report = fullReport();
    const bandsSum = report.gapBands.reduce((sum, band) => sum + band.options, 0);
    expect(bandsSum).toBe(report.latest!.optionsWithPromo); // the fixture's own bands already reconcile
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("500 of 1,316 sellable options carry a promo code.");
  });
  it("draws 30 cart strip squares, one per calendar day, with a 'No sample' square where none ran", async () => {
    const report: PriceTruthReport = {
      ...fullReport(),
      cartSamples: [cartDay({ day: "2026-09-30" }), cartDay({ day: "2026-09-11", matched: 19, priceMismatch: 1 })],
    };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    const stripMatch = html.match(/<div class="day-strip-days">(.*?)<\/div>/);
    const squares = stripMatch?.[1]?.match(/<span class="day day--(pass|fail|none)"/g) ?? [];
    expect(squares.length).toBe(30);
    expect(html).toContain('title="11 Sep: Mismatched"');
    expect(html).toContain('title="1 Sep: No sample"');
    expect(html).toContain("<span>1 Sep</span><span>30 Sep</span>");
  });
  it("draws one strip square per public day, with the day's tone and a short date in the title", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('title="30 Sep: Mismatched"');
    expect(html).toContain('class="day day--fail"');
  });
  it("shows the cart-sample latest-day figures with the short date, and no per-day table", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Latest day: 30 Sep");
    expect(html).not.toContain("Latest day: 2026-09-30");
    expect(html).toContain("20 carts sampled");
    expect(html).not.toContain('data-label="Price mismatch"');
  });
  it("names a single sampled cart in the singular", async () => {
    const report: PriceTruthReport = { ...fullReport(), cartSamples: [cartDay({ sampled: 1, matched: 1 })] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("1 cart sampled");
    expect(html).not.toContain("1 carts sampled");
  });
  it("puts the cart strip in a 'Last 30 days' card beside the 'Latest day' card, with the last mismatch named", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Last 30 days: 19 of 20 carts matched");
    expect(html).toContain("Last mismatch on 2026-09-30: 1 of 20 carts charged a price the API did not quote.");
    expect(html).toContain('<div class="side-boxes">');
  });
  it("names the one sampled day, not a full month, when no cart has mismatched", async () => {
    const report: PriceTruthReport = { ...fullReport(), cartSamples: [cartDay({ matched: 20, priceMismatch: 0 })] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("No mismatch on the 1 sampled day of the last 30.");
    expect(html).not.toContain("No mismatch in the last 30 days.");
  });
  it("counts two sampled cart days in the plural when neither mismatched", async () => {
    const report: PriceTruthReport = {
      ...fullReport(),
      cartSamples: [cartDay({ day: "2026-09-29", matched: 20, priceMismatch: 0 }), cartDay({ day: "2026-09-30", matched: 20, priceMismatch: 0 })],
    };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("No mismatch on the 2 sampled days of the last 30.");
  });
  it("bolds the cart and the public Latest day card's count line", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("<p><strong>20 carts sampled</strong></p>");
    expect(html).toContain("<p><strong>10 listing pages</strong></p>");
  });
  it("shows the public-comparison latest-day figures with the short date, and no per-day table", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Latest day: 30 Sep");
    expect(html).not.toContain("Latest day: 2026-09-30");
    expect(html).toContain("10 listing pages");
    expect(html).toContain("Showed the price you pay");
    expect(html).not.toContain('data-label="Shows retail"');
  });
  it("names a single matched listing page in the singular", async () => {
    const report: PriceTruthReport = { ...fullReport(), publicComparison: [publicDay({ matchedDeals: 1, showsRetail: 1 })] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("1 listing page</strong>");
    expect(html).not.toContain("1 listing pages");
  });
  it("puts the public strip in a 'Last 30 days' card beside the 'Latest day' card, with the last mismatch named", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Last 30 days: 7 of 10 pages matched");
    expect(html).toContain("Last mismatch on 2026-09-30: 1 of 10 pages showed another price.");
  });
  it("names the one sampled day, not a full month, when no public page has shown another price", async () => {
    const report: PriceTruthReport = { ...fullReport(), publicComparison: [publicDay({ showsOther: 0, showsRetail: 10 })] };
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report, now: NOW });
    expect(html).toContain("No mismatch on the 1 sampled day of the last 30.");
  });
  it("shows the freshness column chart with today's price changes", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('<div class="column-chart">');
    expect(html).toContain("30 Sep");
    expect(html).toContain("12");
  });
  it("names the next delta sync in the freshness section and in the foot line", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    const matches = html.match(new RegExp(nextDeltaText(NOW), "g")) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
  it("shows a 'Price changes per day' card with the peak day, beside a 'Next sync' card, and no History table", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("Price changes per day, last 30 days");
    expect(html).toContain("Peak 12 on 30 Sep");
    expect(html).toContain(`Next sync: ${nextDeltaText(NOW)}`);
    expect(html).toContain("Delta syncs today");
    expect(html).toContain("Last full load");
    expect(html).not.toContain(">History<");
  });
  it("gives the column chart's axis a 'so far' day when the window ends today", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("<span>1 Sep</span><span>30 Sep, so far</span>");
  });
  it("draws 30 freshness columns, one per calendar day, with a zero-height column where no sync landed", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    const chartMatch = html.match(/<div class="column-chart-bars">(.*?)<\/div>/);
    const columns = chartMatch?.[1]?.match(/<span class="column-chart-bar"/g) ?? [];
    expect(columns.length).toBe(30);
    expect(html).toContain('title="1 Sep: 0"');
    expect(html).toContain('title="30 Sep: 12"');
  });
  it("states the full-load schedule as a fact, with no claim about Monday counts", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("The weekly full load runs on Mondays at 05:00 UTC.");
    expect(html).not.toContain("higher");
  });
  it("bolds the Next sync card's schedule line and names the minutes to the next run", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain("<p><strong>Delta sync every 3 hours</strong></p>");
    expect(html).toContain("In 20 minutes."); // NOW is 11:40 UTC, the next boundary is 12:00
  });
  it("never prints a raw ISO timestamp", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it("marks the Price truth nav link current", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).toContain('<a href="/price-truth" aria-current="page">Price truth</a>');
  });
  it("escapes a deal title that carries HTML", async () => {
    const report = fullReport();
    const worst = [worstDeal({ title: "<script>alert(1)</script>" }), ...report.worst.slice(1)];
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: { ...report, worst }, now: NOW });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
  it("never says 'no data'", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW });
    expect(html).not.toContain("no data");
    expect(html).not.toContain("No data");
  });
});

// CEO review 1, loop 5: the Next sync card reads the recorded sync runs, never clock or cron
// arithmetic, so Price truth and the Scorecard cannot disagree about what actually happened.
describe("Next sync card, recorded sync runs", () => {
  const NOW_1310 = Date.UTC(2026, 8, 30, 13, 10); // 70 minutes past the 12:00 UTC boundary

  it("shows the newest complete delta run's own finish time, with no note line", async () => {
    const sync = syncWith(syncRun({ startedAt: "2026-09-30T12:00:00.000Z", finishedAt: "2026-09-30T12:05:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last delta sync</dt><dd>12:05 UTC</dd>");
    expect(html).not.toContain("<p>Running since");
    expect(html).not.toContain("<p>Failed at");
    expect(html).not.toContain("<p>Late:");
  });

  it("names the short day alongside the time when the last complete run is not from today", async () => {
    const sync = syncWith(syncRun({ startedAt: "2026-09-29T12:00:00.000Z", finishedAt: "2026-09-29T12:05:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: Date.UTC(2026, 8, 30, 12, 10) });
    expect(html).toContain("<dt>Last delta sync</dt><dd>29 Sep, 12:05 UTC</dd>");
  });

  it("adds a newer running delta run as its own line under the card's rows", async () => {
    const sync = syncWith(
      syncRun({ runId: "r-done", startedAt: "2026-09-30T12:00:00.000Z", finishedAt: "2026-09-30T12:05:00.000Z" }),
      syncRun({ runId: "r-running", status: "running", startedAt: "2026-09-30T12:50:00.000Z", finishedAt: null }),
    );
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last delta sync</dt><dd>12:05 UTC</dd>");
    expect(html).toContain("<p>Running since 12:50 UTC.</p>");
  });

  it("adds a newer failed delta run as its own line under the card's rows", async () => {
    const sync = syncWith(
      syncRun({ runId: "r-done", startedAt: "2026-09-30T12:00:00.000Z", finishedAt: "2026-09-30T12:05:00.000Z" }),
      syncRun({ runId: "r-failed", status: "failed", startedAt: "2026-09-30T12:50:00.000Z", finishedAt: "2026-09-30T13:00:00.000Z" }),
    );
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last delta sync</dt><dd>12:05 UTC</dd>");
    expect(html).toContain("<p>Failed at 13:00 UTC.</p>");
  });

  it("names a late sync, as its own line under the card's rows, when the latest boundary passed more than 30 minutes ago with no run since", async () => {
    const sync = syncWith(syncRun({ startedAt: "2026-09-30T09:00:00.000Z", finishedAt: "2026-09-30T09:05:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last delta sync</dt><dd>09:05 UTC</dd>");
    expect(html).toContain("<p>Late: the 12:00 UTC sync has not started.</p>");
  });

  it("says 'none yet' with no complete delta run, inside the 30 minute grace period", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: Date.UTC(2026, 8, 30, 12, 10) });
    expect(html).toContain("<dt>Last delta sync</dt><dd>none yet</dd>");
  });

  it("counts only complete delta runs started today for 'Delta syncs today'", async () => {
    const sync = syncWith(
      syncRun({ runId: "a", startedAt: "2026-09-30T00:10:00.000Z", finishedAt: "2026-09-30T00:11:00.000Z" }),
      syncRun({ runId: "b", startedAt: "2026-09-30T09:00:00.000Z", finishedAt: "2026-09-30T09:01:00.000Z" }),
      syncRun({ runId: "c", startedAt: "2026-09-29T09:00:00.000Z", finishedAt: "2026-09-29T09:01:00.000Z" }),
      syncRun({ runId: "d", status: "running", startedAt: "2026-09-30T12:50:00.000Z", finishedAt: null }),
    );
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Delta syncs today</dt><dd>2</dd>");
  });

  it("names the newest complete full run's own short day for 'Last full load'", async () => {
    const sync = syncWith(syncRun({ kind: "full", startedAt: "2026-09-28T05:00:00.000Z", finishedAt: "2026-09-28T05:40:00.000Z" }));
    const html = await renderPriceTruth({ sync, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last full load</dt><dd>28 Sep</dd>");
  });

  it("says 'none yet' for a kind with no complete run", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW_1310 });
    expect(html).toContain("<dt>Last full load</dt><dd>none yet</dd>");
  });

  it("labels the next sync as scheduled", async () => {
    const html = await renderPriceTruth({ sync: EMPTY_SYNC, report: fullReport(), now: NOW_1310 });
    expect(html).toContain(`Next sync: ${nextDeltaText(NOW_1310)}, scheduled`);
  });
});
