/**
 * Runs the fixture-answerable entries of test/eval/queries.json straight through
 * `createSearchIndex` against the seeded database. The `live: true` entries need the real
 * catalogue and are skipped here; bin/eval-search.ts runs the whole file against a live host.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/eval/against-fixtures.test.ts
 * Deps:    bun:test, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts, test/eval/queries.json
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import queries from "./queries.json";
import { createSearchIndex } from "../../src/search/index";
import { createTestDb } from "../fakes/d1";
import { seedCatalogue } from "../fakes/seed";

interface EvalQuery {
  readonly text: string;
  readonly state?: string;
  readonly city?: string;
  readonly category?: string;
  readonly maxPriceMinor?: number;
  readonly limit?: number;
  readonly expectAnyOf: readonly string[];
  readonly live?: boolean;
}

const fixtureAnswerable = (queries as EvalQuery[]).filter((query) => !query.live);

describe("test/eval/queries.json against the seeded fixtures", () => {
  const db = createTestDb();
  seedCatalogue(db);
  const index = createSearchIndex(db.d1);

  it.each(fixtureAnswerable.map((query) => [query.text, query] as const))("%s", async (_text, query) => {
    const hits = await index.search({ text: query.text, state: query.state, city: query.city, category: query.category, maxPriceMinor: query.maxPriceMinor, limit: query.limit });
    expect(hits.some((hit) => query.expectAnyOf.includes(hit.productId))).toBe(true);
  });

  it("answers at least 16 of the 20 as the plan requires", async () => {
    let passed = 0;
    for (const query of queries as EvalQuery[]) {
      const hits = await index.search({ text: query.text, state: query.state, city: query.city, category: query.category, maxPriceMinor: query.maxPriceMinor, limit: query.limit });
      if (query.expectAnyOf.length === 0 || hits.some((hit) => query.expectAnyOf.includes(hit.productId))) passed++;
    }
    expect(passed).toBeGreaterThanOrEqual(16);
  });
});
