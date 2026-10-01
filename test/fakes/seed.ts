/**
 * Writes API products into the D1 tables exactly as the schema comments prescribe. Two uses:
 * lanes that READ the catalogue (search, shopping, monitor) seed their test database with it,
 * and it is the reference for what the catalogue-store lane must write, row for row.
 *
 * Reference rules (the catalogue-store lane follows the same):
 *   - option price = pricing of the option's first unit, first pricing entry; an option
 *     without one is not stored;
 *   - products.listable = the guide's rule (fakeIsListable);
 *   - products_fts holds one row per LISTABLE product and none for the others;
 *   - products_fts.categories = category labels joined by a space;
 *   - products_fts.places = for each location: name, city, state code, full state name,
 *     joined by a space; missing parts are left out;
 *   - products.image_url = url of the first media entry, or NULL.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/seed.ts
 * Deps:    bun:sqlite (through TestDb), src/lib/us-states.ts, test/fakes/services.ts
 * Tested:  test/contracts/seed.test.ts
 */
import type { OctoProduct } from "../../src/contracts/partner";
import { stateName } from "../../src/lib/us-states";
import type { TestDb } from "./d1";
import { FIXTURE_CATEGORY1, FIXTURE_PRODUCTS } from "./fixtures";
import { fakeIsListable } from "./services";

export const placesText = (product: OctoProduct): string =>
  product.locations
    .flatMap((place) => [place.name, place.city, place.state, stateName(place.state)])
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");

export function seedCatalogue(db: TestDb, products: readonly OctoProduct[] = FIXTURE_PRODUCTS, at = "2026-10-01T00:00:00.000Z", runId = "seed"): void {
  const { sqlite } = db;
  const insertProduct = sqlite.query(
    `INSERT OR REPLACE INTO products (id, reference, title, short_description, description, status, availability_required, listable,
       category_labels, image_url, raw_json, content_hash, first_seen_at, updated_at, last_seen_at, last_seen_run_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13, ?13, ?14)`,
  );
  const insertOption = sqlite.query(
    `INSERT OR REPLACE INTO options (product_id, option_id, title, active, is_default, currency, precision, original, retail,
       promo_amount, promo_code, promo_ends_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
  );
  const insertLocation = sqlite.query(
    "INSERT OR REPLACE INTO locations (product_id, idx, name, street, city, state, postal_code, latitude, longitude) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  );
  // Same placement as src/catalogue/index.ts: the search row sits at the product's rowid.
  const deleteFts = sqlite.query("DELETE FROM products_fts WHERE rowid = (SELECT rowid FROM products WHERE id = ?1)");
  const insertFts = sqlite.query(
    "INSERT INTO products_fts (rowid, product_id, title, short_description, description, categories, places) VALUES ((SELECT rowid FROM products WHERE id = ?1), ?1, ?2, ?3, ?4, ?5, ?6)",
  );

  sqlite.transaction(() => {
    for (const product of products) {
      const raw = JSON.stringify(product);
      const listable = fakeIsListable(product);
      // INSERT OR REPLACE gives the product a new rowid, so the old search row goes first.
      deleteFts.run(product.id);
      insertProduct.run(
        product.id,
        product.reference,
        product.title,
        product.shortDescription,
        product.description,
        product.status,
        product.availabilityRequired ? 1 : 0,
        listable ? 1 : 0,
        JSON.stringify(product.categoryLabels),
        product.media[0]?.url ?? null,
        raw,
        `seed-${Bun.hash(raw).toString(16)}`,
        at,
        runId,
      );
      for (const option of product.options) {
        const pricing = option.units[0]?.pricing[0];
        if (!pricing) continue;
        insertOption.run(
          product.id,
          option.id,
          option.internalName,
          option.active === null ? null : option.active ? 1 : 0,
          option.default ? 1 : 0,
          pricing.currency,
          pricing.currencyPrecision,
          pricing.original,
          pricing.retail,
          pricing.discountedPrice?.amount ?? null,
          pricing.discountedPrice?.promoCode ?? null,
          pricing.discountedPrice?.endDate ?? null,
          at,
        );
      }
      product.locations.forEach((place, index) =>
        insertLocation.run(product.id, index, place.name, place.street, place.city, place.state, place.postalCode, place.latitude, place.longitude),
      );
      if (listable) insertFts.run(product.id, product.title, product.shortDescription, product.description, product.categoryLabels.join(" "), placesText(product));
    }
  })();
}

/** Writes the category1 tags the daily category walk would write, one row per (product, category). */
export function seedCategories(db: TestDb, tags: Readonly<Record<string, readonly string[]>> = FIXTURE_CATEGORY1, at = "2026-10-01T00:00:00.000Z", runId = "seed"): void {
  const insert = db.sqlite.query("INSERT OR REPLACE INTO product_categories (product_id, category1, run_id, tagged_at) VALUES (?1, ?2, ?3, ?4)");
  db.sqlite.transaction(() => {
    for (const [productId, categories] of Object.entries(tags)) for (const category1 of categories) insert.run(productId, category1, runId, at);
  })();
}
