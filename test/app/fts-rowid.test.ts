/**
 * The search row of a product sits at the product's rowid (migration 0008), so every write and
 * delete of it is one seek and never a scan of the full-text table.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/fts-rowid.test.ts
 * Deps:    bun:test, src/catalogue/index.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createCatalogueStore } from "../../src/catalogue";
import { makeWorld } from "../fakes/env";
import { seedCatalogue } from "../fakes/seed";
import { FIXTURE_PRODUCTS } from "../fakes/fixtures";

const orphans = (world: ReturnType<typeof makeWorld>): number =>
  (
    world.db.sqlite
      .query("SELECT COUNT(*) AS n FROM products_fts f WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.rowid = f.rowid AND p.id = f.product_id)")
      .get() as { n: number }
  ).n;

const searchRows = (world: ReturnType<typeof makeWorld>): number => (world.db.sqlite.query("SELECT COUNT(*) AS n FROM products_fts").get() as { n: number }).n;

describe("products_fts placement", () => {
  it("keeps every search row at its product's rowid after seeding twice", () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    seedCatalogue(world.db);
    expect(searchRows(world)).toBeGreaterThan(0);
    expect(orphans(world)).toBe(0);
  });

  it("keeps the placement through the catalogue's own upsert, unavailability and retirement", async () => {
    const world = makeWorld();
    const catalogue = createCatalogueStore(world.db.d1, world.clock);
    const at = new Date(world.clock.now()).toISOString();
    await catalogue.upsertProducts(FIXTURE_PRODUCTS, "run-1", at);
    expect(searchRows(world)).toBeGreaterThan(0);
    expect(orphans(world)).toBe(0);

    const changed = FIXTURE_PRODUCTS.map((product) => ({ ...product, title: `${product.title} (edited)` }));
    await catalogue.upsertProducts(changed, "run-2", at);
    expect(orphans(world)).toBe(0);
    expect(searchRows(world)).toBe((world.db.sqlite.query("SELECT COUNT(*) AS n FROM products WHERE listable = 1").get() as { n: number }).n);

    const first = FIXTURE_PRODUCTS[0]!;
    for (const option of first.options) await catalogue.markUnavailable(first.id, option.id);
    expect(orphans(world)).toBe(0);

    await catalogue.upsertProducts([], "run-3", at);
    await catalogue.retireUnseen("run-3");
    expect(searchRows(world)).toBe(0);
    expect(orphans(world)).toBe(0);
  });
});
