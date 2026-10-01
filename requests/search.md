# Requests from search

## No migration needed for the state/city 500

The fix for `GET /api/v1/search?state=TX` did not need a schema change. It was a query-shape bug:
the state/city filter used a correlated `EXISTS` that let D1's planner seek `locations_state_city`
by state, once per row of an outer loop over every listable product, instead of by the outer
product id — D1 killed it on its CPU budget. Rewriting it as `id IN (SELECT product_id FROM
locations WHERE state = ?)` (a materialized bloom filter, built once) fixed it using the existing
`locations_state_city` index, measured on production at ~350ms. Nothing to add here.

## Optional, not blocking: an index for the cheapest-option lookup

`cheapestOptionJoin` in `src/search/index.ts` picks the cheapest active option per candidate with
a correlated subquery on `options` scoped by the `(product_id, option_id)` primary key, then sorts
that product's (usually few) options by `retail` in memory — fine today, measured on production at
a few hundred ms even for a state with ~7,000 candidates. If the catalogue grows enough that this
becomes the bottleneck, `CREATE INDEX options_product_active_retail ON options (product_id, active,
retail);` would let that per-product sort use the index instead of a temp b-tree. Not needed now.
