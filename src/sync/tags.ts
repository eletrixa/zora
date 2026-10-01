/**
 * The category1 tags of products in product_categories, as SQL only. Written by the category walk:
 * a tag per product seen on a page, and the drop of the tags a complete walk did not see.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/sync/tags.ts
 * Deps:    D1 (tables product_categories and products, migrations/0009_top_deals.sql)
 * Tested:  test/sync/category.test.ts
 */

// SQLite needs the SELECT ... WHERE form for an upsert over INSERT ... SELECT. The EXISTS keeps out a
// product the catalogue does not hold yet: D1's foreign key would refuse it, bun:sqlite would not.
const TAG_SQL =
  "INSERT INTO product_categories (product_id, category1, run_id, tagged_at) SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM products WHERE id = ?1) " +
  "ON CONFLICT (product_id, category1) DO UPDATE SET run_id = excluded.run_id, tagged_at = excluded.tagged_at";

/** Tags one product with one category for a walk, or does nothing when the catalogue lacks the product. */
export function tagStatement(db: D1Database, productId: string, category1: string, runId: string, at: string): D1PreparedStatement {
  return db.prepare(TAG_SQL).bind(productId, category1, runId, at);
}

/** Tags the products of one page in one batch. An empty page writes nothing. */
export async function tagProducts(db: D1Database, runId: string, category1: string, productIds: readonly string[], at: string): Promise<void> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return;
  await db.batch(unique.map((productId) => tagStatement(db, productId, category1, runId, at)));
}

/** Drops the tags of a category that another walk wrote: the products this walk no longer found there. */
export function untagOthersStatement(db: D1Database, category1: string, runId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM product_categories WHERE category1 = ?1 AND run_id != ?2").bind(category1, runId);
}
