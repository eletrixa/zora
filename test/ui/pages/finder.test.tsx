/**
 * Find a deal: the sentence picker shared with Top deals, the tiles, the deal grid and its
 * promo lines, for every case the page can be in.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/finder.test.tsx
 * Deps:    bun:test, src/ui/pages/finder.tsx, src/contracts/pages.ts, src/contracts/ports.ts,
 *          src/contracts/reports.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { finderHref, renderFinder } from "../../../src/ui/pages/finder";
import type { FinderPageProps } from "../../../src/contracts/pages";
import type { DealCard, PromoNote } from "../../../src/contracts/ports";
import type { TopCategory, TopCity } from "../../../src/contracts/reports";

const CITIES: readonly TopCity[] = [
  { city: "New York", state: "NY", listableProducts: 1603 },
  { city: "Chicago", state: "IL", listableProducts: 809 },
];

const CATEGORIES: readonly TopCategory[] = [
  { category1: "things-to-do", products: 9812 },
  { category1: "beauty-and-spas", products: 14310 },
];

function card(args: { title: string; optionTitle: string; listPriceMinor: number; payMinor: number; promo?: PromoNote | null }): DealCard {
  return {
    productId: args.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    optionId: "o1",
    title: args.title,
    optionTitle: args.optionTitle,
    city: "Chicago",
    state: "IL",
    imageUrl: null,
    currency: "USD",
    precision: 2,
    listPriceMinor: args.listPriceMinor,
    payMinor: args.payMinor,
    payText: `$${(args.payMinor / 100).toFixed(2)}`,
    promo: args.promo ?? null,
  };
}

const MASSAGE = card({
  title: "Swedish Massage at Foot Smile Spa",
  optionTitle: "60-Minute Swedish Massage",
  listPriceMinor: 9000,
  payMinor: 4900,
  promo: {
    priceMinor: 3920,
    priceText: "$39.20",
    code: "SAVE20",
    endsAt: null,
    instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.",
  },
});

const OIL_CHANGE = card({
  title: "Oil Change at QuickLube",
  optionTitle: "Full-Synthetic Oil Change",
  listPriceMinor: 8999,
  payMinor: 4499,
});

const baseProps: FinderPageProps = {
  query: { text: "" },
  searched: false,
  cards: [],
  listableDeals: 20,
  featuredTheme: "massage",
  cities: CITIES,
  categories: CATEGORIES,
  now: Date.UTC(2026, 8, 30, 13, 20),
};

async function render(props: FinderPageProps): Promise<string> {
  return renderFinder(props);
}

describe("renderFinder picker", () => {
  it("shows the sentence picker with anywhere, anything and any price first, the chosen place, category and price selected, and a Search button", async () => {
    const html = await render({
      ...baseProps,
      query: { text: "massage", city: "Chicago", state: "IL", category1: "beauty-and-spas", maxPriceMinor: 10000 },
      searched: true,
      cards: [MASSAGE],
    });
    expect(html).toContain('<option value="">anywhere</option>');
    expect(html).toContain('<option value="">anything</option>');
    expect(html).toContain('<option value="">any price</option>');
    expect(html).toContain('<option value="Chicago, IL" selected>Chicago, IL</option>');
    expect(html).toContain('<option value="beauty-and-spas" selected>Beauty &amp; Spas</option>');
    expect(html).toContain('<option value="100" selected>$100</option>');
    expect(html).toContain(">Search<");
    expect(html).toContain('autocomplete="off"');
    expect(html).toContain("data-1p-ignore");
    expect(html).not.toContain('type="password"');
  });

  it("offers the same cities and categories as the props, as City, ST values and category1 slugs with their names", async () => {
    const html = await render(baseProps);
    expect(html).toContain('<option value="New York, NY">New York, NY</option>');
    expect(html).toContain('<option value="Chicago, IL">Chicago, IL</option>');
    expect(html).toContain('<option value="things-to-do">Things To Do</option>');
    expect(html).toContain('<option value="beauty-and-spas">Beauty &amp; Spas</option>');
  });

  it("states the picker rule with real counts: every category offered, a cityless category answering it has none", async () => {
    const html = await render(baseProps);
    expect(html).toContain(
      `The lists offer the ${CITIES.length} cities with the most deals and all ${CATEGORIES.length} of Groupon&#39;s top categories`,
    );
    expect(html).toContain("a category with no deal in the chosen city answers that it has none.");
  });

  it("keeps an asked place, category or price outside the lists as the selected option", async () => {
    const html = await render({
      ...baseProps,
      query: { text: "", city: "Austin", state: "TX", category1: "pet-services", maxPriceMinor: 7500 },
      searched: true,
      cards: [],
    });
    expect(html).toContain('<option value="Austin, TX" selected>Austin, TX</option>');
    expect(html).toContain('<option value="pet-services" selected>Pet Services</option>');
    expect(html).toContain('<option value="75" selected>$75</option>');
  });
});

describe("finderHref", () => {
  it("carries q, place, category and maxPrice, leaves out an empty field and applies a patch", () => {
    const query = { text: "massage", city: "Chicago", state: "IL", category1: "beauty-and-spas", maxPriceMinor: 10000 };
    expect(finderHref(query)).toBe("/find?q=massage&place=Chicago%2C+IL&category=beauty-and-spas&maxPrice=100");
    expect(finderHref({ text: "" })).toBe("/find");
    expect(finderHref(query, { place: "" })).toBe("/find?q=massage&category=beauty-and-spas&maxPrice=100");
    expect(finderHref(query, { maxPriceMinor: undefined })).toBe("/find?q=massage&place=Chicago%2C+IL&category=beauty-and-spas");
    expect(finderHref(query, { category1: "" })).toBe("/find?q=massage&place=Chicago%2C+IL&maxPrice=100");
  });
});

describe("renderFinder results", () => {
  it("opens with Today's picks: <theme> and the cards when nothing was searched", async () => {
    const html = await render({ ...baseProps, cards: [MASSAGE, OIL_CHANGE], featuredTheme: "massage" });
    expect(html).toContain("Today's picks: massage");
    expect(html).toContain(MASSAGE.title);
    expect(html).toContain(OIL_CHANGE.title);
  });

  it("heads the results with the count, the words, the place, the category and the price asked", async () => {
    const html = await render({
      ...baseProps,
      query: { text: "massage", city: "Chicago", state: "IL", category1: "beauty-and-spas", maxPriceMinor: 10000 },
      searched: true,
      cards: [MASSAGE, OIL_CHANGE],
    });
    expect(html).toContain("2 deals for &quot;massage&quot; in Chicago, IL for Beauty &amp; Spas under $100.00");
  });

  it("computes four tiles from the cards: biggest saving, typical saving, cheapest, promo codes", async () => {
    const html = await render({ ...baseProps, query: { text: "massage" }, searched: true, cards: [MASSAGE, OIL_CHANGE] });
    expect(html).toContain("Biggest saving");
    expect(html).toContain("$45.00");
    expect(html).toContain("Typical saving");
    expect(html).toContain("Cheapest");
    expect(html).toContain("$44.99");
    expect(html).toContain(OIL_CHANGE.title);
    expect(html).toContain("Promo codes");
    expect(html).toContain("1 of 2");
    const biggestIndex = html.indexOf("Biggest saving");
    const typicalIndex = html.indexOf("Typical saving");
    const cheapestIndex = html.indexOf("Cheapest");
    const promoIndex = html.indexOf("Promo codes");
    expect(biggestIndex).toBeGreaterThan(-1);
    expect(biggestIndex).toBeLessThan(typicalIndex);
    expect(typicalIndex).toBeLessThan(cheapestIndex);
    expect(cheapestIndex).toBeLessThan(promoIndex);
  });

  it("still shows all four tiles, biggest saving at $0.00, when no card saves anything", async () => {
    const flat = card({ title: "Flat Price Thing", optionTitle: "Standard", listPriceMinor: 5000, payMinor: 5000 });
    const html = await render({ ...baseProps, query: { text: "flat" }, searched: true, cards: [flat] });
    expect(html).toContain("Biggest saving");
    expect(html).toContain("Typical saving");
    expect(html).toContain("Cheapest");
    expect(html).toContain("Promo codes");
  });

  it("marks the biggest-saving card and the cheapest card each with their own pill", async () => {
    const bigSaver = card({ title: "Deep Tissue Weekend", optionTitle: "90-Minute Session", listPriceMinor: 20000, payMinor: 14000 });
    const cheap = card({ title: "Express Facial", optionTitle: "20-Minute Facial", listPriceMinor: 3000, payMinor: 1500 });
    const middle = card({ title: "Standard Massage", optionTitle: "60-Minute Session", listPriceMinor: 6000, payMinor: 4000 });
    const html = await render({ ...baseProps, query: { text: "spa" }, searched: true, cards: [bigSaver, cheap, middle] });
    expect(html).toContain('<span class="save-pill-label">Biggest saving · </span><span class="save-pill-amount" data-label="You save">You save $60.00');
    expect(html).toContain('<span class="save-pill-label">Cheapest · </span><span class="save-pill-amount" data-label="You save">You save $15.00');
    expect(html).not.toContain('<span class="save-pill-label">Biggest saving · </span><span class="save-pill-amount" data-label="You save">You save $15.00');
    expect(html).not.toContain('<span class="save-pill-label">Cheapest · </span><span class="save-pill-amount" data-label="You save">You save $60.00');
  });

  it("puts Refreshes every 3 hours in the results head when cards show, searched or not", async () => {
    const searched = await render({ ...baseProps, query: { text: "massage" }, searched: true, cards: [MASSAGE, OIL_CHANGE] });
    expect(searched).toContain("Refreshes every 3 hours");
    const featured = await render({ ...baseProps, cards: [MASSAGE, OIL_CHANGE], featuredTheme: "massage" });
    expect(featured).toContain("Refreshes every 3 hours");
  });

  it("gives the What field a short placeholder that fits the field, not the long sample sentence", async () => {
    const html = await render(baseProps);
    expect(html).not.toContain("massage, oil change, bowling");
    const match = html.match(/id="q"[^>]*placeholder="([^"]*)"/);
    expect(match).not.toBeNull();
    const words = (match?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
    expect(words.length).toBeGreaterThan(0);
    expect(words.length).toBeLessThanOrEqual(2);
  });

  it("draws the promo as one line under the card that carries it, the promo price only there, and no footnote list", async () => {
    const html = await render({ ...baseProps, query: { text: "massage" }, searched: true, cards: [MASSAGE, OIL_CHANGE] });
    expect(html).toContain('<span class="promo-line">Type code SAVE20 at Groupon checkout to pay $39.20.</span>');
    expect(html.split("$39.20").length - 1).toBe(1);
    expect((html.match(/class="promo-line"/g) ?? []).length).toBe(1);
    expect(html).not.toContain('class="promo-notes"');
  });

  it("renders no promo line when no card carries a promo", async () => {
    const html = await render({ ...baseProps, query: { text: "oil change" }, searched: true, cards: [OIL_CHANGE] });
    expect(html).not.toContain('class="promo-line"');
    expect(html).not.toContain('class="footnotes"');
  });

  it("says no deals are loaded yet, with the schedule, on an empty catalogue, and does not say No deals found", async () => {
    const html = await render({ ...baseProps, listableDeals: 0, searched: true, cards: [], query: { text: "massage" }, featuredTheme: null });
    expect(html).toContain("No deals are loaded yet.");
    expect(html).toContain("Monday 05:00 UTC");
    expect(html).toContain("3 hours");
    expect(html).not.toContain("No deals found");
  });

  it("says no deals were found with the next steps as links (anywhere, any category, any price) and fewer words only for more than one word", async () => {
    const html = await render({
      ...baseProps,
      query: { text: "hot stone couples massage", city: "Chicago", state: "IL", category1: "beauty-and-spas", maxPriceMinor: 5000 },
      searched: true,
      cards: [],
    });
    expect(html).toContain("No deals found for");
    expect(html).toContain(">Try anywhere.<");
    expect(html).toContain(">Try any category.<");
    expect(html).toContain(">Try any price.<");
    expect(html).toContain("Try fewer words.");

    const single = await render({ ...baseProps, query: { text: "zeppelin" }, searched: true, cards: [] });
    expect(single).toContain("No deals found for");
    expect(single).not.toContain("Try fewer words.");
    expect(single).not.toContain("Try anywhere.");
    expect(single).not.toContain("Try any category.");
    expect(single).not.toContain("Try any price.");
  });

  it("answers the empty sentence with a next step when the asked category has no deal in the chosen city", async () => {
    const html = await render({
      ...baseProps,
      query: { text: "", city: "Chicago", state: "IL", category1: "beauty-and-spas" },
      searched: true,
      cards: [],
    });
    expect(html).toContain("No deals found for");
    expect(html).toContain(">Try any category.<");
  });

  it("escapes the words, a title and a city that carry HTML", async () => {
    const xssCard = card({ title: "<script>alert(1)</script>", optionTitle: "Option", listPriceMinor: 1000, payMinor: 500 });
    const html = await render({
      ...baseProps,
      query: { text: '"><script>alert(2)</script>', city: "<b>Chicago</b>", state: "IL" },
      searched: true,
      cards: [xssCard],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).not.toContain("<b>Chicago</b>");
  });

  it("marks the Find a deal nav link current", async () => {
    const html = await render(baseProps);
    expect(html).toContain('aria-current="page"');
  });

  it("ends the foot line with the next delta sync time", async () => {
    const html = await render(baseProps);
    expect(html).toContain("Prices refresh every 3 hours; the next delta sync runs at 15:00 UTC.");
  });

  it("never says no data", async () => {
    const html = await render({ ...baseProps, cards: [MASSAGE, OIL_CHANGE], searched: true, query: { text: "massage" } });
    expect(html.toLowerCase()).not.toContain("no data");
    const empty = await render({ ...baseProps, listableDeals: 0, searched: true, cards: [], query: { text: "massage" } });
    expect(empty.toLowerCase()).not.toContain("no data");
  });
});
