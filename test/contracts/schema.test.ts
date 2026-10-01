/**
 * The migrations apply cleanly, hold every table the lanes write to, and FTS5 answers a query.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/contracts/schema.test.ts
 * Deps:    bun:test, test/fakes/d1.ts, migrations/*.sql
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createTestDb } from "../fakes/d1";

const TABLES = [
  "agent_requests",
  "auth_attempts",
  "cart_samples",
  "carts_log",
  "contract_snapshots",
  "drift_events",
  "findings",
  "guide_observations",
  "job_runs",
  "locations",
  "options",
  "orders",
  "price_changes",
  "probe_runs",
  "probe_steps",
  "product_categories",
  "products",
  "products_fts",
  "promo_gap_bands",
  "promo_gap_snapshots",
  "public_price_observations",
  "sync_runs",
  "sync_state",
  "top_cities",
];

describe("schema", () => {
  it("rejects a statement with more than 100 bound values, as D1 does", async () => {
    // CEO review round 3 (loop 5): production crashed on this limit while the fake accepted any count.
    const { d1 } = createTestDb();
    const ids = Array.from({ length: 101 }, (_, n) => `o-${n}`);
    const marks = ids.map((_, n) => `?${n + 1}`).join(", ");
    expect(() => d1.prepare(`SELECT 1 WHERE 'x' NOT IN (${marks})`).bind(...ids)).toThrow("variable number must be between ?1 and ?100");
    expect(await d1.prepare(`SELECT 1 AS one WHERE 'x' NOT IN (${marks.split(", ").slice(0, 100).join(", ")})`).bind(...ids.slice(0, 100)).first<number>("one")).toBe(1);
  });
  it("creates every table", () => {
    const { sqlite } = createTestDb();
    const names = (sqlite.query("SELECT name FROM sqlite_master WHERE type IN ('table') ORDER BY name").all() as { name: string }[]).map((row) => row.name);
    for (const table of TABLES) expect(names).toContain(table);
  });

  it("answers a full-text query with stemming and ranks by bm25", async () => {
    const { d1 } = createTestDb();
    await d1
      .prepare("INSERT INTO products_fts (product_id, title, short_description, description, categories, places) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind("p1", "Swedish Massage at Foot Smile Spa", "A relaxing massage", "", "Beauty & Spas Massage", "Foot Smile Spa Chicago IL Illinois")
      .run();
    await d1
      .prepare("INSERT INTO products_fts (product_id, title, short_description, description, categories, places) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind("p2", "Oil Change", "Synthetic oil", "", "Automotive", "Lakeview Auto Chicago IL Illinois")
      .run();
    const hits = await d1.prepare("SELECT product_id FROM products_fts WHERE products_fts MATCH ?1 ORDER BY bm25(products_fts)").bind("massages chicago").all<{ product_id: string }>();
    expect(hits.results.map((row) => row.product_id)).toEqual(["p1"]);
  });

  it("removes options and locations with their product", () => {
    const { sqlite } = createTestDb();
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(
      "INSERT INTO products (id, title, status, raw_json, content_hash, first_seen_at, updated_at, last_seen_at, last_seen_run_id) VALUES ('p', 't', 'active', '{}', 'h', 'a', 'a', 'a', 'r')",
    );
    sqlite.exec("INSERT INTO options (product_id, option_id, currency, precision, original, retail, updated_at) VALUES ('p', 'o', 'USD', 2, 200, 100, 'a')");
    sqlite.exec("INSERT INTO locations (product_id, idx, city, state) VALUES ('p', 0, 'Chicago', 'IL')");
    sqlite.exec("DELETE FROM products WHERE id = 'p'");
    expect((sqlite.query("SELECT COUNT(*) AS n FROM options").get() as { n: number }).n).toBe(0);
    expect((sqlite.query("SELECT COUNT(*) AS n FROM locations").get() as { n: number }).n).toBe(0);
  });
});
