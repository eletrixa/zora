/**
 * A product's writes commit or fail together: upsertProducts groups every statement one product
 * needs into a single db.batch() call, so a batch failure partway through a page never leaves a
 * product with a new content_hash and missing options, locations or search row.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/catalogue/transactional-write.test.ts
 * Deps:    bun:test, bun:sqlite, src/catalogue, test/fakes
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createCatalogueStore } from "../../src/catalogue";
import { sha256Hex } from "../../src/lib/crypto";
import { createTestDb } from "../fakes/d1";
import { makeProduct } from "../fakes/fixtures";
import type { OctoProduct } from "../../src/contracts/partner";

const clock = { now: () => Date.parse("2026-10-01T00:00:00.000Z"), sleep: async () => {} };
const AT = "2026-10-01T00:00:00.000Z";
const RUN = "run-1";

/** Wraps a real D1Database, recording every db.batch() call's statement count and optionally
 *  throwing instead of running one of them (as real D1 would when a batch fails outright). */
class BatchSpy implements D1Database {
  readonly callSizes: number[] = [];
  constructor(
    private readonly inner: D1Database,
    private readonly failOnCall?: number,
  ) {}
  prepare(query: string): D1PreparedStatement {
    return this.inner.prepare(query);
  }
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const callNumber = this.callSizes.length + 1;
    this.callSizes.push(statements.length);
    if (callNumber === this.failOnCall) throw new Error(`simulated failure on batch call ${callNumber}`);
    return this.inner.batch(statements);
  }
  async exec(query: string): Promise<D1ExecResult> {
    return this.inner.exec(query);
  }
  withSession(): D1DatabaseSession {
    return this.inner.withSession();
  }
  dump(): Promise<ArrayBuffer> {
    return this.inner.dump();
  }
}

/** Ten products, each with exactly one option and one location, so every changed product's write
 *  group is a fixed, small, known size (small enough that several pack into one batch). */
function tenProducts(retailBase: number): OctoProduct[] {
  return Array.from({ length: 10 }, (_, i) =>
    makeProduct({
      id: `p-tx-${i}`,
      title: `Transactional Fixture ${i}`,
      short: "A fixture for the batching tests.",
      categories: ["Things To Do"],
      places: [["Place", "Chicago", "IL", "60600"]],
      options: [{ id: `o-tx-${i}`, title: "Option", original: 5000, retail: retailBase + i, isDefault: true }],
    }),
  );
}

describe("upsertProducts: a product's writes commit or fail together", () => {
  it("leaves every changed product either fully old or fully new when a later batch call fails", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    const original = tenProducts(2000);
    await store.upsertProducts(original, RUN, AT);

    const changed = tenProducts(3000); // same ids, every retail different: every product "changed"
    const spy = new BatchSpy(db.d1, 2); // fail on the second db.batch() call
    const spiedStore = createCatalogueStore(spy, clock);
    const LATER = "2026-10-01T02:00:00.000Z";
    await expect(spiedStore.upsertProducts(changed, "run-2", LATER)).rejects.toThrow();
    expect(spy.callSizes.length).toBeGreaterThanOrEqual(2); // the failure actually happened mid-page, not before writing

    for (let i = 0; i < original.length; i++) {
      const before = original[i]!;
      const after = changed[i]!;
      const oldHash = await sha256Hex(JSON.stringify(before));
      const newHash = await sha256Hex(JSON.stringify(after));
      const row = db.sqlite.query("SELECT content_hash FROM products WHERE id = ?1").get(before.id) as { content_hash: string };
      const optionRow = db.sqlite.query("SELECT retail FROM options WHERE product_id = ?1 AND option_id = ?2").get(before.id, before.options[0]!.id) as { retail: number };

      expect([oldHash, newHash]).toContain(row.content_hash);
      if (row.content_hash === oldHash) {
        expect(optionRow.retail).toBe(before.options[0]!.units[0]!.pricing[0]!.retail);
      } else {
        expect(optionRow.retail).toBe(after.options[0]!.units[0]!.pricing[0]!.retail);
      }
    }
  });

  it("repairs every product on a second call after the interrupted one", async () => {
    const db = createTestDb();
    const store = createCatalogueStore(db.d1, clock);
    const original = tenProducts(2000);
    await store.upsertProducts(original, RUN, AT);

    const changed = tenProducts(3000);
    const spy = new BatchSpy(db.d1, 2);
    const spiedStore = createCatalogueStore(spy, clock);
    await expect(spiedStore.upsertProducts(changed, "run-2", "2026-10-01T02:00:00.000Z")).rejects.toThrow();

    const stats = await store.upsertProducts(changed, "run-3", "2026-10-01T03:00:00.000Z");
    expect(stats.unchanged + stats.updated).toBe(10);
    expect(stats.inserted).toBe(0);

    const reference = createTestDb();
    const referenceStore = createCatalogueStore(reference.d1, clock);
    await referenceStore.upsertProducts(original, RUN, AT);
    await referenceStore.upsertProducts(changed, "ref-2", "2026-10-01T02:00:00.000Z");

    const productCols = "id, reference, title, short_description, description, status, availability_required, listable, category_labels, image_url, raw_json, content_hash";
    const optionCols = "product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at";
    expect(db.sqlite.query(`SELECT ${productCols} FROM products ORDER BY id`).all()).toEqual(reference.sqlite.query(`SELECT ${productCols} FROM products ORDER BY id`).all());
    expect(db.sqlite.query(`SELECT ${optionCols} FROM options ORDER BY product_id, option_id`).all()).toEqual(
      reference.sqlite.query(`SELECT ${optionCols} FROM options ORDER BY product_id, option_id`).all(),
    );
    expect(db.sqlite.query("SELECT * FROM locations ORDER BY product_id, idx").all()).toEqual(reference.sqlite.query("SELECT * FROM locations ORDER BY product_id, idx").all());
    expect(db.sqlite.query("SELECT * FROM products_fts ORDER BY product_id").all()).toEqual(reference.sqlite.query("SELECT * FROM products_fts ORDER BY product_id").all());
  });

  it("writes a product with 60 locations in one batch call", async () => {
    const db = createTestDb();
    const spy = new BatchSpy(db.d1);
    const store = createCatalogueStore(spy, clock);

    const places: [string, string, string, string][] = Array.from({ length: 60 }, (_, i) => [`Branch ${i}`, "Chicago", "IL", "60600"]);
    const bigProduct = makeProduct({
      id: "p-many-locations",
      title: "Sixty Branches",
      short: "A chain with sixty locations.",
      categories: ["Things To Do"],
      places,
      options: [{ id: "o-many-locations", title: "Option", original: 5000, retail: 2500, isDefault: true }],
    });

    await store.upsertProducts([bigProduct], RUN, AT);

    expect(spy.callSizes).toHaveLength(1); // never split across two batches
    expect(spy.callSizes[0]).toBeGreaterThan(60); // product row + option + 60 locations + fts, all in that one call
    expect(db.sqlite.query("SELECT COUNT(*) AS n FROM locations WHERE product_id = 'p-many-locations'").get()).toEqual({ n: 60 });
  });
});
