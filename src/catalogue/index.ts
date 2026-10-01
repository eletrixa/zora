/**
 * Writes and reads the catalogue copy of the Partner Storefront API in D1: upsertProducts keeps
 * products, options, locations and the FTS index in step with each sync page and records a
 * price_changes row per changed amount; the read methods serve search, shopping and the monitor.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/catalogue/index.ts
 * Deps:    src/contracts, src/lib/crypto.ts, src/catalogue/rows.ts, src/catalogue/batch.ts
 * Tested:  test/catalogue/index.test.ts
 */
import type { OctoOption, OctoProduct } from "../contracts/partner";
import type { CatalogueStore, Clock, ListableRule, PriceChangeRow, StoredOption, StoredProduct, UpsertStats } from "../contracts/ports";
import { sha256Hex } from "../lib/crypto";
import { chunk, ID_CHUNK_SIZE, placeholders, runGroupsInChunks, runInChunks } from "./batch";
import {
  categoriesText,
  insertLocationParams,
  insertProductParams,
  mapLocationRow,
  mapOptionRow,
  mapProductRow,
  placesText,
  pricingOf,
  storableOptions,
  updateChangedProductParams,
  upsertOptionParams,
  type LocationRow,
  type OptionRow,
  type ProductRow,
} from "./rows";

/** The guide's rule: active product, no availability required, at least one option not inactive. */
export const isListable: ListableRule = (product) => product.status === "active" && !product.availabilityRequired && product.options.some((option) => option.active !== false);

type PriceField = "retail" | "original" | "promo";

/** old/new amount for one field of one option, only when they differ. */
function priceDiffs(before: ExistingOption | undefined, option: OctoOption): readonly { field: PriceField; oldMinor: number | null; newMinor: number | null }[] {
  if (!before) return [];
  const pricing = pricingOf(option);
  if (!pricing) return [];
  const diffs: { field: PriceField; oldMinor: number | null; newMinor: number | null }[] = [];
  if (before.retail !== pricing.retail) diffs.push({ field: "retail", oldMinor: before.retail, newMinor: pricing.retail });
  if (before.original !== pricing.original) diffs.push({ field: "original", oldMinor: before.original, newMinor: pricing.original });
  const newPromo = pricing.discountedPrice?.amount ?? null;
  if (before.promoAmount !== newPromo) diffs.push({ field: "promo", oldMinor: before.promoAmount, newMinor: newPromo });
  return diffs;
}

interface ExistingOption {
  readonly retail: number;
  readonly original: number;
  readonly promoAmount: number | null;
}

async function loadExistingHashes(db: D1Database, ids: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const part of chunk(ids, ID_CHUNK_SIZE)) {
    const rows = await db
      .prepare(`SELECT id, content_hash FROM products WHERE id IN (${placeholders(part.length)})`)
      .bind(...part)
      .all<{ id: string; content_hash: string }>();
    for (const row of rows.results) found.set(row.id, row.content_hash);
  }
  return found;
}

async function loadExistingOptions(db: D1Database, productIds: readonly string[]): Promise<Map<string, ExistingOption>> {
  const found = new Map<string, ExistingOption>();
  if (productIds.length === 0) return found;
  for (const part of chunk(productIds, ID_CHUNK_SIZE)) {
    const rows = await db
      .prepare(`SELECT product_id, option_id, retail, original, promo_amount FROM options WHERE product_id IN (${placeholders(part.length)})`)
      .bind(...part)
      .all<{ product_id: string; option_id: string; retail: number; original: number; promo_amount: number | null }>();
    for (const row of rows.results) found.set(`${row.product_id}:${row.option_id}`, { retail: row.retail, original: row.original, promoAmount: row.promo_amount });
  }
  return found;
}

export function createCatalogueStore(db: D1Database, clock: Clock): CatalogueStore {
  void clock; // "now" always comes from the caller's seenAt; kept for interface symmetry with other lanes

  async function upsertProducts(products: readonly OctoProduct[], syncRunId: string, seenAt: string): Promise<UpsertStats> {
    if (products.length === 0) return { inserted: 0, updated: 0, unchanged: 0, priceChanges: 0 };

    const ids = products.map((p) => p.id);
    const [existingHashes, hashes] = await Promise.all([loadExistingHashes(db, ids), Promise.all(products.map((p) => sha256Hex(JSON.stringify(p))))]);

    const changedIds: string[] = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i]!;
      const existing = existingHashes.get(product.id);
      if (existing !== undefined && existing !== hashes[i]) changedIds.push(product.id);
    }
    const existingOptions = await loadExistingOptions(db, changedIds);

    // One group per product: everything a product writes must commit or fail together (a group
    // never splits across two db.batch() calls), or a chunk boundary landing between a product's
    // new content_hash and its replaced options/locations/FTS row would leave it half written.
    const groups: D1PreparedStatement[][] = [];
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let priceChanges = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i]!;
      const hash = hashes[i]!;
      const existing = existingHashes.get(product.id);
      const listable = isListable(product);

      if (existing !== undefined && existing === hash) {
        unchanged++;
        groups.push([db.prepare("UPDATE products SET last_seen_at = ?1, last_seen_run_id = ?2 WHERE id = ?3").bind(seenAt, syncRunId, product.id)]);
        continue;
      }

      const isNew = existing === undefined;
      const group: D1PreparedStatement[] = [];
      if (isNew) {
        inserted++;
        group.push(db.prepare(INSERT_PRODUCT).bind(...insertProductParams(product, listable, hash, seenAt, syncRunId)));
      } else {
        updated++;
        group.push(db.prepare(UPDATE_PRODUCT_CHANGED).bind(...updateChangedProductParams(product, listable, hash, seenAt, syncRunId)));
      }

      const keep = storableOptions(product);
      if (!isNew) {
        // A fixed two binds, never one per kept option: json_each reads the kept ids out of a single
        // bound JSON string, so a product with 100+ options never crosses D1's 100-bound-value limit
        // (round 3 fix: round 2 named this but the commit never landed).
        group.push(
          keep.length > 0
            ? db.prepare("DELETE FROM options WHERE product_id = ?1 AND option_id NOT IN (SELECT value FROM json_each(?2))").bind(product.id, JSON.stringify(keep.map((o) => o.id)))
            : db.prepare("DELETE FROM options WHERE product_id = ?1").bind(product.id),
        );
      }
      for (const option of keep) {
        const pricing = pricingOf(option)!;
        group.push(db.prepare(UPSERT_OPTION).bind(...upsertOptionParams(product.id, option, pricing, seenAt)));
        if (!isNew) {
          for (const diff of priceDiffs(existingOptions.get(`${product.id}:${option.id}`), option)) {
            priceChanges++;
            group.push(
              db
                .prepare("INSERT INTO price_changes (product_id, option_id, field, old_minor, new_minor, detected_at, sync_run_id) VALUES (?1,?2,?3,?4,?5,?6,?7)")
                .bind(product.id, option.id, diff.field, diff.oldMinor, diff.newMinor, seenAt, syncRunId),
            );
          }
        }
      }

      group.push(db.prepare("DELETE FROM locations WHERE product_id = ?1").bind(product.id));
      product.locations.forEach((place, index) => group.push(db.prepare(INSERT_LOCATION).bind(...insertLocationParams(product.id, place, index))));

      group.push(db.prepare(DELETE_FTS).bind(product.id));
      if (listable) {
        group.push(
          db.prepare(INSERT_FTS).bind(
            product.id,
            product.title,
            product.shortDescription,
            product.description,
            categoriesText(product),
            placesText(product),
          ),
        );
      }
      groups.push(group);
    }

    await runGroupsInChunks(db, groups);
    return { inserted, updated, unchanged, priceChanges };
  }

  async function getProduct(productId: string): Promise<StoredProduct | null> {
    const row = await db
      .prepare("SELECT id, reference, title, short_description, description, status, availability_required, listable, category_labels, image_url, first_seen_at, updated_at FROM products WHERE id = ?1")
      .bind(productId)
      .first<ProductRow>();
    if (!row) return null;
    const [optionRows, locationRows] = await Promise.all([
      db
        .prepare("SELECT product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at FROM options WHERE product_id = ?1 ORDER BY rowid")
        .bind(productId)
        .all<OptionRow>(),
      db.prepare("SELECT name, street, city, state, postal_code, latitude, longitude FROM locations WHERE product_id = ?1 ORDER BY idx").bind(productId).all<LocationRow>(),
    ]);
    return mapProductRow(row, optionRows.results.map(mapOptionRow), locationRows.results.map(mapLocationRow));
  }

  async function getOption(productId: string, optionId: string): Promise<StoredOption | null> {
    const row = await db
      .prepare("SELECT product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at FROM options WHERE product_id = ?1 AND option_id = ?2")
      .bind(productId, optionId)
      .first<OptionRow>();
    return row ? mapOptionRow(row) : null;
  }

  async function countProducts(): Promise<{ total: number; listable: number }> {
    const row = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN listable = 1 THEN 1 ELSE 0 END) AS listable FROM products").first<{ total: number; listable: number | null }>();
    return { total: row?.total ?? 0, listable: row?.listable ?? 0 };
  }

  async function sampleListableOptions(count: number, seed: string): Promise<readonly StoredOption[]> {
    const rows = await db
      .prepare(SAMPLE_LISTABLE_OPTIONS_SQL)
      .bind(seed, count)
      .all<OptionRow>();
    return rows.results.map(mapOptionRow);
  }

  async function markUnavailable(productId: string, optionId: string): Promise<boolean> {
    const known = await db.prepare("SELECT 1 AS hit FROM options WHERE product_id = ?1 AND option_id = ?2").bind(productId, optionId).first<{ hit: number }>();
    if (!known) return false;
    const noneLeft = "NOT EXISTS (SELECT 1 FROM options WHERE product_id = ?1 AND active IS NOT 0)";
    // One batch is one transaction: the option, the product flag and the search row move together.
    await db.batch([
      db.prepare("UPDATE options SET active = 0 WHERE product_id = ?1 AND option_id = ?2").bind(productId, optionId),
      db.prepare(`UPDATE products SET listable = 0 WHERE id = ?1 AND ${noneLeft}`).bind(productId),
      db.prepare(`${DELETE_FTS} AND ${noneLeft}`).bind(productId),
      // An empty hash never equals a real one, so the next sync that sees the product rewrites it.
      db.prepare("UPDATE products SET content_hash = '' WHERE id = ?1").bind(productId),
    ]);
    return true;
  }

  async function retireUnseen(syncRunId: string): Promise<number> {
    const stale = await db.prepare("SELECT id FROM products WHERE listable = 1 AND last_seen_run_id != ?1").bind(syncRunId).all<{ id: string }>();
    const ids = stale.results.map((row) => row.id);
    if (ids.length === 0) return 0;
    const statements: D1PreparedStatement[] = [db.prepare("UPDATE products SET listable = 0 WHERE listable = 1 AND last_seen_run_id != ?1").bind(syncRunId)];
    for (const id of ids) statements.push(db.prepare(DELETE_FTS).bind(id));
    await runInChunks(db, statements);
    return ids.length;
  }

  async function priceHistory(productId: string, limit: number): Promise<readonly PriceChangeRow[]> {
    const rows = await db
      .prepare("SELECT option_id, field, old_minor, new_minor, detected_at FROM price_changes WHERE product_id = ?1 ORDER BY detected_at DESC, id DESC LIMIT ?2")
      .bind(productId, limit)
      .all<{ option_id: string; field: "retail" | "original" | "promo"; old_minor: number | null; new_minor: number | null; detected_at: string }>();
    return rows.results.map((row) => ({ optionId: row.option_id, field: row.field, oldMinor: row.old_minor, newMinor: row.new_minor, detectedAt: row.detected_at }));
  }

  return { upsertProducts, getProduct, getOption, countProducts, sampleListableOptions, retireUnseen, markUnavailable, priceHistory };
}

// The search row sits at the product's rowid (migration 0008): product_id is UNINDEXED in FTS5,
// so a delete by product_id would scan the whole table for every product written.
const DELETE_FTS = "DELETE FROM products_fts WHERE rowid = (SELECT rowid FROM products WHERE id = ?1)";
const INSERT_FTS = `INSERT INTO products_fts (rowid, product_id, title, short_description, description, categories, places)
  VALUES ((SELECT rowid FROM products WHERE id = ?1), ?1, ?2, ?3, ?4, ?5, ?6)`;

const INSERT_PRODUCT = `INSERT INTO products (id, reference, title, short_description, description, status, availability_required, listable,
    category_labels, image_url, raw_json, content_hash, first_seen_at, updated_at, last_seen_at, last_seen_run_id)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`;

const UPDATE_PRODUCT_CHANGED = `UPDATE products SET reference = ?1, title = ?2, short_description = ?3, description = ?4, status = ?5,
    availability_required = ?6, listable = ?7, category_labels = ?8, image_url = ?9, raw_json = ?10, content_hash = ?11,
    updated_at = ?12, last_seen_at = ?13, last_seen_run_id = ?14
  WHERE id = ?15`;

const UPSERT_OPTION = `INSERT OR REPLACE INTO options (product_id, option_id, title, active, is_default, currency, precision, original, retail,
    promo_amount, promo_code, promo_ends_at, updated_at)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`;

const INSERT_LOCATION = `INSERT OR REPLACE INTO locations (product_id, idx, name, street, city, state, postal_code, latitude, longitude)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`;

/**
 * Deterministic sample, computed entirely in SQL (no full-table read into JS). `base` is the pool
 * of listable, sellable options; `walk` threads an FNV-1a hash over `seed || ':' || option_id`
 * one character per recursion step, in lock-step for every candidate row (xor is `(a|b)-(a&b)`,
 * SQLite has no `^` string-safe operator; the multiply-and-mask keeps every step inside 31 bits so
 * arithmetic never spills into floating point). The same seed always finishes with the same hash
 * per option; a different seed reorders them because the multiply avalanches a one-character
 * change instead of only shifting every hash by a constant. Ties break on option_id for a total order.
 */
const SAMPLE_LISTABLE_OPTIONS_SQL = `WITH RECURSIVE
base AS (
  SELECT o.product_id AS product_id, o.option_id AS option_id, o.title, o.active, o.is_default, o.currency, o.precision,
         o.original, o.retail, o.promo_amount, o.promo_code, o.promo_ends_at,
         (?1 || ':' || o.option_id) AS s
  FROM options o
  JOIN products p ON p.id = o.product_id
  WHERE p.listable = 1 AND (o.active IS NULL OR o.active != 0)
),
walk(product_id, option_id, s, i, h) AS (
  SELECT product_id, option_id, s, 0, 2166136261 FROM base
  UNION ALL
  SELECT product_id, option_id, s, i + 1,
    (((h | unicode(substr(s, i + 1, 1))) - (h & unicode(substr(s, i + 1, 1)))) * 16777619) & 2147483647
  FROM walk WHERE i < length(s)
)
SELECT b.product_id AS product_id, b.option_id AS option_id, b.title, b.active, b.is_default, b.currency, b.precision,
       b.original, b.retail, b.promo_amount, b.promo_code, b.promo_ends_at
FROM walk w
JOIN base b ON b.product_id = w.product_id AND b.option_id = w.option_id
WHERE w.i = length(w.s)
ORDER BY w.h, b.option_id
LIMIT ?2`;
