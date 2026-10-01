/**
 * Tests for the deal card as Finder.dc.html draws it (the whole card a link, You pay as the biggest
 * figure, the original struck, the save pill, the promo as a footnote marker) and the result grid.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/card.test.ts
 * Deps:    bun:test, src/ui/components/card.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { dealCard, dealGrid } from "../../../src/ui/components/card";
import type { DealCard } from "../../../src/contracts/ports";

const card: DealCard = {
  productId: "p1",
  optionId: "o1",
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
};

const promo = {
  priceMinor: 3920,
  priceText: "$39.20",
  code: "SAVE20",
  endsAt: null,
  instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.",
};

describe("dealCard", () => {
  it("makes the whole card a link to the deal page through the title", () => {
    const html = dealCard(card);
    expect(html).toContain('<a class="card-title" href="/deals/p1">Swedish Massage at Foot Smile Spa<span class="card-cover" aria-hidden="true"></span></a>');
    expect(html.split('href="/deals/').length - 1).toBe(1);
  });

  it("shows city and state together", () => {
    expect(dealCard(card)).toContain('<span class="card-location">Chicago, IL</span>');
  });

  it("shows the option title", () => {
    expect(dealCard(card)).toContain('<span class="card-option">60-Minute Swedish Massage</span>');
  });

  it("draws the monogram placeholder when there is no image", () => {
    expect(dealCard(card)).toContain('<div class="card-image card-image--mono" aria-hidden="true">S</div>');
  });

  it("shows an image when imageUrl is set", () => {
    const html = dealCard({ ...card, imageUrl: "https://img.example/x.jpg" });
    expect(html).toContain('<img class="card-image" src="https://img.example/x.jpg" loading="lazy" alt="">');
    expect(html).not.toContain("card-image--mono");
  });

  it("says location not listed when both city and state are null", () => {
    const html = dealCard({ ...card, city: null, state: null });
    expect(html).toContain("Location not listed");
  });

  it("shows You pay with the price to pay, then the original struck", () => {
    expect(dealCard(card)).toContain(
      '<div class="price-row"><span class="price-label">You pay</span><span class="price-pay" data-label="You pay">$49.00</span><s class="price-list" data-label="Original">$80.00</s></div>',
    );
  });

  it("states the saving and its percent, computed from the list price and the price to pay", () => {
    expect(dealCard(card)).toContain('<span class="save-pill"><span class="save-pill-amount" data-label="You save">You save $31.00 · 38.8 %</span></span>');
  });

  it("shows no original and no saving when the list price equals the price to pay", () => {
    const html = dealCard({ ...card, listPriceMinor: 4900 });
    expect(html).not.toContain("price-list");
    expect(html).not.toContain("You save");
  });

  it("fills the pill a tile names and leads it with the tile's label", () => {
    expect(dealCard(card, { label: "Cheapest" })).toContain(
      '<span class="save-pill save-pill--best"><span class="save-pill-label">Cheapest · </span><span class="save-pill-amount" data-label="You save">You save $31.00 · 38.8 %</span></span>',
    );
  });

  it("draws a promo as one line under the option when ranked, the promo price only inside that line", () => {
    const html = dealCard({ ...card, promo }, { rank: 3 });
    expect(html).toContain('</span><span class="promo-line">Type code SAVE20 at Groupon checkout to pay $39.20.</span></div>');
    expect(html.split("$39.20").length - 1).toBe(1);
    expect(html).not.toContain('class="promo"');
    expect(html).toContain('data-label="You pay">$49.00<');
  });

  it("keeps the inline promo note without a rank, as the deal page does", () => {
    const html = dealCard({ ...card, promo });
    expect(html).toContain('<div class="promo">');
    expect(html).toContain(promo.instruction);
    expect(html).not.toContain('class="promo-line"');
  });

  it("escapes a script tag in the title, the option and the location", () => {
    const html = dealCard({ ...card, title: "<script>evil()</script>", optionTitle: "<script>evil()</script>", city: "<script>evil()</script>" });
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("dealGrid", () => {
  it("wraps the cards in a grid", () => {
    const html = dealGrid([card]);
    expect(html).toStartWith('<div class="grid"><article class="card">');
    expect(html).toContain(card.title);
  });

  it("gives the card labelFor names its save pill label and leaves the others plain", () => {
    const labelled = dealGrid([card, { ...card, productId: "p2" }], {
      labelFor: (c, rank) => (rank === 2 ? "Cheapest" : undefined),
    });
    expect(labelled).toBe(
      `<div class="grid">${dealCard(card, { rank: 1 })}${dealCard({ ...card, productId: "p2" }, { rank: 2, label: "Cheapest" })}</div>`,
    );
  });

  it("gives each card with a promo its own promo line and adds no footnote list under the grid", () => {
    const html = dealGrid([card, { ...card, productId: "p2", promo }, { ...card, productId: "p3", promo }]);
    expect((html.match(/class="promo-line"/g) ?? []).length).toBe(2);
    expect(html).not.toContain("promo-notes");
    expect(html).toEndWith("</article></div>");
  });

  it("renders nothing extra for an empty list", () => {
    expect(dealGrid([])).toBe('<div class="grid"></div>');
  });
});
