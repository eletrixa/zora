<!-- Module: docs/lanes/catalogue-store.md · Tested: n/a -->
# Lane catalogue-store

**You build:** `src/catalogue/` — writes and reads the catalogue copy in D1.
**Keep these exports** in `src/catalogue/index.ts`: `isListable: ListableRule`, `createCatalogueStore(db: D1Database, clock: Clock): CatalogueStore`.
**Read first:** `src/contracts/ports.ts` (CatalogueStore, StoredProduct, StoredOption, UpsertStats, PriceChangeRow), `migrations/0001_catalogue.sql`, `migrations/0003_prices.sql` (price_changes), `test/fakes/seed.ts` (**the reference for every row you write**), guide lines 484-560 and 1016.
**Test with:** `createTestDb()` from `test/fakes/d1.ts` and `FIXTURE_PRODUCTS`, `freshProducts()`, `LISTABLE_IDS` from `test/fakes/fixtures.ts`.

## Behaviour

1. `isListable`: product `status === "active"`, `availabilityRequired === false`, at least one option with `active !== false`.
2. `upsertProducts` writes products, options, locations and the `products_fts` row **exactly as `seedCatalogue` does** (same columns, same `places` and `categories` text, FTS row only for listable products, delete the old FTS row first). After your upsert of the fixtures, every table must equal what `seedCatalogue` writes, except `content_hash`, which is `sha256Hex(raw_json)`.
3. Unchanged content (equal `content_hash`) updates only `last_seen_at` and `last_seen_run_id`, counts as `unchanged`, and writes no price change.
4. Changed content: `updated_at = seenAt`, options and locations replaced (options that vanished are deleted), and one `price_changes` row per changed `retail`, `original` or promo amount (`field` = `retail` | `original` | `promo`; a promo that appears has `old_minor` NULL, one that ends has `new_minor` NULL). A new product writes no price change.
5. D1 limits: at most 100 bound parameters per statement; send statements with `db.batch([...])` in chunks of at most 40. One page of 50 products must not need more than a handful of batches. Read existing hashes for the page with one query, not one per product.
6. Idempotent: the same call twice gives `unchanged` for everything the second time.
7. `sampleListableOptions(count, seed)`: only listable products, only options with `active` not 0; the same seed gives the same sample, another seed another order; do it in SQL (no full table read).
8. `retireUnseen(runId)`: listable products whose `last_seen_run_id` differs become `listable = 0` and lose their FTS row; returns how many.
9. `priceHistory(productId, limit)`: newest first.
10. `getProduct` returns options and locations in stored order; `categoryLabels` parsed from JSON; booleans as booleans.

## Tests you must have

Row-for-row equality with `seedCatalogue`; listable rule on all thirteen fixtures; unchanged second upsert; price change rows for retail, promo appearing, promo ending; vanished option deleted; FTS row removed when a product stops being listable; deterministic sample; retireUnseen; a page of 50 generated products stays within the parameter limit.

## Review round 2, loop 5 fixes

From the CEO review round 2 of 2026-10-01 03:49 to 03:54 UTC (`docs/ops/loop5.md`, CEO review round 2; the answer verbatim in `docs/ops/loop5/ceo-review-2.txt`, the pages as reviewed in the public snapshot's `review/`). Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green (a new one on main, "Price truth's Options by gap bands add up to its caption's promo count, or say when they arrive", misses on the live site until the monitor and ui-price-truth items land); a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The delta sync crashes on any product with 100 or more options.** Where: `src/catalogue/index.ts`, `upsertProducts`, the stale option delete `DELETE FROM options WHERE product_id = ?1 AND option_id NOT IN (${placeholders(keep.length, 1)})`: one bind per kept option, so a product with 100 or more storable options binds past `?100`, D1's limit. Since 00:01 UTC on 1 Oct every delta call has crashed with `D1_ERROR: variable number must be between ?1 and ?100 at offset 453: SQLITE_ERROR` (`job_runs`, 00:01 and 03:01 UTC), so the catalogue has not been refreshed since 30 Sep 21:01 UTC. The reviewer lists among what is missing: "recovery evidence for the stalled catalogue sync, missed scheduled run". Done looks like: no statement this lane builds binds more than 100 values (the delete split into chunks that keep the meaning, or the options of a product marked by `seen_at` and the unseen ones deleted with a fixed number of binds; the same check on every `placeholders(...)` call); the upsert of one product stays in one batch. Tests: a product with 150 options upserts and a later upsert keeping 120 of them deletes exactly 30; the fake D1 rejects a statement with more than 100 binds (ask the integrator in `requests/catalogue-store.md` if `test/fakes/d1.ts` must learn that limit).

## Review round 3, loop 5 fixes

From the CEO review round 3 of 2026-10-01 04:19 to 04:26 UTC (`docs/ops/loop5.md`, CEO review round 3; the answer verbatim in `docs/ops/loop5/ceo-review-3.txt`, the pages as reviewed in the public snapshot's `review/`, the same nine screenshots now in `docs/ops/loop5/`). 3 stars again; the reject reason: "The product promises price confidence while its catalogue refresh is broken and its monitoring misdescribes the failure." Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green (23 passed, 0 missed at 04:29 UTC, `docs/ops/loop5/walkthrough-review-3.txt`); a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The delta sync still crashes on every call: round 2's item 1 above was never built.** Where: `src/catalogue/index.ts`, `upsertProducts`, the stale option delete `DELETE FROM options WHERE product_id = ?1 AND option_id NOT IN (${placeholders(keep.length, 1)})`, one bind per kept option; a product with 100 or more storable options binds past D1's limit of 100. This lane had no commit after round 2, so the 04:17 UTC release still carries the bug. The reviewer: "docs/ops/loop5.md records two crashed delta attempts and explicitly excludes their fixes from the latest release", and the first of the three changes: "Fix the catalogue sync and crash reporting, then prove recovery and accurate dashboard states with production run evidence and failure-focused tests." Done looks like: round 2's item 1, built: no statement this lane builds binds more than 100 values (check every `placeholders(...)` call), one product's upsert stays in one batch; tests: a product with 150 options upserts, and a later upsert keeping 120 of them deletes exactly 30. The fake D1 now refuses more than 100 bound values as D1 does (`test/fakes/d1.ts`, on main since `c208bd2`), so today's code fails that test: write it first and watch it fail with `variable number must be between ?1 and ?100`.
