/**
 * Full-text search over the catalogue copy: `SearchIndex` backed by `products_fts` (bm25) plus
 * the state/city/category/price filters, entirely in SQL.
 *
 * Every filter — location, category, "has a sellable option", and max price — is applied
 * BEFORE a product is ranked and cut to the page size: nothing may be cut away before every
 * filter has run, or a cheap match ranked below the cut line would be lost even though it should
 * have won. The "has a sellable option" and "max price" filters are both answered by one EXISTS
 * against `options` keyed on `product_id` (the primary key), so this never scans the whole table.
 * The cheapest sellable option shown per result is picked afterwards by a correlated subquery on
 * the same primary key: it is always the cheapest one overall, which is always at or under the
 * cap when the EXISTS above found one that qualifies (the minimum can only be lower).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/search/index.ts
 * Deps:    src/contracts/ports.ts, src/lib/us-states.ts
 * Tested:  test/search/index.test.ts, test/search/query-plan.test.ts, test/search/ranking.test.ts,
 *          test/search/r1-filters-before-cut.test.ts, test/search/scale.test.ts, test/eval/*.test.ts
 */
import type { SearchHit, SearchIndex, SearchQuery } from "../contracts/ports";
import { stateCode } from "../lib/us-states";

// "cheap"/"cheapest" carry no service or place meaning: they are marketing filler that appears
// in the title of a huge, unrelated slice of the catalogue, so they only dilute a bm25 rank.
const FILL_WORDS: ReadonlySet<string> = new Set([
  "in", "at", "near", "the", "a", "an", "for", "of", "and", "with", "cheap", "cheapest",
]);

// The subset of FILL_WORDS that introduces a place ("massage IN Chicago", "wine tasting NEAR
// Boston"): only a Title Case run right after one of these is taken for a place name, not any
// Title Case word anywhere ("Wine Tasting in Napa" must not lose "Tasting" to place-detection).
const LOCATION_PREPOSITIONS: ReadonlySet<string> = new Set(["in", "at", "near"]);

interface SplitWords {
  /** Lower-case, non-fill words that name what the shopper wants, ranked as usual. */
  readonly words: readonly string[];
  /** Lower-case, non-fill words that name a place, matched only against `places`, never ranked. */
  readonly placeWords: readonly string[];
}

/**
 * Splits visitor text into service words (ranked as before) and place words (a required filter,
 * not a ranked term): a run of Title Case words ("Dallas", not "DALLAS" or "the") right after
 * "in"/"at"/"near" is taken for a place name ("car detailing in Dallas", "kids in New York").
 * Requiring both the preposition and a lower-case second letter keeps an ordinary capitalized
 * service noun, or a shouted/quoted fragment like `NEAR OR`, from being mistaken for a place.
 * This keeps a real place out of the ranked OR-fallback, where one strong place-column match
 * could outrank every result that actually offers the service asked for.
 * When either side comes up empty, everything folds back into `words` — a single bare place
 * name ("Chicago") must still search normally, not become a filter with nothing to filter.
 */
function splitWords(text: string): SplitWords {
  const rawWords: string[] = [];
  const placeWords: string[] = [];
  let afterPreposition = false;
  for (const raw of text.split(/\s+/)) {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleaned.length === 0) continue;
    if (LOCATION_PREPOSITIONS.has(cleaned)) {
      afterPreposition = true;
      continue;
    }
    if (FILL_WORDS.has(cleaned)) continue; // a fill word neither starts nor breaks a place run
    if (afterPreposition && /^[A-Z][a-z]/.test(raw)) placeWords.push(cleaned);
    else {
      afterPreposition = false;
      rawWords.push(cleaned);
    }
  }
  if (rawWords.length === 0 || placeWords.length === 0) return { words: [...rawWords, ...placeWords], placeWords: [] };
  return { words: rawWords, placeWords };
}

/** One word as an FTS5 phrase, prefix-matched from 3 letters. Every non-alnum char is already gone. */
function term(word: string): string {
  const phrase = `"${word}"`;
  return word.length >= 3 ? `${phrase}*` : phrase;
}

// The columns a service word may show real relevance in. `description` is excluded on purpose:
// it is the raw, long marketing copy, and a passing mention there ("self care", "wine pairing
// included") is enough to satisfy a bare MATCH even though bm25 weights it lowest — weight only
// changes rank, never eligibility. Excluding it here keeps a place-gated tier from being won by
// a product that only brushes the word deep in its copy.
const CONTENT_COLUMNS = ["title", "short_description", "categories"] as const;

/**
 * A service word restricted to `CONTENT_COLUMNS`, as an OR across single `column:term` filters.
 * FTS5's `{col1 col2}:term` column-SET filter reads as valid syntax but, measured against
 * production, silently matches every column instead of just the set — so each column is filtered
 * on its own and the results are ORed together, which does restrict correctly (measured).
 */
function contentTerm(word: string): string {
  const phrase = term(word);
  return `(${CONTENT_COLUMNS.map((column) => `${column}:${phrase}`).join(" OR ")})`;
}

/**
 * Service words joined with an explicit FTS5 operator, ranked as usual. Place words are ANDed on
 * afterwards, restricted to the `places` column (FTS5's `column:term` filter) so a place can gate
 * a result without out-ranking a real content match. When a place filter is present, service
 * words are also restricted to `CONTENT_COLUMNS` (see `contentTerm`), so a place-gated tier is
 * never won by a coincidental word deep in the long description. Bound as one MATCH parameter,
 * never concatenated into SQL.
 */
function matchExpr(words: readonly string[], op: "AND" | "OR", placeWords: readonly string[] = []): string {
  const wordTerm = placeWords.length > 0 ? contentTerm : term;
  const main = words.map(wordTerm).join(` ${op} `);
  if (placeWords.length === 0) return main;
  const placeClause = placeWords.map((word) => `places:${term(word)}`).join(" AND ");
  return `(${main}) AND ${placeClause}`;
}

// products_fts column order: product_id (unindexed), title, short_description, description,
// categories, places. bm25 needs one weight per column, including the unindexed one (ignored).
const BM25_WEIGHTS = "0, 10, 4, 1, 6, 6";

interface Row {
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
  readonly city: string | null;
  readonly state: string | null;
  readonly rank: number | null;
}

export interface Filters {
  readonly state?: string;
  readonly city?: string;
  readonly category?: string;
  /** A category1 tag of the daily category walk (product_categories). */
  readonly category1?: string;
  readonly maxPriceMinor?: number;
}

/**
 * state/city/category: answerable from `products` and `locations` alone, never touches `options`.
 *
 * State and city are matched with `id IN (SELECT product_id FROM locations WHERE ...)`, not a
 * correlated `EXISTS (... WHERE lf.product_id = p.id AND lf.state = ?)`. Measured on production
 * (43k listable products, D1): the correlated form lets the planner seek `locations_state_city`
 * by state FIRST and check `product_id` per matching row, instead of seeking `locations` by the
 * outer `product_id` and checking state — for a common state that is ~43,000 outer rows times a
 * few thousand matches each, and D1 kills the query on its CPU budget (error 7429) before it
 * finishes. The `IN` form is planned as one materialized subquery (a bloom filter over matching
 * product ids), built once, then probed per candidate row: ~300ms instead of a timeout. Category
 * stays an `EXISTS` because `json_each` runs over one row's own small JSON array, never a table.
 */
function locationFilters(filters: Filters, alias: string): { readonly sql: string; readonly params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.state !== undefined) {
    clauses.push(`${alias}.id IN (SELECT lf.product_id FROM locations lf WHERE lf.state = ?)`);
    params.push(stateCode(filters.state) ?? filters.state.toUpperCase());
  }
  if (filters.city !== undefined) {
    clauses.push(`${alias}.id IN (SELECT lf.product_id FROM locations lf WHERE lower(lf.city) = lower(?))`);
    params.push(filters.city);
  }
  if (filters.category !== undefined) {
    clauses.push(`EXISTS (SELECT 1 FROM json_each(${alias}.category_labels) jf WHERE lower(jf.value) = lower(?))`);
    params.push(filters.category);
  }
  if (filters.category1 !== undefined) {
    // The same `IN (SELECT ...)` form as the location filters: one materialized set of product ids.
    clauses.push(`${alias}.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)`);
    params.push(filters.category1);
  }
  return { sql: clauses.map((clause) => ` AND ${clause}`).join(""), params };
}

/**
 * "Has a sellable option" (always required), and "has one under the price cap" when a cap was
 * given: one EXISTS against `options`, seeking the `(product_id, option_id)` primary key by
 * `product_id`. Applied before ranking and the LIMIT, never after — see the file header.
 */
function sellableOptionExists(filters: Filters, productIdExpr: string): { readonly sql: string; readonly params: unknown[] } {
  const priceClause = filters.maxPriceMinor === undefined ? "" : " AND o.retail <= ?";
  const params = filters.maxPriceMinor === undefined ? [] : [filters.maxPriceMinor];
  return { sql: ` AND EXISTS (SELECT 1 FROM options o WHERE o.product_id = ${productIdExpr} AND o.active IS NOT 0${priceClause})`, params };
}

/**
 * Joins in the cheapest sellable option of the product named by `productIdExpr` (an already
 * bound column, e.g. `c.product_id`). The inner subquery is correlated: for each candidate it
 * seeks the `(product_id, option_id)` primary key for that one product_id, then sorts and takes
 * the cheapest of that product's (usually few) options. It never reads another product's rows.
 */
function cheapestOptionJoin(productIdExpr: string): string {
  return `
    JOIN options opt ON opt.product_id = ${productIdExpr}
      AND opt.option_id = (
        SELECT o2.option_id FROM options o2
        WHERE o2.product_id = ${productIdExpr} AND o2.active IS NOT 0
        ORDER BY o2.retail ASC, o2.option_id ASC
        LIMIT 1
      )
  `;
}

function toHit(row: Row): SearchHit {
  return {
    productId: row.product_id,
    optionId: row.option_id,
    title: row.title,
    optionTitle: row.option_title,
    city: row.city,
    state: row.state,
    imageUrl: row.image_url,
    currency: row.currency,
    precision: row.precision,
    original: row.original,
    retail: row.retail,
    promoAmount: row.promo_amount,
    promoCode: row.promo_code,
    promoEndsAt: row.promo_ends_at,
    score: row.rank === null ? 1 / (1 + row.retail) : -row.rank,
  };
}

export interface BoundSql {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/**
 * The text-search statement: a `candidates` CTE applies the FTS match, the location filters AND
 * the sellable-option/price filters together, THEN ranks and cuts to `limit` — every filter runs
 * before anything is cut, so a cheap match never loses its place to a pricier one that only
 * ranked higher. The cheapest-option join runs only for the (at most `limit`) survivors.
 * Exported so a test can run `EXPLAIN QUERY PLAN` on exactly the SQL the index executes.
 */
export function buildTextSql(
  op: "AND" | "OR",
  words: readonly string[],
  filters: Filters,
  limit: number,
  placeWords: readonly string[] = [],
): BoundSql {
  const loc = locationFilters(filters, "p");
  const avail = sellableOptionExists(filters, "p.id");
  const sql = `
    WITH candidates AS (
      SELECT p.id AS product_id, p.title, p.image_url, loc.city, loc.state,
             bm25(products_fts, ${BM25_WEIGHTS}) AS rank
      FROM products_fts
      JOIN products p ON p.id = products_fts.product_id
      LEFT JOIN locations loc ON loc.product_id = p.id AND loc.idx = 0
      WHERE products_fts MATCH ?${loc.sql}${avail.sql}
      ORDER BY rank
      LIMIT ?
    )
    SELECT c.product_id, c.title, c.image_url, c.city, c.state, c.rank,
           opt.option_id, opt.title AS option_title, opt.currency, opt.precision, opt.original, opt.retail,
           opt.promo_amount, opt.promo_code, opt.promo_ends_at
    FROM candidates c
    ${cheapestOptionJoin("c.product_id")}
    ORDER BY c.rank
    LIMIT ?
  `;
  return { sql, params: [matchExpr(words, op, placeWords), ...loc.params, ...avail.params, limit, limit] };
}

/**
 * The filter-only statement (empty text): the location, category, sellable-option and price
 * filters all run in the same WHERE, before the ORDER BY and the single LIMIT.
 * Exported so a test can run `EXPLAIN QUERY PLAN` on exactly the SQL the index executes.
 */
export function buildFilterOnlySql(filters: Filters, limit: number): BoundSql {
  const loc = locationFilters(filters, "p");
  const avail = sellableOptionExists(filters, "p.id");
  const sql = `
    SELECT p.id AS product_id, p.title, p.image_url, loc.city, loc.state, NULL AS rank,
           opt.option_id, opt.title AS option_title, opt.currency, opt.precision, opt.original, opt.retail,
           opt.promo_amount, opt.promo_code, opt.promo_ends_at
    FROM products p
    LEFT JOIN locations loc ON loc.product_id = p.id AND loc.idx = 0
    ${cheapestOptionJoin("p.id")}
    WHERE p.listable = 1${loc.sql}${avail.sql}
    ORDER BY opt.retail ASC
    LIMIT ?
  `;
  return { sql, params: [...loc.params, ...avail.params, limit] };
}

export function createSearchIndex(db: D1Database): SearchIndex {
  async function run(bound: BoundSql): Promise<Row[]> {
    const result = await db.prepare(bound.sql).bind(...bound.params).all<Row>();
    return result.results;
  }

  return {
    async search(query: SearchQuery): Promise<readonly SearchHit[]> {
      const { words, placeWords } = splitWords(query.text);
      const filters: Filters = { state: query.state, city: query.city, category: query.category, category1: query.category1, maxPriceMinor: query.maxPriceMinor };
      const hasFilter =
        filters.state !== undefined || filters.city !== undefined || filters.category !== undefined || filters.category1 !== undefined || filters.maxPriceMinor !== undefined;
      if (words.length === 0 && !hasFilter) return [];
      const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);

      if (words.length === 0) {
        const rows = await run(buildFilterOnlySql(filters, limit));
        return rows.map(toHit);
      }

      // Tiers, tried in order, each run only if the one before found nothing: AND on every
      // service word beats OR on some of them, and a real content match beats a place-only
      // match — so AND is tried before OR, and (when a place word was found) WITH the place
      // filter before WITHOUT it. This is what keeps "wine tasting near Boston" pointed at an
      // actual wine tasting business somewhere, rather than an unrelated Boston-area listing
      // that only matched on `places`, once no wine tasting business is Boston itself.
      const tiers: Array<{ readonly op: "AND" | "OR"; readonly place: readonly string[] }> = [{ op: "AND", place: placeWords }];
      if (placeWords.length > 0) tiers.push({ op: "AND", place: [] });
      if (words.length > 1) tiers.push({ op: "OR", place: placeWords });
      if (words.length > 1 && placeWords.length > 0) tiers.push({ op: "OR", place: [] });

      let rows: Row[] = [];
      for (const tier of tiers) {
        rows = await run(buildTextSql(tier.op, words, filters, limit, tier.place));
        if (rows.length > 0) break;
      }
      return rows.map(toHit);
    },
  };
}
