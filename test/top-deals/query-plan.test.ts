/**
 * Guards A2 for top deals: the deals statement must seek `locations` by state and city through
 * `locations_state_city`, and never scan the whole `options` or `products` table, over every
 * combination of category1, label and both sorts. The correlated `EXISTS` form of the state/city
 * filter took 46 s on production; the `IN (SELECT ...)` form must be what runs here.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/top-deals/query-plan.test.ts
 * Deps:    bun:test, bun:sqlite, src/top-deals/read-model.ts, test/fakes/d1.ts, test/fakes/seed.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { TopDealsQuery } from "../../src/contracts/reports";
import { buildTopDealsSql } from "../../src/top-deals/read-model";
import { createTestDb } from "../fakes/d1";
import { seedCatalogue, seedCategories } from "../fakes/seed";

interface PlanRow {
  readonly detail: string;
}

function planLines(db: ReturnType<typeof createTestDb>, query: TopDealsQuery): string[] {
  const bound = buildTopDealsSql(query);
  const rows = db.sqlite.query(`EXPLAIN QUERY PLAN ${bound.sql}`).all(...(bound.params as (string | number)[])) as PlanRow[];
  return rows.map((row) => row.detail);
}

/** A line that reads `options` or `products` (or their aliases `o`/`p`) without going through an index. */
function hasUnindexedScan(lines: readonly string[]): boolean {
  return lines.some((line) => /^SCAN (options|o|products|p)\b/.test(line) && !/USING (INDEX|COVERING INDEX)/.test(line));
}

function seeksStateCity(lines: readonly string[]): boolean {
  return lines.some((line) => /USING (COVERING )?INDEX locations_state_city/.test(line));
}

describe("query plan of the top deals statement", () => {
  const db = createTestDb();
  seedCatalogue(db);
  seedCategories(db);

  const category1Values: readonly (string | undefined)[] = [undefined, "beauty-and-spas"];
  const labelValues: readonly (string | undefined)[] = [undefined, "Massage"];
  const sorts: readonly TopDealsQuery["sort"][] = ["amount", "percent"];

  for (const sort of sorts) {
    for (const category1 of category1Values) {
      for (const label of labelValues) {
        const name = `sort=${sort} category1=${category1 ?? "none"} label=${label ?? "none"}`;
        it(`seeks locations by state and city and never scans options or products (${name})`, () => {
          const lines = planLines(db, { city: "Chicago", state: "IL", sort, category1, label });
          expect(hasUnindexedScan(lines)).toBe(false);
          expect(seeksStateCity(lines)).toBe(true);
        });
      }
    }
  }
});
