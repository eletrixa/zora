/**
 * R1 regression: a cheap match must never lose its place to a pricier product that only ranked
 * higher for the search text. Every filter — including "has a sellable option under the price
 * cap" — must run BEFORE a product is ranked and cut to the page size, never after.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/search/r1-filters-before-cut.test.ts
 * Deps:    bun:test, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts, test/fakes/fixtures.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createSearchIndex } from "../../src/search/index";
import { createTestDb } from "../fakes/d1";
import { makeProduct, type ProductSpec } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

/** 250 products that rank far higher for "massage" than the cheap ones below: the word is in
 *  their title (bm25 weight 10) AND their category (weight 6), at a price well above the cap. */
function expensiveHighRankSpecs(count: number): ProductSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-expensive-${i}`,
    title: `Full Body Massage Massage Package ${i}`,
    short: "A premium spa package.",
    categories: ["Beauty & Spas", "Massage"],
    places: [["Premium Spa", "Chicago", "IL", "60601"]],
    options: [{ id: `o-expensive-${i}`, title: "Package", original: 30000, retail: 20000, isDefault: true }],
  }));
}

/** 10 products that also match "massage" (only in the low-weight description) but cost far
 *  less: they rank far below the expensive set, yet are the only ones under a $20 cap. */
function cheapLowRankSpecs(count: number): ProductSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-cheap-${i}`,
    title: `Foot Reflexology Session ${i}`,
    short: "A relaxing treatment that feels like a massage for tired feet.",
    categories: ["Beauty & Spas", "Reflexology"],
    places: [["Budget Spa", "Chicago", "IL", "60601"]],
    options: [{ id: `o-cheap-${i}`, title: "Session", original: 2500, retail: 1500 + i * 100, isDefault: true }],
  }));
}

describe("R1: filters apply before anything is cut", () => {
  it("still returns the cheap matches under the price cap, though 250 pricier products rank higher", async () => {
    const db = createTestDb();
    const specs = [...expensiveHighRankSpecs(250), ...cheapLowRankSpecs(10)];
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "massage", maxPriceMinor: 2000 });

    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.retail).toBeLessThanOrEqual(2000);
      expect(hit.productId.startsWith("p-cheap-")).toBe(true);
    }
  });

  it("never lets a product with only an inactive option take a result slot", async () => {
    const db = createTestDb();
    const specs: ProductSpec[] = [
      {
        id: "p-inactive-only",
        title: "Massage Massage Inactive Special",
        short: "Ranks highest but cannot be sold.",
        categories: ["Beauty & Spas", "Massage"],
        places: [["Closed Spa", "Chicago", "IL", "60601"]],
        options: [{ id: "o-inactive", title: "Package", original: 9000, retail: 4000, active: false, isDefault: true }],
      },
      {
        id: "p-sellable",
        title: "A Foot Rub",
        short: "Also a kind of massage, ranks lower.",
        categories: ["Beauty & Spas"],
        places: [["Open Spa", "Chicago", "IL", "60601"]],
        options: [{ id: "o-sellable", title: "Package", original: 6000, retail: 3500, isDefault: true }],
      },
    ];
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "massage", limit: 1 });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.productId).toBe("p-sellable");
  });
});
