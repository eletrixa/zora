<!-- Module: docs/lanes/top-deals.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 15:37 UTC, model sonnet -->
# Lane top-deals

**You build:** `src/top-deals/`: the daily top cities job and the top deals read model (the pickers and the 20 ranked rows for one city and one category, sorted by the amount saved or by the percent saved).
**Keep these exports:** in `src/top-deals/index.ts` `createTopDealsReadModel(db: D1Database): TopDealsReadModel` and `runTopCitiesRefresh: Job` (the stub is there; `src/container.ts` and `src/cron.ts` import them by name). Add `src/top-deals/cities.ts` (`TOP_CITY_COUNT`, `runTopCitiesRefresh`) and `src/top-deals/read-model.ts` (`TOP_DEALS_LIMIT`, `LABEL_LIMIT`, `BoundSql`, `buildTopDealsSql`, `createTopDealsReadModel`); `index.ts` re-exports them.
**Read first:** `src/contracts/reports.ts` (the top deals section: `TopDealsQuery`, `TopCity`, `TopCategory`, `TopLabel`, `TopDealRow`, `TopDealsReport`, `TopDealsReadModel`), `src/contracts/ports.ts` (`Job`, `JobSummary`, `PromoNote`), `migrations/0001_catalogue.sql` (products, options, locations and their indexes), `migrations/0009_top_deals.sql`, `src/monitor/read-model.ts` (`worstGaps`: the `ROW_NUMBER` device and the row mapping style), `src/shopping/index.ts` `promoOf` (the promo rule and the two sentences you copy exactly), `src/lib/money.ts` (`formatMoney`), `test/search/query-plan.test.ts` (how a query plan is asserted on bun:sqlite), `test/fakes/fixtures.ts` (`FIXTURE_SPECS`, `FIXTURE_CATEGORY1`, `makeProduct`), `test/fakes/seed.ts` (`seedCatalogue`, `seedCategories`), `test/fakes/env.ts` (`makeWorld`).
**Test with:** `createTestDb()` + `seedCatalogue(db)` + `seedCategories(db)` on real bun:sqlite; `makeWorld()` for the job.

## Behaviour

1. **Top cities job** (`cities.ts`, `JobSummary.job` `"top-cities"`, `TOP_CITY_COUNT = 50`). Read, with `?1 = TOP_CITY_COUNT`:

```sql
SELECT l.city AS city, l.state AS state, COUNT(DISTINCT l.product_id) AS listable_products
FROM locations l
WHERE l.city IS NOT NULL AND l.city != '' AND l.state IS NOT NULL AND l.state != ''
  AND l.product_id IN (SELECT id FROM products WHERE listable = 1)
GROUP BY l.state, l.city
ORDER BY listable_products DESC, l.state ASC, l.city ASC
LIMIT ?1
```

   When at least one row came back: one `db.batch` of `DELETE FROM top_cities` followed by one `INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES (?1, ?2, ?3, ?4, ?5)` per row (rank = index + 1, `refreshed_at = iso(deps.clock.now())`); one batch is one transaction, so a page never reads an empty list. No rows (empty catalogue): write nothing, answer `ok: false`, `No listable product has a city yet; the list was left as it was.` Success summary: `50 cities ranked by listable products; New York, NY leads with 1,603.` (numbers through `toLocaleString("en-US")`). `COUNT(DISTINCT ...)` because a product with two locations in one city counts once; the key is `(city, state)` exactly as stored, so Hollywood, FL and Hollywood, CA stay apart.

2. **The deals query** (`read-model.ts`). `buildTopDealsSql(query, limit = TOP_DEALS_LIMIT): BoundSql` (`{ sql, params }`) is exported so the query-plan test can `EXPLAIN` the exact statement. Sort keys come from two fixed maps, never from input: `WINDOW_KEY = { amount: "(o.original - o.retail)", percent: "(CAST(o.original - o.retail AS REAL) / o.original)" }` and `ORDER_KEY = { amount: "discount_minor", percent: "discount_share" }`. The statement; the `[...]` clauses only when the query has that field; params in order: state, city, category1?, label?, limit, state, city:

```sql
WITH candidates AS (
  SELECT p.id AS product_id, p.title, p.image_url
  FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
  JOIN products p ON p.id = hit.product_id
  WHERE p.listable = 1
    [AND p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)]
    [AND EXISTS (SELECT 1 FROM json_each(p.category_labels) jf WHERE lower(jf.value) = lower(?))]
),
ranked AS (
  SELECT c.product_id, c.title, c.image_url,
         o.option_id, o.title AS option_title, o.currency, o.precision, o.original, o.retail, o.promo_amount, o.promo_code, o.promo_ends_at,
         o.original - o.retail AS discount_minor,
         CAST(o.original - o.retail AS REAL) / o.original AS discount_share,
         ROW_NUMBER() OVER (PARTITION BY c.product_id ORDER BY <WINDOW_KEY> DESC, o.retail ASC, o.option_id ASC) AS rn
  FROM candidates c
  JOIN options o ON o.product_id = c.product_id
  WHERE o.active IS NOT 0 AND o.original > 0 AND o.original > o.retail
),
top AS (
  SELECT * FROM ranked WHERE rn = 1
  ORDER BY <ORDER_KEY> DESC, product_id ASC
  LIMIT ?
)
SELECT t.product_id, t.title, t.image_url, t.option_id, t.option_title, t.currency, t.precision, t.original, t.retail,
       t.promo_amount, t.promo_code, t.promo_ends_at, t.discount_minor, t.discount_share, loc.city, loc.state
FROM top t
LEFT JOIN locations loc ON loc.product_id = t.product_id
  AND loc.idx = (SELECT MIN(l2.idx) FROM locations l2 WHERE l2.product_id = t.product_id AND l2.state = ? AND l2.city = ?)
ORDER BY t.<ORDER_KEY> DESC, t.product_id ASC
```

   Why this shape, so you do not change it: the city is the driver (an equality seek on both columns of `locations_state_city`; exact match, never `lower()` on the column, the values come from the picker); the category filter is the `IN (SELECT ...)` form that survived D1's CPU limit in the search lane (the correlated `EXISTS ... lf.product_id = p.id` form took 46 s on production: never write it); `ROW_NUMBER` runs only over the candidates' options; the location shown is the product's first location in the chosen city (`MIN(idx)` within the city; `idx = 0` may be another town); ties break by cheaper option, then by `product_id`, so two requests answer the same order. On production this answers New York in 145 to 371 ms.

3. **Picker and freshness queries**, same read model (params: state, city, and category1 for the labels when the query has it):

```sql
-- cities, rank order (refreshed_at rides along)
SELECT city, state, listable_products, refreshed_at FROM top_cities ORDER BY rank ASC;

-- categories present in the chosen city, things-to-do first, then by size
SELECT pc.category1, COUNT(*) AS products
FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
JOIN products p ON p.id = hit.product_id
JOIN product_categories pc ON pc.product_id = p.id
WHERE p.listable = 1
GROUP BY pc.category1
ORDER BY (pc.category1 = 'things-to-do') DESC, products DESC, pc.category1 ASC;

-- leaf labels in the chosen city (and category), by size, at most LABEL_LIMIT = 100
SELECT jf.value AS label, COUNT(*) AS products
FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
JOIN products p ON p.id = hit.product_id, json_each(p.category_labels) jf
WHERE p.listable = 1
  [AND p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)]
GROUP BY jf.value
ORDER BY products DESC, label ASC
LIMIT ?;

-- freshness of the tags
SELECT MAX(finished_at) AS at FROM sync_runs WHERE kind = 'category' AND status = 'complete';
```

4. **`report(query)`.** Read the cities and the tag freshness first. If `query.city` or `query.state` is empty, take `cities[0]`. If there is no city at all (before the first refresh), answer `{ query: null, cities: [], categories: [], labels: [], rows: [], taggedAt, citiesRefreshedAt: null }`. Otherwise run the categories, labels and deals queries with `Promise.all` and answer `query` with the city and state filled in. Row mapping: `rank = index + 1`, `originalMinor = original`, `payMinor = retail` (THE price the shopper pays, rule 2), `discountMinor = discount_minor`, `discountShare = discount_share`, `promo` built exactly like `promoOf` in `src/shopping/index.ts` (null unless `promo_amount` is not null and below `retail`; `priceText` and `payText` through `formatMoney`; the same two instruction sentences, code or no code; `endsAt = promo_ends_at`). No other formatting in the read model. `citiesRefreshedAt` is the `refreshed_at` of the first city row.

5. Every value bound (`?`), never concatenated; the only interpolated pieces are the two fixed-map keys and the optional clauses.

## Tests you must have

`test/top-deals/read-model.test.ts`, on real bun:sqlite with the fixtures, hand-calculated Chicago, IL numbers stated in the test: laser 50000/9900 saves 40100 (80.2 %); bowling 9000/3900 saves 5100 (56.7 %); massage 90-minute 12000/6900 saves 5100 (42.5 %) and its 60-minute option only 3100; oil 8999/4499 saves 4500 (50.0 %); pizza 5000/2900 saves 2100 (42.0 %); sold out, kayak (availability required) and car wash (inactive option) are not listable or not sellable.

- ranks Chicago by discount in money: laser, bowling, massage, oil, pizza (bowling before massage on the 5100 tie by product id)
- ranks Chicago by discount in percent: laser, bowling, oil, massage, pizza
- keeps one row per product and picks the option with the largest discount (massage row is `o-massage-chi-90` under both sorts)
- skips an option whose original price is 0
- skips an option whose original price is not above retail
- skips inactive options and products that are not listable
- keeps Hollywood, FL apart from Hollywood, CA
- filters by the category1 tag, so things-to-do in Chicago is bowling alone
- lists a product under each of its categories, so food-and-drink in Chicago is bowling then pizza
- filters by a leaf label, case-insensitive
- caps the list at 20 rows and numbers them 1 to 20 (25 `makeProduct` products in one city)
- answers the first city of the list when the request names none (Chicago, IL with 5 listable products)
- lists the categories of the chosen city with things-to-do first (Chicago: things-to-do 1, beauty-and-spas 2, food-and-drink 2, automotive 1)
- lists the leaf labels of the chosen city and category by size (Chicago, beauty-and-spas: Beauty & Spas 2, Hair Removal 1, Massage 1)
- shows the location in the chosen city, not the product's first location (a product whose idx 0 is Evanston)
- carries the promo of the winning option as a footnote value with payMinor equal to retail (oil: promo 3599 AUTO20, payMinor 4499, the instruction sentence; massage: promo null because the 90-minute option won)
- answers null tag freshness before the first category walk and the newest finish after
- answers an empty report with no city before the first refresh

`test/top-deals/query-plan.test.ts`: seeks locations by state and city and never scans options or products, over every combination of category1, label and both sorts (no `EXPLAIN QUERY PLAN` line matching `/^SCAN (options|o|products|p)\b/` without `USING`, and one line matching `/USING (COVERING )?INDEX locations_state_city/`).

`test/top-deals/cities.test.ts`: ranks cities by listable products keyed by city and state (Chicago IL 5, New York NY 2, then Los Angeles CA, Miami FL, Evanston IL, Austin TX at 1, in the ORDER BY's tie order); counts a product with two locations in one city once; replaces yesterday's list in one write; keeps the old list when the catalogue has no listable product (`ok: false`); caps the list at 50; answers a job summary that names the first city.

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/top-deals`, on branch `lane/top-deals`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts top-deals` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/top-deals.md` (what, why, the exact change) and you build against what exists. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts top-deals
```

Your changelog lines go in `changes/top-deals.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/top-deals.md`: `| 2026-09-30 hh:mm | what you built | top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `top-deals: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.
