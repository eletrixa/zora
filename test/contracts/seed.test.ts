/**
 * The reference seeding writes what the schema comments say.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/contracts/seed.test.ts
 * Deps:    bun:test, test/fakes/seed.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createTestDb } from "../fakes/d1";
import { FIXTURE_PRODUCTS, LISTABLE_IDS } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

describe("seedCatalogue", () => {
  const db = createTestDb();
  seedCatalogue(db);
  const all = <T>(sql: string): T[] => db.sqlite.query(sql).all() as T[];

  it("stores every product and marks the listable ones", () => {
    expect(all<{ n: number }>("SELECT COUNT(*) AS n FROM products")[0]?.n).toBe(FIXTURE_PRODUCTS.length);
    expect(all<{ id: string }>("SELECT id FROM products WHERE listable = 1 ORDER BY id").map((row) => row.id)).toEqual([...LISTABLE_IDS].sort());
  });

  it("indexes only listable products", () => {
    expect(all<{ id: string }>("SELECT product_id AS id FROM products_fts ORDER BY id").map((row) => row.id)).toEqual([...LISTABLE_IDS].sort());
  });

  it("writes code and full state name into places", () => {
    expect(all<{ places: string }>("SELECT places FROM products_fts WHERE product_id = 'p-laser-chi'")[0]?.places).toBe(
      "Smooth Clinic Loop Chicago IL Illinois Smooth Clinic Evanston Evanston IL Illinois",
    );
  });

  it("keeps the three states of an option's active flag", () => {
    const rows = all<{ option_id: string; active: number | null }>("SELECT option_id, active FROM options WHERE option_id IN ('o-nails-miami', 'o-carwash-chi', 'o-pizza-chi') ORDER BY option_id");
    expect(rows).toEqual([
      { option_id: "o-carwash-chi", active: 0 },
      { option_id: "o-nails-miami", active: null },
      { option_id: "o-pizza-chi", active: 1 },
    ]);
  });

  it("stores the promo beside the price, never instead of it", () => {
    expect(all("SELECT retail, promo_amount, promo_code FROM options WHERE option_id = 'o-massage-chi-60'")).toEqual([{ retail: 4900, promo_amount: 3920, promo_code: "SAVE20" }]);
    expect(all("SELECT retail, promo_amount, promo_code FROM options WHERE option_id = 'o-yoga-austin'")).toEqual([{ retail: 4500, promo_amount: 3600, promo_code: null }]);
  });

  it("can be run twice without doubling rows", () => {
    seedCatalogue(db);
    expect(all<{ n: number }>("SELECT COUNT(*) AS n FROM products_fts")[0]?.n).toBe(LISTABLE_IDS.length);
    expect(all<{ n: number }>("SELECT COUNT(*) AS n FROM options")[0]?.n).toBe(15);
  });
});
