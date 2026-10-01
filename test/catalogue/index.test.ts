/**
 * Behaviour of the catalogue store: row-for-row parity with the reference seeder, the listable
 * rule, idempotent upserts, price-change tracking, the deterministic sample and retireUnseen.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/catalogue/index.test.ts
 * Deps:    bun:test, bun:sqlite, src/catalogue, test/fakes
 * Tested:  this file
 */
import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import type { OctoProduct } from "../../src/contracts/partner";
import { createCatalogueStore, isListable } from "../../src/catalogue";
import { createTestDb, type TestDb } from "../fakes/d1";
import { FIXTURE_PRODUCTS, LISTABLE_IDS, freshProducts, makeProduct } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

const clock = { now: () => Date.parse("2026-10-01T00:00:00.000Z"), sleep: async () => {} };
const AT = "2026-10-01T00:00:00.000Z";
const RUN = "run-1";

function tableRows(sqlite: Database, table: string): Record<string, unknown>[] {
  return sqlite.query(`SELECT * FROM ${table} ORDER BY ${table === "products" ? "id" : table === "locations" ? "product_id, idx" : table === "products_fts" ? "product_id" : "product_id, option_id"}`).all() as Record<
    string,
    unknown
  >[];
}

function withoutContentHash(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(({ content_hash, ...rest }) => rest);
}

describe("isListable", () => {
  it("matches the guide's rule on all thirteen fixtures", () => {
    const got = FIXTURE_PRODUCTS.filter(isListable).map((p) => p.id).sort();
    expect(got).toEqual([...LISTABLE_IDS].sort());
  });
});

describe("upsertProducts: fresh load", () => {
  it("writes the same rows as seedCatalogue, except content_hash", async () => {
    const seeded = createTestDb();
    seedCatalogue(seeded, FIXTURE_PRODUCTS, AT, RUN);

    const written = createTestDb();
    const store = createCatalogueStore(written.d1, clock);
    const stats = await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    expect(stats).toEqual({ inserted: FIXTURE_PRODUCTS.length, updated: 0, unchanged: 0, priceChanges: 0 });
    expect(withoutContentHash(tableRows(written.sqlite, "products"))).toEqual(withoutContentHash(tableRows(seeded.sqlite, "products")));
    expect(tableRows(written.sqlite, "options")).toEqual(tableRows(seeded.sqlite, "options"));
    expect(tableRows(written.sqlite, "locations")).toEqual(tableRows(seeded.sqlite, "locations"));
    expect(tableRows(written.sqlite, "products_fts")).toEqual(tableRows(seeded.sqlite, "products_fts"));
  });

  it("hashes content with sha-256 of raw_json", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    const row = db.sqlite.query("SELECT content_hash, raw_json FROM products WHERE id = 'p-massage-chi'").get() as { content_hash: string; raw_json: string };
    const expected = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(row.raw_json))).toString("hex");
    expect(row.content_hash).toBe(expected);
  });
});

describe("upsertProducts: idempotent second call", () => {
  it("is unchanged for everything, writes no price change, and only touches last_seen columns", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    const before = tableRows(db.sqlite, "products");
    const optionsBefore = tableRows(db.sqlite, "options");

    const LATER = "2026-10-01T02:00:00.000Z";
    const stats = await store.upsertProducts(FIXTURE_PRODUCTS, "run-2", LATER);

    expect(stats).toEqual({ inserted: 0, updated: 0, unchanged: FIXTURE_PRODUCTS.length, priceChanges: 0 });
    const after = tableRows(db.sqlite, "products");
    expect(after.map((r) => ({ ...r, last_seen_at: undefined, last_seen_run_id: undefined }))).toEqual(before.map((r) => ({ ...r, last_seen_at: undefined, last_seen_run_id: undefined })));
    expect(after.every((r) => r.last_seen_at === LATER && r.last_seen_run_id === "run-2")).toBe(true);
    expect(tableRows(db.sqlite, "options")).toEqual(optionsBefore);
    expect(db.sqlite.query("SELECT COUNT(*) AS n FROM price_changes").get()).toEqual({ n: 0 });
  });
});

describe("upsertProducts: price changes", () => {
  it("records a retail change", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const changed = freshProducts();
    const product = changed.find((p) => p.id === "p-massage-nyc")!;
    product.options[0]!.units[0]!.pricing[0]!.retail = 5400;

    const LATER = "2026-10-01T02:00:00.000Z";
    const stats = await store.upsertProducts(changed, "run-2", LATER);
    expect(stats).toEqual({ inserted: 0, updated: 1, unchanged: FIXTURE_PRODUCTS.length - 1, priceChanges: 1 });

    const rows = db.sqlite.query("SELECT option_id, field, old_minor, new_minor FROM price_changes").all();
    expect(rows).toEqual([{ option_id: "o-massage-nyc-60", field: "retail", old_minor: 5900, new_minor: 5400 }]);
    const optionRow = db.sqlite.query("SELECT retail, updated_at FROM options WHERE option_id = 'o-massage-nyc-60'").get() as { retail: number; updated_at: string };
    expect(optionRow).toEqual({ retail: 5400, updated_at: LATER });
    const productRow = db.sqlite.query("SELECT updated_at, last_seen_at FROM products WHERE id = 'p-massage-nyc'").get();
    expect(productRow).toEqual({ updated_at: LATER, last_seen_at: LATER });
  });

  it("records a promo appearing with old_minor null", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const changed = freshProducts();
    const product = changed.find((p) => p.id === "p-massage-nyc")!;
    product.options[0]!.units[0]!.pricing[0]!.discountedPrice = { amount: 4900, promoCode: "NEW10", endDate: "2026-12-01T00:00:00Z" };

    await store.upsertProducts(changed, "run-2", "2026-10-01T02:00:00.000Z");
    const rows = db.sqlite.query("SELECT option_id, field, old_minor, new_minor FROM price_changes").all();
    expect(rows).toEqual([{ option_id: "o-massage-nyc-60", field: "promo", old_minor: null, new_minor: 4900 }]);
  });

  it("records a promo ending with new_minor null", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const changed = freshProducts();
    const product = changed.find((p) => p.id === "p-massage-chi")!;
    product.options[0]!.units[0]!.pricing[0]!.discountedPrice = null;

    await store.upsertProducts(changed, "run-2", "2026-10-01T02:00:00.000Z");
    const rows = db.sqlite.query("SELECT option_id, field, old_minor, new_minor FROM price_changes WHERE option_id = 'o-massage-chi-60'").all();
    expect(rows).toEqual([{ option_id: "o-massage-chi-60", field: "promo", old_minor: 3920, new_minor: null }]);
  });

  it("writes no price change for a brand-new product", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const extra: OctoProduct = makeProduct({
      id: "p-new-1",
      title: "Brand New Deal",
      short: "Fresh off the walk.",
      categories: ["Things To Do"],
      places: [["New Place", "Denver", "CO", "80202"]],
      options: [{ id: "o-new-1", title: "One Session", original: 5000, retail: 2500, isDefault: true }],
    });

    const stats = await store.upsertProducts([extra], "run-2", "2026-10-01T02:00:00.000Z");
    expect(stats).toEqual({ inserted: 1, updated: 0, unchanged: 0, priceChanges: 0 });
    expect(db.sqlite.query("SELECT COUNT(*) AS n FROM price_changes").get()).toEqual({ n: 0 });
  });
});

describe("upsertProducts: options that vanish", () => {
  it("deletes an option no longer present", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    expect(db.sqlite.query("SELECT option_id FROM options WHERE product_id = 'p-massage-chi'").all()).toHaveLength(2);

    const changed = freshProducts();
    const product = changed.find((p) => p.id === "p-massage-chi")!;
    product.options = [product.options[0]!];

    await store.upsertProducts(changed, "run-2", "2026-10-01T02:00:00.000Z");
    const remaining = db.sqlite.query("SELECT option_id FROM options WHERE product_id = 'p-massage-chi'").all();
    expect(remaining).toEqual([{ option_id: "o-massage-chi-60" }]);
  });
});

describe("upsertProducts: FTS follows listability", () => {
  it("removes the FTS row when a product stops being listable", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    expect(db.sqlite.query("SELECT product_id FROM products_fts WHERE product_id = 'p-massage-chi'").get()).not.toBeNull();

    const changed = freshProducts();
    const product = changed.find((p) => p.id === "p-massage-chi")!;
    product.status = "sold_out";

    await store.upsertProducts(changed, "run-2", "2026-10-01T02:00:00.000Z");
    expect(db.sqlite.query("SELECT product_id FROM products_fts WHERE product_id = 'p-massage-chi'").get()).toBeNull();
    expect(db.sqlite.query("SELECT listable FROM products WHERE id = 'p-massage-chi'").get()).toEqual({ listable: 0 });
  });
});

describe("sampleListableOptions", () => {
  it("only returns listable products' sellable options", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const sample = await store.sampleListableOptions(100, "seed-a");
    const ids = sample.map((o) => o.productId);
    expect(ids.every((id) => LISTABLE_IDS.includes(id))).toBe(true);
    expect(sample.some((o) => o.optionId === "o-carwash-chi")).toBe(false); // active: false
    expect(sample.some((o) => o.optionId === "o-laser-chi-old")).toBe(false); // active: false
    expect(sample.some((o) => o.optionId === "o-nails-miami")).toBe(true); // active: null, treated sellable
  });

  it("gives the same order for the same seed and a different order for another seed", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const first = await store.sampleListableOptions(5, "seed-a");
    const again = await store.sampleListableOptions(5, "seed-a");
    const other = await store.sampleListableOptions(5, "seed-b");

    expect(again.map((o) => o.optionId)).toEqual(first.map((o) => o.optionId));
    expect(other.map((o) => o.optionId)).not.toEqual(first.map((o) => o.optionId));
  });

  it("respects count", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    const sample = await store.sampleListableOptions(3, "seed-a");
    expect(sample).toHaveLength(3);
  });
});

describe("retireUnseen", () => {
  it("un-lists listable products absent from the given run and drops their FTS row, returning the count", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const stillThere = FIXTURE_PRODUCTS.filter((p) => p.id !== "p-massage-chi" && p.id !== "p-pizza-chi");
    await store.upsertProducts(stillThere, "run-2", "2026-10-01T02:00:00.000Z");

    const retired = await store.retireUnseen("run-2");
    expect(retired).toBe(2);
    expect(db.sqlite.query("SELECT listable FROM products WHERE id = 'p-massage-chi'").get()).toEqual({ listable: 0 });
    expect(db.sqlite.query("SELECT listable FROM products WHERE id = 'p-pizza-chi'").get()).toEqual({ listable: 0 });
    expect(db.sqlite.query("SELECT product_id FROM products_fts WHERE product_id IN ('p-massage-chi', 'p-pizza-chi')").all()).toEqual([]);
  });

  it("returns 0 when nothing needs retiring", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    expect(await store.retireUnseen(RUN)).toBe(0);
  });
});

describe("priceHistory", () => {
  it("returns newest first", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const t1 = "2026-10-01T01:00:00.000Z";
    const round1 = freshProducts();
    round1.find((p) => p.id === "p-pizza-chi")!.options[0]!.units[0]!.pricing[0]!.retail = 2500;
    await store.upsertProducts(round1, "run-2", t1);

    const t2 = "2026-10-01T02:00:00.000Z";
    const round2 = freshProducts();
    round2.find((p) => p.id === "p-pizza-chi")!.options[0]!.units[0]!.pricing[0]!.retail = 2100;
    await store.upsertProducts(round2, "run-3", t2);

    const history = await store.priceHistory("p-pizza-chi", 10);
    expect(history.map((h) => ({ newMinor: h.newMinor, detectedAt: h.detectedAt }))).toEqual([
      { newMinor: 2100, detectedAt: t2 },
      { newMinor: 2500, detectedAt: t1 },
    ]);
  });
});

describe("getProduct / getOption / countProducts", () => {
  it("returns options and locations in stored order, booleans as booleans, categories parsed", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);

    const product = await store.getProduct("p-laser-chi");
    expect(product?.categoryLabels).toEqual(["Beauty & Spas", "Hair Removal"]);
    expect(product?.options.map((o) => o.optionId)).toEqual(["o-laser-chi-small", "o-laser-chi-old"]);
    expect(product?.options[1]?.active).toBe(false);
    expect(product?.locations.map((l) => l.city)).toEqual(["Chicago", "Evanston"]);
    expect(product?.availabilityRequired).toBe(false);
    expect(product?.listable).toBe(true);
  });

  it("getOption reads the null active flag as null", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    const option = await store.getOption("p-nails-miami", "o-nails-miami");
    expect(option?.active).toBeNull();
  });

  it("getProduct returns null for an unknown id", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    expect(await store.getProduct("nope")).toBeNull();
  });

  it("counts total and listable", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    await store.upsertProducts(FIXTURE_PRODUCTS, RUN, AT);
    expect(await store.countProducts()).toEqual({ total: FIXTURE_PRODUCTS.length, listable: LISTABLE_IDS.length });
  });
});

describe("a page of 50 products stays within D1's parameter limits", () => {
  it("upserts without throwing, twice", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    const page: OctoProduct[] = Array.from({ length: 50 }, (_, i) =>
      makeProduct({
        id: `p-gen-${i}`,
        title: `Generated Deal ${i}`,
        short: "A generated fixture.",
        categories: ["Things To Do"],
        places: [["Place", "Chicago", "IL", "60600"]],
        options: [
          { id: `o-gen-${i}-a`, title: "Option A", original: 5000, retail: 2500, isDefault: true },
          { id: `o-gen-${i}-b`, title: "Option B", original: 6000, retail: 3000 },
        ],
      }),
    );
    const stats1 = await store.upsertProducts(page, "run-a", AT);
    expect(stats1).toEqual({ inserted: 50, updated: 0, unchanged: 0, priceChanges: 0 });

    page[0]!.options[0]!.units[0]!.pricing[0]!.retail = 2000;
    const stats2 = await store.upsertProducts(page, "run-b", "2026-10-01T02:00:00.000Z");
    expect(stats2).toEqual({ inserted: 0, updated: 1, unchanged: 49, priceChanges: 1 });
  });
});

describe("upsertProducts: a product with 100 or more options", () => {
  it("upserts 150 options, then a later upsert keeping 120 of them deletes exactly 30", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);

    const product = makeProduct({
      id: "p-many-options",
      title: "A Deal With Many Options",
      short: "Every size and session count you could want.",
      categories: ["Things To Do"],
      places: [["Place", "Chicago", "IL", "60600"]],
      options: Array.from({ length: 150 }, (_, i) => ({ id: `o-many-${i}`, title: `Option ${i}`, original: 5000, retail: 2500, isDefault: i === 0 })),
    });

    const stats1 = await store.upsertProducts([product], "run-a", AT);
    expect(stats1).toEqual({ inserted: 1, updated: 0, unchanged: 0, priceChanges: 0 });
    expect(db.sqlite.query("SELECT COUNT(*) AS n FROM options WHERE product_id = 'p-many-options'").get()).toEqual({ n: 150 });

    const kept = structuredClone(product) as OctoProduct;
    kept.options = kept.options.slice(0, 120);

    const stats2 = await store.upsertProducts([kept], "run-b", "2026-10-01T02:00:00.000Z");
    expect(stats2).toEqual({ inserted: 0, updated: 1, unchanged: 0, priceChanges: 0 });
    expect(db.sqlite.query("SELECT COUNT(*) AS n FROM options WHERE product_id = 'p-many-options'").get()).toEqual({ n: 120 });
  });
});
