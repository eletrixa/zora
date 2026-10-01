/**
 * Tests for the designed deal page: options, locations, terms, price history and price block.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/deal.test.tsx
 * Deps:    bun:test, src/ui/pages/deal.tsx, src/contracts/ports.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { renderDeal } from "../../../src/ui/pages/deal";
import type { DealDetail, PriceChangeRow } from "../../../src/contracts/ports";

function makeDeal(overrides: Partial<DealDetail> = {}): DealDetail {
  return {
    productId: "p-massage",
    optionId: "o-60",
    title: "Swedish Massage at Foot Smile Spa",
    optionTitle: "60-Minute Swedish Massage",
    city: "Chicago",
    state: "IL",
    imageUrl: null,
    currency: "USD",
    precision: 2,
    listPriceMinor: 8000,
    payMinor: 4900,
    payText: "$49.00",
    promo: null,
    shortDescription: "A 60 or 90 minute Swedish massage that eases sore muscles.",
    description: "Valid for new and returning customers. Appointment required.",
    categoryLabels: ["Spa", "Massage"],
    options: [
      {
        optionId: "o-60",
        title: "60-Minute Swedish Massage",
        sellable: true,
        listPriceMinor: 8000,
        payMinor: 4900,
        payText: "$49.00",
        promo: null,
      },
      {
        optionId: "o-couples",
        title: "Couples Massage",
        sellable: false,
        listPriceMinor: 20000,
        payMinor: 11900,
        payText: "$119.00",
        promo: null,
      },
    ],
    locations: [
      {
        name: "Foot Smile Spa",
        street: "100 Main St",
        city: "Chicago",
        state: "IL",
        postalCode: "60611",
        latitude: 41.88,
        longitude: -87.63,
      },
    ],
    ...overrides,
  };
}

describe("renderDeal", () => {
  it("opens with the breadcrumb to the home page and the finder, and the hero with the title and the short description", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("Swedish Massage at Foot Smile Spa");
    expect(html).toContain("A 60 or 90 minute Swedish massage that eases sore muscles.");
    expect(html).toContain("Top deals");
    expect(html).toContain('href="/"');
    expect(html).toContain("Find a deal");
    expect(html).toContain('href="/find"');
  });

  it("marks no nav link current", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).not.toContain('aria-current="page"');
  });

  it("escapes a title and a location that carry HTML", () => {
    const html = renderDeal({
      deal: makeDeal({ title: "<b>Massage</b>", locations: [{ name: "<i>Spa</i>", street: null, city: null, state: null, postalCode: null, latitude: null, longitude: null }] }),
      priceHistory: [],
    });
    expect(html).not.toContain("<b>Massage</b>");
    expect(html).toContain("&lt;b&gt;Massage&lt;/b&gt;");
    expect(html).not.toContain("<i>Spa</i>");
    expect(html).toContain("&lt;i&gt;Spa&lt;/i&gt;");
  });

  it("computes the tiles from the options when the board has them", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("Biggest saving");
    expect(html).toContain(">Options<");
    expect(html).toContain("$31.00");
    expect(html).toContain("1 on sale now, 1 not available");
  });

  it("shows four tiles: Biggest saving, Options, Promo codes and Price changes", () => {
    const rows: PriceChangeRow[] = [
      { optionId: "o-60", field: "retail", oldMinor: 5500, newMinor: 4900, detectedAt: "2026-09-28T10:00:00.000Z" },
      { optionId: "o-60", field: "retail", oldMinor: 6000, newMinor: 5500, detectedAt: "2026-09-20T10:00:00.000Z" },
    ];
    const html = renderDeal({ deal: makeDeal(), priceHistory: rows });
    expect(html).toContain(">Biggest saving<");
    expect(html).toContain(">Options<");
    expect(html).toContain(">Promo codes<");
    expect(html).toContain(">Price changes<");
    expect(html).toContain("0 of 2");
    expect(html).toMatch(/tile-value">2<\/span>\s*<span class="tile-hint">seen by the delta sync/);
  });

  it("shows the eyebrow as the deal's city and state", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain('<p class="eyebrow">Chicago, IL</p>');
  });

  it("renders a checkout form per sellable option and 'Not available right now' for a non-sellable one", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain('<form class="option-row-form" method="post" action="/checkout">');
    expect(html).toContain('name="productId" value="p-massage"');
    expect(html).toContain('name="optionId" value="o-60"');
    expect(html).toContain('name="quantity" value="1"');
    expect(html).toContain("Not available right now");
    expect(html).toContain("Couples Massage");
  });

  it("shows the cheapest option in a buy box beside the photo, with its save pill, checkout button and a link to every option", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("You save $31.00 · 38.8 %");
    expect(html).toContain("Get checkout link");
    expect(html).toContain("You pay on Groupon's checkout page. Groupon sends the voucher.");
    expect(html).toContain('<a href="#options">See all 2 options</a>');
  });

  it("heads the buy box with 'The cheapest option' over the option title", async () => {
    const html = await renderDeal({ deal: makeDeal(), priceHistory: [] });
    const headIndex = html.indexOf('<h3 class="box-title">The cheapest option</h3>');
    const titleIndex = html.indexOf('<p class="option-row-title">60-Minute Swedish Massage</p>');
    expect(headIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(headIndex);
  });

  it("gives the buy box a wrapper class and its own photo class, so the stylesheet can span its button and match the photo to its height", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain('<div class="buy-box">');
    expect(html).toContain('class="deal-photo"');
    expect(html).not.toContain("card-image");
  });

  it("leads Options with how the rows are ordered", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("Ordered by the price you pay; the cheapest is in the box above.");
  });

  it("marks the deal's own cheapest option \"In the box above\" among the option rows, instead of a second checkout form", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("In the box above");
  });

  it("keeps one checkout form per sellable option: the cheapest in the buy box, the rest in their own row", async () => {
    const deal = makeDeal({
      options: [
        { optionId: "o-60", title: "60-Minute Swedish Massage", sellable: true, listPriceMinor: 8000, payMinor: 4900, payText: "$49.00", promo: null },
        { optionId: "o-90", title: "90-Minute Swedish Massage", sellable: true, listPriceMinor: 11000, payMinor: 7900, payText: "$79.00", promo: null },
        { optionId: "o-couples", title: "Couples Massage", sellable: false, listPriceMinor: 20000, payMinor: 11900, payText: "$119.00", promo: null },
      ],
    });
    const html = await renderDeal({ deal, priceHistory: [] });
    const forms = html.match(/<form class="option-row-form"/g) ?? [];
    expect(forms.length).toBe(2);
    expect(html).toContain('name="optionId" value="o-90"');
    expect(html).toContain("In the box above");
    expect(html).toContain("Not available right now");
  });

  it("draws an option's promo as one line under its title, the promo price only there", async () => {
    const deal = makeDeal({
      options: [
        { optionId: "o-60", title: "60-Minute Swedish Massage", sellable: true, listPriceMinor: 8000, payMinor: 4900, payText: "$49.00", promo: null },
        {
          optionId: "o-couples",
          title: "Couples Massage",
          sellable: true,
          listPriceMinor: 20000,
          payMinor: 11900,
          payText: "$119.00",
          promo: {
            priceMinor: 9900,
            priceText: "$99.00",
            code: "PAIR20",
            endsAt: null,
            instruction: "Type code PAIR20 at Groupon checkout to pay $99.00. Without it you pay $119.00.",
          },
        },
      ],
    });
    const html = await renderDeal({ deal, priceHistory: [] });
    expect(html).toContain('<span class="option-row-title">Couples Massage<span class="promo-line">Type code PAIR20 at Groupon checkout to pay $99.00.</span></span>');
    expect(html).toContain(">Promo codes<");
    expect(html).not.toContain("promo-notes");
    expect(html.split("$99.00").length - 1).toBe(1);
  });

  it("lists a location's name, street, city, state and postal code", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("Foot Smile Spa");
    expect(html).toContain("100 Main St");
    expect(html).toContain("Chicago");
    expect(html).toContain("IL");
    expect(html).toContain("60611");
  });

  it("shows a location as a pin row with its name in bold and the address below it", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain('class="location-pin"');
    expect(html).toContain('<span class="location-name">Foot Smile Spa</span>');
    expect(html).toContain('<span class="location-address">100 Main St, Chicago, IL 60611</span>');
  });

  it("says a deal has no listed location when locations is empty", () => {
    const html = renderDeal({ deal: makeDeal({ locations: [] }), priceHistory: [] });
    expect(html).toContain("This deal has no listed location; it is redeemed online or by the merchant&#39;s own arrangement.");
  });

  it("shows the description as the terms section, labelled as Groupon's own terms", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("Terms as Groupon lists them");
    expect(html).toContain("Valid for new and returning customers. Appointment required.");
  });

  it("shows the large price block for the deal's price and the category pills", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("price--large");
    expect(html).toContain("$49.00");
    expect(html).toContain("Spa");
    expect(html).toContain("Massage");
  });

  it("shows Price history and formats a price-change row with formatMoney", () => {
    const rows: PriceChangeRow[] = [
      { optionId: "o-60", field: "retail", oldMinor: 5500, newMinor: 4900, detectedAt: "2026-09-28T10:00:00.000Z" },
      { optionId: "o-60", field: "promo", oldMinor: null, newMinor: 3920, detectedAt: "2026-09-21T09:00:00.000Z" },
    ];
    const html = renderDeal({ deal: makeDeal(), priceHistory: rows });
    expect(html).toMatch(/[Pp]rice history/);
    expect(html).toContain("$55.00");
    expect(html).toContain("$49.00");
    expect(html).toContain("$39.20");
    expect(html).toContain("60-Minute Swedish Massage");
  });

  it("says no price change has been seen yet when priceHistory is empty", () => {
    const html = renderDeal({ deal: makeDeal(), priceHistory: [] });
    expect(html).toContain("No price change seen yet. The delta sync looks every 3 hours; changes appear here.");
  });

  it("shows the promo instruction when the deal has a promo, never the bare promo price", () => {
    const deal = makeDeal({
      promo: {
        priceMinor: 3920,
        priceText: "$39.20",
        code: "SAVE20",
        endsAt: null,
        instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.",
      },
    });
    const html = renderDeal({ deal, priceHistory: [] });
    expect(html).toContain("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.");
  });
});
