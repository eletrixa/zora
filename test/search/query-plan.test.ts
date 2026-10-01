/**
 * Guards A2: neither the text-search statement nor the filter-only statement may scan the whole
 * `options` table. Every touch of `options` must go through an index (the primary key or
 * `options_retail`), because with ~57,000 products and ~150,000 options a full scan on every
 * search would be paid for even when only a handful of products match.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/search/query-plan.test.ts
 * Deps:    bun:test, bun:sqlite, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { buildFilterOnlySql, buildTextSql } from "../../src/search/index";
import { createTestDb } from "../fakes/d1";
import { seedCatalogue } from "../fakes/seed";

interface PlanRow {
  readonly detail: string;
}

function planLines(db: ReturnType<typeof createTestDb>, bound: { readonly sql: string; readonly params: readonly unknown[] }): string[] {
  const rows = db.sqlite.query(`EXPLAIN QUERY PLAN ${bound.sql}`).all(...(bound.params as (string | number)[])) as PlanRow[];
  return rows.map((row) => row.detail);
}

/** A line that reads `options` (or its aliases `opt`/`o2`) without going through an index. */
function hasUnindexedOptionsScan(lines: readonly string[]): boolean {
  return lines.some((line) => /^SCAN (options|opt|o2)\b/.test(line) && !/USING (INDEX|COVERING INDEX)/.test(line));
}

describe("query plan never scans the whole options table", () => {
  const db = createTestDb();
  seedCatalogue(db);

  it("text search", () => {
    const lines = planLines(db, buildTextSql("AND", ["massag"], {}, 10));
    expect(hasUnindexedOptionsScan(lines)).toBe(false);
    expect(lines.some((line) => /SEARCH (opt|o2) USING INDEX/.test(line))).toBe(true);
  });

  it("text search with every filter set", () => {
    const lines = planLines(db, buildTextSql("AND", ["massag"], { state: "IL", city: "Chicago", category: "Massage", maxPriceMinor: 9900 }, 10));
    expect(hasUnindexedOptionsScan(lines)).toBe(false);
  });

  it("filter-only search (empty text)", () => {
    const lines = planLines(db, buildFilterOnlySql({ state: "IL" }, 10));
    expect(hasUnindexedOptionsScan(lines)).toBe(false);
    expect(lines.some((line) => /SEARCH (opt|o2) USING INDEX/.test(line))).toBe(true);
  });

  it("filter-only search with every filter set", () => {
    const lines = planLines(db, buildFilterOnlySql({ state: "IL", city: "Chicago", category: "Massage", maxPriceMinor: 9900 }, 10));
    expect(hasUnindexedOptionsScan(lines)).toBe(false);
  });
});

/**
 * A2 regression: on production (43k listable products) a correlated `EXISTS` for the state/city
 * filter let the planner seek `locations_state_city` by state, once PER ROW of the outer loop
 * over every listable product, checking `product_id` afterwards — D1 killed the query on its CPU
 * budget (500, error 7429). `EXPLAIN QUERY PLAN` marks that correlated form as
 * `SEARCH lf EXISTS USING INDEX locations_state_city (state=?)`. The fix seeks `locations` by
 * state/city once as a materialized `IN` list (`LIST SUBQUERY`, no `EXISTS`), so the plan must
 * never show the correlated `EXISTS` form against that index again.
 */
function hasCorrelatedStateCityExists(lines: readonly string[]): boolean {
  return lines.some((line) => /SEARCH \w+ EXISTS USING INDEX locations_state_city/.test(line));
}

describe("state/city filters never drive the plan from the whole products table", () => {
  const db = createTestDb();
  seedCatalogue(db);

  it("filter-only search by state", () => {
    const lines = planLines(db, buildFilterOnlySql({ state: "TX" }, 10));
    expect(hasCorrelatedStateCityExists(lines)).toBe(false);
  });

  it("filter-only search by state and price", () => {
    const lines = planLines(db, buildFilterOnlySql({ state: "IL", maxPriceMinor: 3000 }, 10));
    expect(hasCorrelatedStateCityExists(lines)).toBe(false);
  });

  it("text search combined with a state filter", () => {
    const lines = planLines(db, buildTextSql("AND", ["massag"], { state: "TX" }, 10));
    expect(hasCorrelatedStateCityExists(lines)).toBe(false);
  });
});
