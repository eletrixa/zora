/**
 * The daily top cities job: ranks the fifty cities with the most listable products and replaces
 * `top_cities` in one write.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/top-deals/cities.ts
 * Deps:    src/contracts/ports.ts, src/lib/clock.ts
 * Tested:  test/top-deals/cities.test.ts
 */
import type { Job } from "../contracts/ports";
import { iso } from "../lib/clock";

export const TOP_CITY_COUNT = 50;

const RANK_SQL = `
  SELECT l.city AS city, l.state AS state, COUNT(DISTINCT l.product_id) AS listable_products
  FROM locations l
  WHERE l.city IS NOT NULL AND l.city != '' AND l.state IS NOT NULL AND l.state != ''
    AND l.product_id IN (SELECT id FROM products WHERE listable = 1)
  GROUP BY l.state, l.city
  ORDER BY listable_products DESC, l.state ASC, l.city ASC
  LIMIT ?1
`;

interface CityRow {
  readonly city: string;
  readonly state: string;
  readonly listable_products: number;
}

export const runTopCitiesRefresh: Job = async (deps) => {
  const startedAt = iso(deps.clock.now());
  const ranked = await deps.db.prepare(RANK_SQL).bind(TOP_CITY_COUNT).all<CityRow>();
  const rows = ranked.results;
  if (rows.length === 0) {
    return {
      job: "top-cities",
      ok: false,
      startedAt,
      finishedAt: iso(deps.clock.now()),
      summary: "No listable product has a city yet; the list was left as it was.",
    };
  }
  const refreshedAt = iso(deps.clock.now());
  const statements = [
    deps.db.prepare("DELETE FROM top_cities"),
    ...rows.map((row, index) =>
      deps.db
        .prepare("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(row.city, row.state, row.listable_products, index + 1, refreshedAt),
    ),
  ];
  await deps.db.batch(statements);
  const leader = rows[0]!;
  return {
    job: "top-cities",
    ok: true,
    startedAt,
    finishedAt: iso(deps.clock.now()),
    summary: `${rows.length.toLocaleString("en-US")} cities ranked by listable products; ${leader.city}, ${leader.state} leads with ${leader.listable_products.toLocaleString("en-US")}.`,
  };
};
