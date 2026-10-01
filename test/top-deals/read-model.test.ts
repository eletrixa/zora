/**
 * The top deals read model, checked against numbers computed by hand on the fixtures (Chicago,
 * IL: laser 50000/9900 saves 40100 (80.2%), bowling 9000/3900 saves 5100 (56.7%), massage
 * 90-minute 12000/6900 saves 5100 (42.5%) and its 60-minute option only 3100, oil 8999/4499
 * saves 4500 (50.0%), pizza 5000/2900 saves 2100 (42.0%); sold out, kayak and car wash are not
 * listable or not sellable) and against hand-built catalogues for every other rule.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/top-deals/read-model.test.ts
 * Deps:    bun:test, src/top-deals/read-model.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createTopDealsReadModel } from "../../src/top-deals/read-model";
import type { TestDb } from "../fakes/d1";
import { createTestDb } from "../fakes/d1";
import { makeProduct } from "../fakes/fixtures";
import { seedCatalogue, seedCategories } from "../fakes/seed";

/** The daily job's write, done directly: the read model only reads this table. */
function seedTopCities(db: TestDb, cities: readonly { readonly city: string; readonly state: string; readonly count: number }[], refreshedAt = "2026-10-01T06:00:00.000Z"): void {
  const insert = db.sqlite.query("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES (?1, ?2, ?3, ?4, ?5)");
  cities.forEach((row, index) => insert.run(row.city, row.state, row.count, index + 1, refreshedAt));
}

function seedSyncRun(db: TestDb, runId: string, finishedAt: string): void {
  db.sqlite
    .query("INSERT INTO sync_runs (run_id, kind, status, started_at, finished_at, page_size, category1) VALUES (?1, 'category', 'complete', ?2, ?2, 0, NULL)")
    .run(runId, finishedAt);
}

/** Seeds the default fixtures plus their category1 tags and a Chicago-first top_cities list. */
function seedChicago(db: TestDb): void {
  seedCatalogue(db);
  seedCategories(db);
  seedTopCities(db, [{ city: "Chicago", state: "IL", count: 5 }]);
}

describe("createTopDealsReadModel: Chicago, IL ranking", () => {
  it("ranks Chicago by discount in money", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-laser-chi", "p-bowling-chi", "p-massage-chi", "p-oil-chi", "p-pizza-chi"]);
    expect(report.rows.map((row) => row.discountMinor)).toEqual([40100, 5100, 5100, 4500, 2100]);
  });

  it("ranks Chicago by discount in percent", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "percent" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-laser-chi", "p-bowling-chi", "p-oil-chi", "p-massage-chi", "p-pizza-chi"]);
    const [laser, bowling, oil, massage, pizza] = report.rows;
    expect(laser?.discountShare).toBeCloseTo(0.802, 3);
    expect(bowling?.discountShare).toBeCloseTo(5100 / 9000, 10);
    expect(oil?.discountShare).toBeCloseTo(4500 / 8999, 10);
    expect(massage?.discountShare).toBeCloseTo(5100 / 12000, 10);
    expect(pizza?.discountShare).toBeCloseTo(0.42, 10);
  });

  it("keeps one row per product and picks the option with the largest discount", async () => {
    const db = createTestDb();
    seedChicago(db);
    const byAmount = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    const byPercent = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "percent" });
    const massageByAmount = byAmount.rows.filter((row) => row.productId === "p-massage-chi");
    const massageByPercent = byPercent.rows.filter((row) => row.productId === "p-massage-chi");
    expect(massageByAmount).toHaveLength(1);
    expect(massageByAmount[0]?.optionId).toBe("o-massage-chi-90");
    expect(massageByPercent).toHaveLength(1);
    expect(massageByPercent[0]?.optionId).toBe("o-massage-chi-90");
  });

  it("skips inactive options and products that are not listable", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    const ids = report.rows.map((row) => row.productId).sort();
    expect(ids).toEqual(["p-bowling-chi", "p-laser-chi", "p-massage-chi", "p-oil-chi", "p-pizza-chi"].sort());
    expect(ids).not.toContain("p-soldout-chi");
    expect(ids).not.toContain("p-kayak-chi");
    expect(ids).not.toContain("p-carwash-chi");
    // laser's inactive option (o-laser-chi-old) never wins the product's row
    const laser = report.rows.find((row) => row.productId === "p-laser-chi");
    expect(laser?.optionId).toBe("o-laser-chi-small");
  });
});

describe("createTopDealsReadModel: option eligibility", () => {
  it("skips an option whose original price is 0", async () => {
    const db = createTestDb();
    const zeroOriginal = makeProduct({
      id: "p-zero-original",
      title: "Zero Original Price",
      short: "short",
      categories: ["Test"],
      places: [["Place", "Testville", "ZZ", "00000"]],
      options: [{ id: "o-zero-original", title: "Option", original: 0, retail: 0, isDefault: true }],
    });
    seedCatalogue(db, [zeroOriginal]);
    seedTopCities(db, [{ city: "Testville", state: "ZZ", count: 1 }]);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Testville", state: "ZZ", sort: "amount" });
    expect(report.rows).toEqual([]);
  });

  it("skips an option whose original price is not above retail", async () => {
    const db = createTestDb();
    const noDiscount = makeProduct({
      id: "p-no-discount",
      title: "No Discount",
      short: "short",
      categories: ["Test"],
      places: [["Place", "Testville", "ZZ", "00000"]],
      options: [{ id: "o-no-discount", title: "Option", original: 1000, retail: 1000, isDefault: true }],
    });
    seedCatalogue(db, [noDiscount]);
    seedTopCities(db, [{ city: "Testville", state: "ZZ", count: 1 }]);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Testville", state: "ZZ", sort: "amount" });
    expect(report.rows).toEqual([]);
  });
});

describe("createTopDealsReadModel: location keys", () => {
  it("keeps Hollywood, FL apart from Hollywood, CA", async () => {
    const db = createTestDb();
    const hollywoodFl = makeProduct({
      id: "p-holly-fl",
      title: "Hollywood FL Deal",
      short: "short",
      categories: ["Test"],
      places: [["FL Place", "Hollywood", "FL", "33019"]],
      options: [{ id: "o-holly-fl", title: "Option", original: 2000, retail: 1000, isDefault: true }],
    });
    const hollywoodCa = makeProduct({
      id: "p-holly-ca",
      title: "Hollywood CA Deal",
      short: "short",
      categories: ["Test"],
      places: [["CA Place", "Hollywood", "CA", "90028"]],
      options: [{ id: "o-holly-ca", title: "Option", original: 3000, retail: 1500, isDefault: true }],
    });
    seedCatalogue(db, [hollywoodFl, hollywoodCa]);
    seedTopCities(db, [
      { city: "Hollywood", state: "FL", count: 1 },
      { city: "Hollywood", state: "CA", count: 1 },
    ]);
    const readModel = createTopDealsReadModel(db.d1);
    const flReport = await readModel.report({ city: "Hollywood", state: "FL", sort: "amount" });
    expect(flReport.rows.map((row) => row.productId)).toEqual(["p-holly-fl"]);
    const caReport = await readModel.report({ city: "Hollywood", state: "CA", sort: "amount" });
    expect(caReport.rows.map((row) => row.productId)).toEqual(["p-holly-ca"]);
  });

  it("shows the location in the chosen city, not the product's first location", async () => {
    const db = createTestDb();
    // idx 0 is Evanston on purpose: the city shown must come from the MIN(idx) WITHIN Chicago.
    const reversedOrder = makeProduct({
      id: "p-reversed-locations",
      title: "Deal Seen in Two Towns",
      short: "short",
      categories: ["Test"],
      places: [
        ["Evanston Branch", "Evanston", "IL", "60201"],
        ["Chicago Branch", "Chicago", "IL", "60601"],
      ],
      options: [{ id: "o-reversed-locations", title: "Option", original: 2000, retail: 1000, isDefault: true }],
    });
    seedCatalogue(db, [reversedOrder]);
    seedTopCities(db, [{ city: "Chicago", state: "IL", count: 1 }]);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    const row = report.rows.find((r) => r.productId === "p-reversed-locations");
    expect(row?.city).toBe("Chicago");
    expect(row?.state).toBe("IL");
  });
});

describe("createTopDealsReadModel: category and label filters", () => {
  it("filters by the category1 tag, so things-to-do in Chicago is bowling alone", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", category1: "things-to-do", sort: "amount" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-bowling-chi"]);
  });

  it("lists a product under each of its categories, so food-and-drink in Chicago is bowling then pizza", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", category1: "food-and-drink", sort: "amount" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-bowling-chi", "p-pizza-chi"]);
  });

  it("filters by a leaf label, case-insensitive", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", label: "hair removal", sort: "amount" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-laser-chi"]);
  });
});

describe("createTopDealsReadModel: row cap", () => {
  it("caps the list at 20 rows and numbers them 1 to 20", async () => {
    const db = createTestDb();
    const products = Array.from({ length: 25 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      const discount = (i + 1) * 100; // distinct, so ranking is unambiguous
      return makeProduct({
        id: `p-cap-${n}`,
        title: `Capped Deal ${n}`,
        short: "short",
        categories: ["Test"],
        places: [["Place", "Bigtown", "ZZ", "00000"]],
        options: [{ id: `o-cap-${n}`, title: "Option", original: 10000, retail: 10000 - discount, isDefault: true }],
      });
    });
    seedCatalogue(db, products);
    seedTopCities(db, [{ city: "Bigtown", state: "ZZ", count: 25 }]);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Bigtown", state: "ZZ", sort: "amount" });
    expect(report.rows).toHaveLength(20);
    expect(report.rows.map((row) => row.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(report.rows[0]?.productId).toBe("p-cap-25"); // discount 2500, the largest
    expect(report.rows[0]?.discountMinor).toBe(2500);
    expect(new Set(report.rows.map((row) => row.productId)).size).toBe(20);
  });
});

describe("createTopDealsReadModel: pickers and defaults", () => {
  it("answers the first city of the list when the request names none", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "", state: "", sort: "amount" });
    expect(report.query?.city).toBe("Chicago");
    expect(report.query?.state).toBe("IL");
    expect(report.cities[0]).toEqual({ city: "Chicago", state: "IL", listableProducts: 5 });
  });

  it("lists the categories of the chosen city with things-to-do first", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    expect(report.categories).toEqual([
      { category1: "things-to-do", products: 1 },
      { category1: "beauty-and-spas", products: 2 },
      { category1: "food-and-drink", products: 2 },
      { category1: "automotive", products: 1 },
    ]);
  });

  it("lists the leaf labels of the chosen city and category by size", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", category1: "beauty-and-spas", sort: "amount" });
    expect(report.labels).toEqual([
      { label: "Beauty & Spas", products: 2 },
      { label: "Hair Removal", products: 1 },
      { label: "Massage", products: 1 },
    ]);
  });
});

describe("createTopDealsReadModel: promo footnote", () => {
  it("carries the promo of the winning option as a footnote value with payMinor equal to retail", async () => {
    const db = createTestDb();
    seedChicago(db);
    const report = await createTopDealsReadModel(db.d1).report({ city: "Chicago", state: "IL", sort: "amount" });
    const oil = report.rows.find((row) => row.productId === "p-oil-chi");
    expect(oil?.payMinor).toBe(4499);
    expect(oil?.promo?.priceMinor).toBe(3599);
    expect(oil?.promo?.code).toBe("AUTO20");
    expect(oil?.promo?.instruction).toBe("Type code AUTO20 at Groupon checkout to pay $35.99. Without it you pay $44.99.");
    const massage = report.rows.find((row) => row.productId === "p-massage-chi");
    expect(massage?.promo).toBeNull();
  });
});

describe("createTopDealsReadModel: tag freshness", () => {
  it("answers null tag freshness before the first category walk and the newest finish after", async () => {
    const db = createTestDb();
    seedTopCities(db, [{ city: "Chicago", state: "IL", count: 0 }]);
    const readModel = createTopDealsReadModel(db.d1);
    const before = await readModel.report({ city: "Chicago", state: "IL", sort: "amount" });
    expect(before.taggedAt).toBeNull();

    seedSyncRun(db, "run-1", "2026-10-01T03:00:00.000Z");
    seedSyncRun(db, "run-2", "2026-10-02T03:00:00.000Z");
    const after = await readModel.report({ city: "Chicago", state: "IL", sort: "amount" });
    expect(after.taggedAt).toBe("2026-10-02T03:00:00.000Z");
  });
});

describe("createTopDealsReadModel: no city yet", () => {
  it("answers an empty report with no city before the first refresh", async () => {
    const db = createTestDb();
    const report = await createTopDealsReadModel(db.d1).report({ city: "", state: "", sort: "amount" });
    expect(report).toEqual({ query: null, cities: [], categories: [], labels: [], rows: [], taggedAt: null, citiesRefreshedAt: null });
  });
});

describe("createTopDealsReadModel: the pickers the finder shares", () => {
  it("lists every city of the list and every tagged category of the whole catalogue, things-to-do first then by size", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    seedCategories(db);
    seedTopCities(db, [{ city: "Chicago", state: "IL", count: 5 }, { city: "New York", state: "NY", count: 2 }]);
    seedSyncRun(db, "walk-1", "2026-10-01T00:52:03.000Z");
    const pickers = await createTopDealsReadModel(db.d1).pickers();
    expect(pickers.cities.map((city) => `${city.city}, ${city.state}`)).toEqual(["Chicago, IL", "New York, NY"]);
    expect(pickers.categories[0]).toEqual({ category1: "things-to-do", products: 3 });
    expect(pickers.categories[1]).toEqual({ category1: "beauty-and-spas", products: 6 });
    expect(pickers.citiesRefreshedAt).toBe("2026-10-01T06:00:00.000Z");
    expect(pickers.taggedAt).toBe("2026-10-01T00:52:03.000Z");
  });

  it("answers empty lists and null stamps before the first refresh and the first walk", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const pickers = await createTopDealsReadModel(db.d1).pickers();
    expect(pickers).toEqual({ cities: [], categories: [], citiesRefreshedAt: null, taggedAt: null });
  });
});
