/**
 * A 2,000-product catalogue (generated, not the 13-row fixture set) to prove the narrowed
 * search statements still find the right hit once there is enough data for a full options scan
 * to actually be slow — the case A2 was about.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/search/scale.test.ts
 * Deps:    bun:test, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts, test/fakes/fixtures.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createSearchIndex } from "../../src/search/index";
import { createTestDb } from "../fakes/d1";
import { makeProduct, type ProductSpec } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

const STATES: readonly (readonly [state: string, city: string])[] = [
  ["IL", "Chicago"],
  ["NY", "New York"],
  ["CA", "Los Angeles"],
  ["TX", "Austin"],
  ["FL", "Miami"],
];

function generatedSpecs(count: number): ProductSpec[] {
  const specs: ProductSpec[] = [];
  for (let i = 0; i < count; i++) {
    const [state, city] = STATES[i % STATES.length]!;
    specs.push({
      id: `p-gen-${i}`,
      title: `Filler Car Detailing Package ${i}`,
      short: "A generated filler product used only to pad the catalogue for a scale test.",
      categories: ["Automotive", "Car Wash"],
      places: [[`Filler Shop ${i}`, city, state, "00000"]],
      options: [{ id: `o-gen-${i}`, title: "Standard Package", original: 10000, retail: 3000 + (i % 50) * 100, isDefault: true }],
    });
  }
  return specs;
}

const NEEDLE_ID = "p-espresso-chi";
const NEEDLE: ProductSpec = {
  id: NEEDLE_ID,
  title: "Vintage Espresso Tasting Flight at Roast Lab",
  short: "A guided tasting of six single-origin espresso shots.",
  categories: ["Food & Drink", "Coffee"],
  places: [["Roast Lab", "Chicago", "IL", "60607"]],
  options: [{ id: "o-espresso-chi", title: "Espresso Tasting Flight", original: 6000, retail: 2500, isDefault: true }],
};

describe("search over 2,000 generated products", () => {
  it("finds the one product that matches a distinctive word, with the right cheapest option", async () => {
    const db = createTestDb();
    const specs = generatedSpecs(2000);
    specs.splice(1000, 0, NEEDLE);
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "espresso tasting" });
    expect(hits[0]?.productId).toBe(NEEDLE_ID);
    expect(hits[0]?.optionId).toBe("o-espresso-chi");
    expect(hits[0]?.retail).toBe(2500);
  });

  it("orders a large filtered set by retail ascending and returns the cheapest first", async () => {
    const db = createTestDb();
    const specs = generatedSpecs(2000);
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "", state: "IL", limit: 5 });
    expect(hits).toHaveLength(5);
    const retails = hits.map((hit) => hit.retail);
    expect(retails).toEqual([...retails].sort((a, b) => a - b));
    expect(retails[0]).toBe(3000);
  });

  it("still finds a common-word match among many candidates with a price filter applied", async () => {
    const db = createTestDb();
    const specs = generatedSpecs(2000);
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "filler detailing", maxPriceMinor: 3000 });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.retail).toBeLessThanOrEqual(3000);
  });
});
