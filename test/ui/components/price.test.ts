/**
 * Tests for the price block and the promo note.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/price.test.ts
 * Deps:    bun:test, src/ui/components/price.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { priceBlock, promoNote } from "../../../src/ui/components/price";

const base = {
  payText: "$49.00",
  listPriceMinor: 8000,
  payMinor: 4900,
  currency: "USD",
  precision: 2,
  promo: null as null | {
    priceMinor: number;
    priceText: string;
    code: string | null;
    endsAt: string | null;
    instruction: string;
  },
};

describe("priceBlock", () => {
  it("shows the pay price and the struck-through list price", () => {
    const html = priceBlock(base);
    expect(html).toContain("$49.00");
    expect(html).toContain("$80.00");
    expect(html).toContain("price-list");
  });

  it("omits the struck-through price when the list price is not higher", () => {
    const html = priceBlock({ ...base, listPriceMinor: 4900 });
    expect(html).not.toContain("price-list");
  });

  it("shows the promo note only as the instruction sentence, never the bare promo price", () => {
    const html = priceBlock({
      ...base,
      promo: { priceMinor: 3920, priceText: "$39.20", code: "SAVE20", endsAt: null, instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00." },
    });
    expect(html).toContain("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.");
    // the bare price text must not appear outside the instruction sentence
    const withoutInstruction = html.replace("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.", "");
    expect(withoutInstruction).not.toContain("$39.20");
  });

  it("renders no promo note when promo is null", () => {
    const html = priceBlock(base);
    expect(html).not.toContain("promo");
  });

  it("escapes a script tag reaching payText", () => {
    const html = priceBlock({ ...base, payText: "<script>evil()</script>" });
    expect(html).not.toContain("<script>evil()</script>");
  });

  it("uses the large size class when asked", () => {
    const html = priceBlock(base, "large");
    expect(html).toContain("price--large");
  });
});

describe("promoNote", () => {
  it("renders the instruction sentence, escaped", () => {
    const html = promoNote({ priceMinor: 3920, priceText: "$39.20", code: "SAVE20", endsAt: null, instruction: "Type code <b>SAVE20</b> at Groupon checkout." });
    expect(html).toContain("Type code &lt;b&gt;SAVE20&lt;/b&gt; at Groupon checkout.");
    expect(html).not.toContain("<b>SAVE20</b>");
  });
});
