<!-- Module: docs/lanes/search.md · Tested: n/a -->
# Lane search

**You build:** `src/search/` — full-text search over the catalogue copy, and the search evaluation.
**Keep this export:** `createSearchIndex(db: D1Database): SearchIndex` in `src/search/index.ts`.
**Read first:** `src/contracts/ports.ts` (SearchIndex, SearchQuery, SearchHit), `migrations/0001_catalogue.sql` (products_fts columns and tokenizer), `test/fakes/seed.ts`, `src/lib/us-states.ts`.
**Test with:** `createTestDb()` + `seedCatalogue(db)`. `FakeSearchIndex` in `test/fakes/services.ts` shows the expected results on the fixtures.

## Behaviour

1. Only listable products (they are the only rows in `products_fts`). The hit's option is the **cheapest sellable option** (`active` not 0) of the product; a product without one is not a hit.
2. Build the FTS5 `MATCH` expression from the visitor's text safely: split into words, drop everything that is not a letter or digit, drop the fill words `in at near the a an for of and with`, quote each word, add `*` for prefix match on words of 3 letters or more. **Never pass raw text to MATCH.** Bind it as a parameter.
3. First try all words (AND). No hit: try any word (OR). Rank with `bm25(products_fts, ...)` weighted title 10, short_description 4, description 1, categories 6, places 6. `score` is higher for better hits.
4. Filters: `state` accepts a code or a full name (`stateCode()`); `city` is case-insensitive; `category` matches one category label case-insensitively; `maxPriceMinor` compares with the `retail` of the chosen option. A query with filters and empty text is allowed and orders by `retail` ascending.
5. `limit` default 10, cap 50. One SQL statement per search where possible; never load the table into memory.
6. Text made only of fill words or symbols, with no filter, returns an empty list without touching the database.

## Evaluation

`test/eval/queries.json`: 20 requests written as a shopper would type them ("massage in Chicago", "cheap oil change", "something to do with kids in New York"), each with `expectAnyOf` product ids from the fixtures where the fixtures can answer, and `live: true` for the ones that only the real catalogue can answer. `bin/eval-search.ts` runs the file against an address (`--host`, agent token from `ZAL_AGENT_TOKEN`) through `GET /api/v1/search` and prints per query the top three and a final "N of 20". The unit test runs the fixture-answerable ones against the seeded database.

## Tests you must have

"massage in Chicago" finds `p-massage-chi` first; stemming ("massages"); prefix ("mass"); sold-out, bookable and inactive products never appear; cheapest sellable option chosen for `p-laser-chi`; state by code and by name; city; category; max price; OR fallback; quotes, `*`, `"`, `NEAR`, `OR` and SQL fragments in the text do not break or inject; empty input.
