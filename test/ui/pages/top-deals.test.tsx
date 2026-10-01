/**
 * The Top deals page: the sentence picker, the tiles, the podium, the ranked table and the promo
 * promo lines, for every case the report can be in. Round 2 of loop 5: built from the shared hero,
 * pickerCard, resultsHead, rankList/rankRow, promoLine and pageFoot blocks.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/top-deals.test.tsx
 * Deps:    bun:test, src/ui/pages/top-deals.tsx, src/contracts/reports.ts, src/contracts/ports.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { PromoNote } from "../../../src/contracts/ports";
import type { TopDealRow, TopDealsReport } from "../../../src/contracts/reports";
import { categoryName, placeText, renderTopDeals, TOP_N, topDealsHref } from "../../../src/ui/pages/top-deals";

const NOW = Date.UTC(2026, 8, 30, 11, 40);

function row(args: {
  rank: number;
  productId: string;
  optionId: string;
  title: string;
  optionTitle: string;
  originalMinor: number;
  payMinor: number;
  promo?: PromoNote | null;
  city?: string;
  state?: string;
  imageUrl?: string | null;
}): TopDealRow {
  const discountMinor = args.originalMinor - args.payMinor;
  return {
    rank: args.rank,
    productId: args.productId,
    optionId: args.optionId,
    title: args.title,
    optionTitle: args.optionTitle,
    city: args.city ?? "New York",
    state: args.state ?? "NY",
    imageUrl: args.imageUrl ?? null,
    currency: "USD",
    precision: 2,
    originalMinor: args.originalMinor,
    payMinor: args.payMinor,
    discountMinor,
    discountShare: discountMinor / args.originalMinor,
    promo: args.promo ?? null,
  };
}

const ESCAPE_ROOM_PROMO: PromoNote = {
  priceMinor: 6320,
  priceText: "$63.20",
  code: "ESCAPE20",
  endsAt: null,
  instruction: "Type code ESCAPE20 at Groupon checkout to pay $63.20. Without it you pay $79.00.",
};

const ROWS: readonly TopDealRow[] = [
  row({ rank: 1, productId: "p-heli", optionId: "o-heli", title: "Helicopter Tour of Manhattan", optionTitle: "15-minute flight for one", originalMinor: 34900, payMinor: 19900 }),
  row({
    rank: 2,
    productId: "p-escape",
    optionId: "o-escape",
    title: "Escape Room for Four at Lockdown NYC",
    optionTitle: "Private room, 60 minutes",
    originalMinor: 14000,
    payMinor: 7900,
    promo: ESCAPE_ROOM_PROMO,
  }),
  row({ rank: 3, productId: "p-comedy", optionId: "o-comedy", title: "Comedy Club Night for Two", optionTitle: "Two tickets and two drinks", originalMinor: 6000, payMinor: 2400 }),
  row({ rank: 4, productId: "p-kayak", optionId: "o-kayak", title: "Kayak Rental on the Hudson", optionTitle: "Two hours, single kayak", originalMinor: 9000, payMinor: 5500 }),
];

function fullReport(overrides: Partial<TopDealsReport> = {}): TopDealsReport {
  return {
    query: { city: "New York", state: "NY", category1: "things-to-do", sort: "amount" },
    cities: [
      { city: "New York", state: "NY", listableProducts: 1603 },
      { city: "Los Angeles", state: "CA", listableProducts: 1152 },
    ],
    categories: [
      { category1: "things-to-do", products: 9812 },
      { category1: "beauty-and-spas", products: 14310 },
    ],
    labels: [
      { label: "Escape Games", products: 652 },
      { label: "Museums & Attractions", products: 471 },
    ],
    rows: ROWS,
    taggedAt: "2026-09-29T00:52:03.000Z",
    citiesRefreshedAt: "2026-09-29T00:10:00.000Z",
    ...overrides,
  };
}

// ------------------------------------------------------------------ topDealsHref, placeText, categoryName

describe("placeText", () => {
  it("joins the city and the state as City, ST", () => {
    expect(placeText("New York", "NY")).toBe("New York, NY");
  });
});

describe("topDealsHref", () => {
  const query = { city: "New York", state: "NY", category1: "things-to-do", label: "Escape Games", sort: "amount" as const };

  it("carries category, label, place and sort", () => {
    expect(topDealsHref(query)).toBe("/?category=things-to-do&label=Escape+Games&place=New+York%2C+NY&sort=amount");
  });

  it("leaves out an absent label", () => {
    const { label, ...rest } = query;
    expect(topDealsHref(rest)).not.toContain("label=");
  });

  it("applies the patch over the query", () => {
    expect(topDealsHref(query, { sort: "percent" })).toContain("sort=percent");
    expect(topDealsHref(query, { city: "Miami", state: "FL" })).toContain("place=Miami%2C+FL");
  });
});

describe("categoryName", () => {
  it("names the known slugs", () => {
    expect(categoryName("things-to-do")).toBe("Things To Do");
    expect(categoryName("beauty-and-spas")).toBe("Beauty & Spas");
    expect(categoryName("baby-kids-and-toys")).toBe("Baby, Kids & Toys");
    expect(categoryName("mens-clothing-shoes-and-accessories")).toBe("Men's Clothing, Shoes & Accessories");
    expect(categoryName("womens-clothing-shoes-and-accessories")).toBe("Women's Clothing, Shoes & Accessories");
    expect(categoryName("v1-personalized-items")).toBe("Personalized Items");
  });

  it("title-cases an unknown slug, with and as &", () => {
    expect(categoryName("pet-services-and-training")).toBe("Pet Services & Training");
  });
});

// ------------------------------------------------------------------ empty cases

describe("renderTopDeals, no city loaded", () => {
  it("says no deals are loaded yet, with the schedule, when there is no city", async () => {
    const html = await renderTopDeals({ report: fullReport({ cities: [], query: null }), now: NOW });
    expect(html).toContain("No deals are loaded yet. The full catalogue load runs every Monday 05:00 UTC and a delta sync every 3 hours; the city list follows at 00:30 UTC.");
  });

  it("never says no data", async () => {
    const html = await renderTopDeals({ report: fullReport({ cities: [], query: null }), now: NOW });
    expect(html.toLowerCase()).not.toContain("no data");
  });
});

describe("renderTopDeals, no category walk yet", () => {
  it("says categories appear after the first category walk, with its time, when nothing is tagged", async () => {
    const html = await renderTopDeals({ report: fullReport({ query: null, categories: [], taggedAt: null }), now: NOW });
    expect(html).toContain("Categories appear after the first category walk, tonight at 00:30 UTC.");
  });

  it("says the same when the query is known but no category has been tagged", async () => {
    const html = await renderTopDeals({ report: fullReport({ categories: [], taggedAt: null }), now: NOW });
    expect(html).toContain("Categories appear after the first category walk, tonight at 00:30 UTC.");
  });

  it("gives the walk state a next step, worded with no closing period", async () => {
    const html = await renderTopDeals({ report: fullReport({ query: null, categories: [], taggedAt: null }), now: NOW });
    expect(html).toContain('<a class="empty-link" href="/">Show the top 20 after the walk</a>');
  });
});

// ------------------------------------------------------------------ the picker

describe("renderTopDeals, the picker", () => {
  it("shows the sentence picker with the chosen city, category and tag selected, and a Show button", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain('<form class="picker-card" method="get" action="/" autocomplete="off" data-1p-ignore>');
    expect(html).toContain("Top 20 deals");
    expect(html).toContain(">in<");
    expect(html).toContain(">for<");
    expect(html).toContain(">within<");
    expect(html).toContain(">Show<");
  });

  it("offers only the tags of the chosen category, with any tag first", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    const anyIndex = html.indexOf("any tag");
    const escapeIndex = html.indexOf("Escape Games");
    const museumsIndex = html.indexOf("Museums &amp; Attractions");
    expect(anyIndex).toBeGreaterThan(-1);
    expect(escapeIndex).toBeGreaterThan(anyIndex);
    expect(museumsIndex).toBeGreaterThan(anyIndex);
  });

  it("keeps the sort in a hidden field so a new pick keeps the current sort", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain('<input type="hidden" name="sort" value="amount">');
  });

  it("names the city's deal count and the category's count in the picker note", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain(
      "New York, NY holds 1,603 listable deals, 9,812 of them in Things To Do. A tag narrows the category to one of Groupon&#39;s own deal tags, such as Food Tours. The lists offer the 2 cities with the most deals and the 2 categories with deals in New York, NY.",
    );
  });

  it("names the category count for the chosen city, not a fixed phrase, with two categories in the city", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("the 2 categories with deals in New York, NY.");
    expect(html).not.toContain("Groupon's top categories");
    expect(html).not.toContain("Groupon&#39;s top categories");
  });

  it("keeps an asked city outside the top 50 as the selected option", async () => {
    const report = fullReport({ query: { city: "Topeka", state: "KS", category1: "things-to-do", sort: "amount" } });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("Topeka, KS");
  });
});

// ------------------------------------------------------------------ tiles

describe("renderTopDeals, tiles", () => {
  it("places the tiles row between the picker and the results head", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    const pickerIndex = html.indexOf('class="picker-card"');
    const tilesIndex = html.indexOf('class="tiles');
    const resultsIndex = html.indexOf('class="results-head"');
    expect(pickerIndex).toBeGreaterThan(-1);
    expect(tilesIndex).toBeGreaterThan(pickerIndex);
    expect(resultsIndex).toBeGreaterThan(tilesIndex);
  });

  it("computes the four tiles from the rows", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("Biggest saving");
    expect(html).toContain("$150.00");
    expect(html).toContain("Helicopter Tour of Manhattan");
    expect(html).toContain("Typical saving");
    expect(html).toContain("43.3 %");
    expect(html).toContain("Total saving");
    expect(html).toContain("$282.00");
    expect(html).toContain("buying one of each");
    expect(html).toContain("Promo codes");
    expect(html).toContain("1 of 4");
  });
});

// ------------------------------------------------------------------ the results

describe("renderTopDeals, results with rows", () => {
  it("says Top 20 when twenty rows came back, All N when fewer", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("All 4 discounted deals in New York, NY: Things To Do");

    const twenty = Array.from({ length: TOP_N }, (_, i) => row({ rank: i + 1, productId: `p-${i}`, optionId: `o-${i}`, title: `Deal ${i}`, optionTitle: "Option", originalMinor: 10000, payMinor: 5000 }));
    const html20 = await renderTopDeals({ report: fullReport({ rows: twenty }), now: NOW });
    expect(html20).toContain("Top 20 in New York, NY: Things To Do");
  });

  it("names the label and the category in the heading when a label is chosen", async () => {
    const report = fullReport({ query: { city: "New York", state: "NY", category1: "things-to-do", label: "Escape Games", sort: "amount" } });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("Escape Games (Things To Do)");
  });

  it("draws ranks 1 to 3 as podium cards with rank 1 as the winner, and rank 4 on as ranked rows", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain('data-rank="1"');
    expect(html).toContain('data-rank="2"');
    expect(html).toContain('data-rank="3"');
    expect(html).toContain('<div class="rank-row" data-rank="4">');
    expect(html).toContain("Kayak Rental on the Hudson");
  });

  it("shows the original struck and the price to pay, and nothing else as a price in a row or card", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("$79.00");
    expect(html).toContain("$140.00");
    // the promo price only ever appears inside the promo line
    expect(html.split("$63.20").length - 1).toBe(1);
    expect(html).toContain('<span class="promo-line">Type code ESCAPE20 at Groupon checkout to pay $63.20.</span>');
  });

  it("shows the saving in money and in percent, with the bar, on every ranked row", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain('<span class="rank-save" data-label="You save">$35.00</span>');
  });

  it("marks the amount sort current by default and links the percent sort with the same pickers", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("/?category=things-to-do&amp;place=New+York%2C+NY&amp;sort=percent");
  });

  it("marks the percent sort current when asked", async () => {
    const report = fullReport({ query: { city: "New York", state: "NY", category1: "things-to-do", sort: "percent" } });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("/?category=things-to-do&amp;place=New+York%2C+NY&amp;sort=amount");
  });

  it("names the order and the refresh in the results note", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain("Ordered by the amount you save, largest first; one row per deal · Refreshes every 3 hours");
  });

  it("names the percent order when sorted by percent", async () => {
    const report = fullReport({ query: { city: "New York", state: "NY", category1: "things-to-do", sort: "percent" } });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("Ordered by the percent you save, largest first; one row per deal");
  });

  it("puts the promo line only under the row that carries a promo, and no footnote list anywhere", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect((html.match(/class="promo-line"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("promo-notes");
    expect(html).not.toContain('class="footnotes"');
  });

  it("renders no promo line when no row carries a promo", async () => {
    const noPromoRows = ROWS.map((r) => ({ ...r, promo: null }));
    const html = await renderTopDeals({ report: fullReport({ rows: noPromoRows }), now: NOW });
    expect(html).not.toContain('class="promo-line"');
  });

  it("labels every price cell for the phone layout", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain('data-label="Original"');
    expect(html).toContain('data-label="You pay"');
    expect(html).toContain('data-label="You save"');
    expect(html).toContain('data-label="Saved"');
  });

  it("never says no data", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html.toLowerCase()).not.toContain("no data");
  });
});

describe("renderTopDeals, podium labelling", () => {
  it("gives the Biggest saving pill to whichever podium card the tile names, not always the winner", async () => {
    const customRows: readonly TopDealRow[] = [
      row({ rank: 1, productId: "p-comedy", optionId: "o-comedy", title: "Comedy Club Night for Two", optionTitle: "Two tickets", originalMinor: 6000, payMinor: 2400 }),
      row({ rank: 2, productId: "p-heli", optionId: "o-heli", title: "Helicopter Tour of Manhattan", optionTitle: "Flight", originalMinor: 34900, payMinor: 19900 }),
      row({ rank: 3, productId: "p-kayak", optionId: "o-kayak", title: "Kayak Rental on the Hudson", optionTitle: "Two hours", originalMinor: 9000, payMinor: 5500 }),
    ];
    const report = fullReport({ rows: customRows, query: { city: "New York", state: "NY", category1: "things-to-do", sort: "percent" } });
    const html = await renderTopDeals({ report, now: NOW });
    const card1 = html.slice(html.indexOf('data-rank="1"'), html.indexOf('data-rank="2"'));
    const card2 = html.slice(html.indexOf('data-rank="2"'), html.indexOf('data-rank="3"'));
    expect(card1).not.toContain("Biggest saving");
    expect(card2).toContain("Biggest saving");
  });
});

describe("renderTopDeals, no discounted deal", () => {
  it("suggests the whole category, linked, with no closing period, when a tag has no discounted deal", async () => {
    const report = fullReport({ query: { city: "New York", state: "NY", category1: "things-to-do", label: "Escape Games", sort: "amount" }, rows: [] });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("No discounted deals in New York, NY for Escape Games.");
    expect(html).toContain('<a class="empty-link" href="/?category=things-to-do&amp;place=New+York%2C+NY&amp;sort=amount">Try the whole of Things To Do</a>');
  });

  it("suggests the next city, linked, with no closing period, when the whole category has no discounted deal here", async () => {
    const report = fullReport({ rows: [] });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain("No discounted deals in New York, NY for Things To Do.");
    expect(html).toContain('<a class="empty-link" href="/?category=things-to-do&amp;place=Los+Angeles%2C+CA&amp;sort=amount">Try Los Angeles, CA</a>');
  });

  it("offers no link when there is no other city", async () => {
    const report = fullReport({ rows: [], cities: [{ city: "New York", state: "NY", listableProducts: 1603 }] });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).toContain('<div class="empty">No discounted deals in New York, NY for Things To Do.</div>');
  });
});

// ------------------------------------------------------------------ freshness, escaping, nav

describe("renderTopDeals, freshness", () => {
  it("names when prices refresh, then when the tags refresh", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toContain(
      "Prices refresh every 3 hours; the next delta sync runs at 12:00 UTC. The city list and the category tags refresh daily at 00:30 UTC; last walk 2026-09-29 00:52 UTC.",
    );
  });

  it("says first walk pending when taggedAt is null", async () => {
    const html = await renderTopDeals({ report: fullReport({ taggedAt: null }), now: NOW });
    expect(html).toContain("The city list and the category tags refresh daily at 00:30 UTC; first walk pending.");
  });
});

describe("renderTopDeals, escaping", () => {
  it("escapes a deal title, a tag and a city that carry HTML", async () => {
    const dirtyRows = [row({ rank: 1, productId: "p-1", optionId: "o-1", title: '<script>alert("t")</script>', optionTitle: "Option", originalMinor: 1000, payMinor: 500 })];
    const report = fullReport({
      rows: dirtyRows,
      query: { city: "<img src=x>", state: "NY", category1: "things-to-do", label: "<b>lbl</b>", sort: "amount" },
    });
    const html = await renderTopDeals({ report, now: NOW });
    expect(html).not.toContain("<script>alert(");
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain("<b>lbl</b>");
  });
});

describe("renderTopDeals, nav", () => {
  it("marks the Top deals nav link current", async () => {
    const html = await renderTopDeals({ report: fullReport(), now: NOW });
    expect(html).toMatch(/<a href="\/" aria-current="page">Top deals<\/a>/);
  });
});
