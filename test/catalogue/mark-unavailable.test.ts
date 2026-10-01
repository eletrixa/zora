/**
 * markUnavailable: what Groupon refused in a cart stops being offered.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/catalogue/mark-unavailable.test.ts
 * Deps:    bun:test, src/catalogue/index.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createCatalogueStore } from "../../src/catalogue";
import { FakeClock } from "../fakes/clock";
import { createTestDb } from "../fakes/d1";
import { FIXTURE_PRODUCTS } from "../fakes/fixtures";

async function seeded() {
  const db = createTestDb();
  const store = createCatalogueStore(db.d1, new FakeClock());
  await store.upsertProducts(FIXTURE_PRODUCTS, "run-1", "2026-10-01T00:00:00.000Z");
  const indexed = (id: string) => (db.sqlite.query("SELECT COUNT(*) AS n FROM products_fts WHERE product_id = ?1").get(id) as { n: number }).n;
  return { db, store, indexed };
}

describe("markUnavailable", () => {
  it("hides one option and keeps the product while another option can be bought", async () => {
    const { store, indexed } = await seeded();
    expect(await store.markUnavailable("p-massage-chi", "o-massage-chi-60")).toBe(true);
    const product = await store.getProduct("p-massage-chi");
    expect(product?.options.map((option) => [option.optionId, option.active])).toEqual([
      ["o-massage-chi-60", false],
      ["o-massage-chi-90", true],
    ]);
    expect(product?.listable).toBe(true);
    expect(indexed("p-massage-chi")).toBe(1);
  });

  it("takes the product out of the listing and the search index when no option is left", async () => {
    const { store, indexed } = await seeded();
    await store.markUnavailable("p-pizza-chi", "o-pizza-chi");
    expect((await store.getProduct("p-pizza-chi"))?.listable).toBe(false);
    expect(indexed("p-pizza-chi")).toBe(0);
  });

  it("lets the next sync that sees the product write Groupon's state again", async () => {
    const { store, indexed } = await seeded();
    await store.markUnavailable("p-pizza-chi", "o-pizza-chi");
    const stats = await store.upsertProducts(FIXTURE_PRODUCTS, "run-2", "2026-10-02T00:00:00.000Z");
    expect(stats.updated).toBe(1);
    expect(stats.priceChanges).toBe(0);
    expect((await store.getProduct("p-pizza-chi"))?.listable).toBe(true);
    expect(indexed("p-pizza-chi")).toBe(1);
  });

  it("answers false for an option it does not know and changes nothing", async () => {
    const { store } = await seeded();
    expect(await store.markUnavailable("p-pizza-chi", "nope")).toBe(false);
    expect((await store.getProduct("p-pizza-chi"))?.listable).toBe(true);
  });
});
