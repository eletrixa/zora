/**
 * The top deals read model: the city and category pickers, the 20 ranked deals of one city (and
 * optional category or label), sorted by the amount saved or by the percent saved, and the picker
 * lists over the whole catalogue that the finder shares.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/top-deals/read-model.ts
 * Deps:    src/contracts/reports.ts, src/contracts/ports.ts, src/lib/money.ts
 * Tested:  test/top-deals/read-model.test.ts, test/top-deals/query-plan.test.ts
 */
import type { PromoNote } from "../contracts/ports";
import type { TopCategory, TopCity, TopDealRow, TopDealsPickers, TopDealsQuery, TopDealsReadModel, TopDealsReport, TopDealsSort, TopLabel } from "../contracts/reports";
import { formatMoney } from "../lib/money";

export const TOP_DEALS_LIMIT = 20;
export const LABEL_LIMIT = 100;

export interface BoundSql {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/** Sort keys come from these two fixed maps, never from input. */
const WINDOW_KEY: Readonly<Record<TopDealsSort, string>> = {
  amount: "(o.original - o.retail)",
  percent: "(CAST(o.original - o.retail AS REAL) / o.original)",
};

const ORDER_KEY: Readonly<Record<TopDealsSort, string>> = {
  amount: "discount_minor",
  percent: "discount_share",
};

/**
 * The 20 ranked deals of one city. The city is the driver (an equality seek on both columns of
 * `locations_state_city`); the category filter is the `IN (SELECT ...)` form, never the
 * correlated `EXISTS` form (that took 46 s on production). Exported so the query-plan test can
 * `EXPLAIN` the exact statement it runs.
 */
export function buildTopDealsSql(query: TopDealsQuery, limit: number = TOP_DEALS_LIMIT): BoundSql {
  const params: unknown[] = [query.state, query.city];
  let categoryClause = "";
  if (query.category1) {
    categoryClause = "\n    AND p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)";
    params.push(query.category1);
  }
  let labelClause = "";
  if (query.label) {
    labelClause = "\n    AND EXISTS (SELECT 1 FROM json_each(p.category_labels) jf WHERE lower(jf.value) = lower(?))";
    params.push(query.label);
  }
  params.push(limit);
  params.push(query.state, query.city);

  const windowKey = WINDOW_KEY[query.sort];
  const orderKey = ORDER_KEY[query.sort];

  const sql = `
    WITH candidates AS (
      SELECT p.id AS product_id, p.title, p.image_url
      FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
      JOIN products p ON p.id = hit.product_id
      WHERE p.listable = 1${categoryClause}${labelClause}
    ),
    ranked AS (
      SELECT c.product_id, c.title, c.image_url,
             o.option_id, o.title AS option_title, o.currency, o.precision, o.original, o.retail, o.promo_amount, o.promo_code, o.promo_ends_at,
             o.original - o.retail AS discount_minor,
             CAST(o.original - o.retail AS REAL) / o.original AS discount_share,
             ROW_NUMBER() OVER (PARTITION BY c.product_id ORDER BY ${windowKey} DESC, o.retail ASC, o.option_id ASC) AS rn
      FROM candidates c
      JOIN options o ON o.product_id = c.product_id
      WHERE o.active IS NOT 0 AND o.original > 0 AND o.original > o.retail
    ),
    top AS (
      SELECT * FROM ranked WHERE rn = 1
      ORDER BY ${orderKey} DESC, product_id ASC
      LIMIT ?
    )
    SELECT t.product_id, t.title, t.image_url, t.option_id, t.option_title, t.currency, t.precision, t.original, t.retail,
           t.promo_amount, t.promo_code, t.promo_ends_at, t.discount_minor, t.discount_share, loc.city, loc.state
    FROM top t
    LEFT JOIN locations loc ON loc.product_id = t.product_id
      AND loc.idx = (SELECT MIN(l2.idx) FROM locations l2 WHERE l2.product_id = t.product_id AND l2.state = ? AND l2.city = ?)
    ORDER BY t.${orderKey} DESC, t.product_id ASC
  `;
  return { sql, params };
}

interface TopCityRow {
  readonly city: string;
  readonly state: string;
  readonly listable_products: number;
  readonly refreshed_at: string;
}

async function topCities(db: D1Database): Promise<{ readonly cities: readonly TopCity[]; readonly refreshedAt: string | null }> {
  const rows = await db.prepare("SELECT city, state, listable_products, refreshed_at FROM top_cities ORDER BY rank ASC").all<TopCityRow>();
  return {
    cities: rows.results.map((row) => ({ city: row.city, state: row.state, listableProducts: row.listable_products })),
    refreshedAt: rows.results[0]?.refreshed_at ?? null,
  };
}

interface CategoryRow {
  readonly category1: string;
  readonly products: number;
}

async function categoriesOf(db: D1Database, state: string, city: string): Promise<readonly TopCategory[]> {
  const rows = await db
    .prepare(
      `SELECT pc.category1, COUNT(*) AS products
       FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
       JOIN products p ON p.id = hit.product_id
       JOIN product_categories pc ON pc.product_id = p.id
       WHERE p.listable = 1
       GROUP BY pc.category1
       ORDER BY (pc.category1 = 'things-to-do') DESC, products DESC, pc.category1 ASC`,
    )
    .bind(state, city)
    .all<CategoryRow>();
  return rows.results.map((row) => ({ category1: row.category1, products: row.products }));
}

/** Every category with a tag, counted over the index alone (no join): the finder's picker. */
async function allCategories(db: D1Database): Promise<readonly TopCategory[]> {
  const rows = await db
    .prepare(
      `SELECT pc.category1, COUNT(*) AS products
       FROM product_categories pc
       GROUP BY pc.category1
       ORDER BY (pc.category1 = 'things-to-do') DESC, products DESC, pc.category1 ASC`,
    )
    .all<CategoryRow>();
  return rows.results.map((row) => ({ category1: row.category1, products: row.products }));
}

interface LabelRow {
  readonly label: string;
  readonly products: number;
}

async function labelsOf(db: D1Database, state: string, city: string, category1: string | undefined): Promise<readonly TopLabel[]> {
  const params: unknown[] = [state, city];
  let categoryClause = "";
  if (category1) {
    categoryClause = "\n    AND p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)";
    params.push(category1);
  }
  params.push(LABEL_LIMIT);
  const rows = await db
    .prepare(
      `SELECT jf.value AS label, COUNT(*) AS products
       FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
       JOIN products p ON p.id = hit.product_id, json_each(p.category_labels) jf
       WHERE p.listable = 1${categoryClause}
       GROUP BY jf.value
       ORDER BY products DESC, label ASC
       LIMIT ?`,
    )
    .bind(...params)
    .all<LabelRow>();
  return rows.results.map((row) => ({ label: row.label, products: row.products }));
}

async function taggedAt(db: D1Database): Promise<string | null> {
  const at = await db.prepare("SELECT MAX(finished_at) AS at FROM sync_runs WHERE kind = 'category' AND status = 'complete'").first<string | null>("at");
  return at ?? null;
}

interface DealRow {
  readonly product_id: string;
  readonly title: string;
  readonly image_url: string | null;
  readonly option_id: string;
  readonly option_title: string;
  readonly currency: string;
  readonly precision: number;
  readonly original: number;
  readonly retail: number;
  readonly promo_amount: number | null;
  readonly promo_code: string | null;
  readonly promo_ends_at: string | null;
  readonly discount_minor: number;
  readonly discount_share: number;
  readonly city: string | null;
  readonly state: string | null;
}

/** The promo rule: a footnote only, set when the promo is actually below retail. Same rule and
 *  sentences as `promoOf` in src/shopping/index.ts. */
function promoOf(row: DealRow): PromoNote | null {
  if (row.promo_amount === null || row.promo_amount >= row.retail) return null;
  const priceText = formatMoney(row.promo_amount, row.currency, row.precision);
  const payText = formatMoney(row.retail, row.currency, row.precision);
  return {
    priceMinor: row.promo_amount,
    priceText,
    code: row.promo_code,
    endsAt: row.promo_ends_at,
    instruction: row.promo_code
      ? `Type code ${row.promo_code} at Groupon checkout to pay ${priceText}. Without it you pay ${payText}.`
      : `Groupon may offer ${priceText} at checkout. Expect to pay ${payText}.`,
  };
}

function toRow(row: DealRow, index: number): TopDealRow {
  return {
    rank: index + 1,
    productId: row.product_id,
    optionId: row.option_id,
    title: row.title,
    optionTitle: row.option_title,
    city: row.city,
    state: row.state,
    imageUrl: row.image_url,
    currency: row.currency,
    precision: row.precision,
    originalMinor: row.original,
    payMinor: row.retail,
    discountMinor: row.discount_minor,
    discountShare: row.discount_share,
    promo: promoOf(row),
  };
}

async function dealsOf(db: D1Database, query: TopDealsQuery): Promise<readonly TopDealRow[]> {
  const bound = buildTopDealsSql(query);
  const rows = await db.prepare(bound.sql).bind(...bound.params).all<DealRow>();
  return rows.results.map(toRow);
}

export function createTopDealsReadModel(db: D1Database): TopDealsReadModel {
  return {
    async report(input: TopDealsQuery): Promise<TopDealsReport> {
      const [{ cities, refreshedAt }, taggedAtValue] = await Promise.all([topCities(db), taggedAt(db)]);
      if (cities.length === 0) {
        return { query: null, cities: [], categories: [], labels: [], rows: [], taggedAt: taggedAtValue, citiesRefreshedAt: null };
      }
      const first = cities[0]!;
      const state = input.state.length > 0 ? input.state : first.state;
      const city = input.city.length > 0 ? input.city : first.city;
      const query: TopDealsQuery = { ...input, state, city };
      const [categories, labels, rows] = await Promise.all([categoriesOf(db, state, city), labelsOf(db, state, city, query.category1), dealsOf(db, query)]);
      return { query, cities, categories, labels, rows, taggedAt: taggedAtValue, citiesRefreshedAt: refreshedAt };
    },
    async pickers(): Promise<TopDealsPickers> {
      const [{ cities, refreshedAt }, categories, taggedAtValue] = await Promise.all([topCities(db), allCategories(db), taggedAt(db)]);
      return { cities, categories, citiesRefreshedAt: refreshedAt, taggedAt: taggedAtValue };
    },
  };
}
