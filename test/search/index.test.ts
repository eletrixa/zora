/**
 * SearchIndex over the seeded fixtures: FTS5 ranking, stemming, prefix, filters, the OR
 * fallback, and injection safety.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/search/index.test.ts
 * Deps:    bun:test, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts
 * Tested:  this file
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { createSearchIndex } from "../../src/search/index";
import type { SearchIndex } from "../../src/contracts/ports";
import { createTestDb, type TestDb } from "../fakes/d1";
import { seedCatalogue, seedCategories } from "../fakes/seed";

let db: TestDb;
let index: SearchIndex;

beforeEach(() => {
  db = createTestDb();
  seedCatalogue(db);
  index = createSearchIndex(db.d1);
});

describe("text search", () => {
  it("finds the massage in Chicago first", async () => {
    const hits = await index.search({ text: "massage in Chicago" });
    expect(hits[0]?.productId).toBe("p-massage-chi");
  });

  it("stems the query (massages matches massage)", async () => {
    const hits = await index.search({ text: "massages" });
    expect(hits.map((hit) => hit.productId)).toContain("p-massage-chi");
    expect(hits.map((hit) => hit.productId)).toContain("p-massage-nyc");
  });

  it("prefix-matches a short fragment", async () => {
    const hits = await index.search({ text: "mass" });
    expect(hits.map((hit) => hit.productId)).toContain("p-massage-chi");
  });

  it("falls back to OR when no product matches every word", async () => {
    const hits = await index.search({ text: "massage yoga" });
    const ids = hits.map((hit) => hit.productId);
    expect(ids).toContain("p-massage-chi");
    expect(ids).toContain("p-yoga-austin");
  });
});

describe("exclusions", () => {
  it("never returns a sold-out product", async () => {
    const hits = await index.search({ text: "hot stone massage" });
    expect(hits.map((hit) => hit.productId)).not.toContain("p-soldout-chi");
  });

  it("never returns a product whose availability must be booked", async () => {
    const hits = await index.search({ text: "kayak tour" });
    expect(hits.map((hit) => hit.productId)).not.toContain("p-kayak-chi");
  });

  it("never returns a product whose only option is inactive", async () => {
    const hits = await index.search({ text: "car wash" });
    expect(hits.map((hit) => hit.productId)).not.toContain("p-carwash-chi");
  });
});

describe("cheapest sellable option", () => {
  it("chooses the cheaper active option for p-laser-chi, skipping the inactive one", async () => {
    const hits = await index.search({ text: "laser hair removal" });
    const hit = hits.find((candidate) => candidate.productId === "p-laser-chi");
    expect(hit?.optionId).toBe("o-laser-chi-small");
    expect(hit?.retail).toBe(9900);
  });
});

describe("filters", () => {
  it("accepts a state code", async () => {
    const hits = await index.search({ text: "", state: "IL" });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.state).toBe("IL");
  });

  it("accepts a full state name", async () => {
    const hits = await index.search({ text: "", state: "New York" });
    expect(hits.map((hit) => hit.productId).sort()).toEqual(["p-escape-nyc", "p-massage-nyc"]);
  });

  it("matches city case-insensitively", async () => {
    const hits = await index.search({ text: "", city: "chicago" });
    for (const hit of hits) expect(hit.city).toBe("Chicago");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("matches a category label case-insensitively", async () => {
    const hits = await index.search({ text: "", category: "automotive" });
    expect(hits.map((hit) => hit.productId)).toEqual(["p-oil-chi"]);
  });

  it("filters by max price against the chosen option's retail", async () => {
    const hits = await index.search({ text: "massage", maxPriceMinor: 5000 });
    expect(hits.map((hit) => hit.productId)).toEqual(["p-massage-chi"]);
  });

  it("orders by retail ascending when there are filters and no text", async () => {
    const hits = await index.search({ text: "", state: "IL" });
    const retails = hits.map((hit) => hit.retail);
    expect(retails).toEqual([...retails].sort((a, b) => a - b));
  });
});

describe("empty and adversarial input", () => {
  it("returns no results for fill words only, without a filter", async () => {
    const hits = await index.search({ text: "the a an" });
    expect(hits).toEqual([]);
  });

  it("returns no results for symbols only, without a filter", async () => {
    const hits = await index.search({ text: "!!! ??? ---" });
    expect(hits).toEqual([]);
  });

  it("is not broken or exploited by quotes, *, NEAR, OR and SQL fragments", async () => {
    const hits = await index.search({ text: `massage" OR 1=1 --` });
    expect(hits.map((hit) => hit.productId)).toContain("p-massage-chi");
  });

  it("treats stray FTS operators as plain words, not syntax", async () => {
    const hits = await index.search({ text: `"laser" * NEAR OR` });
    expect(hits.map((hit) => hit.productId)).toContain("p-laser-chi");
  });
});

describe("limit", () => {
  it("defaults to 10 and caps at 50", async () => {
    const hits = await index.search({ text: "", state: "IL", limit: 1000 });
    expect(hits.length).toBeLessThanOrEqual(50);
  });
});

describe("category1 filter (the daily category walk's tags)", () => {
  it("keeps only products tagged with the category1, with and without text", async () => {
    seedCategories(db);
    const tagged = await index.search({ text: "", category1: "things-to-do" });
    const ids = tagged.map((hit) => hit.productId);
    expect(ids).toContain("p-bowling-chi");
    expect(ids).not.toContain("p-massage-chi");
    const withText = await index.search({ text: "massage", category1: "things-to-do" });
    expect(withText).toEqual([]);
    const both = await index.search({ text: "bowling", category1: "things-to-do" });
    expect(both.map((hit) => hit.productId)).toEqual(["p-bowling-chi"]);
  });

  it("answers nothing for a category1 nobody is tagged with", async () => {
    seedCategories(db);
    expect(await index.search({ text: "", category1: "pets" })).toEqual([]);
  });
});
