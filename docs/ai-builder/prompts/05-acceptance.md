<!-- Module: docs/ai-builder/prompts/05-acceptance.md · Tested: n/a -->
# Prompt 11: the acceptance list

What "working" meant for the page, as written in `docs/ops/loop4.md` before the first round and checked by
`bin/walkthrough` on the live site every round. The loop ended after two clean rounds in a row.

## What working means

| Surface | Working means |
|---|---|
| `/top-deals` | Opens with real deals for Things To Do in the city with the most listable products, sorted by amount, 20 ranked rows. The category picker lists Groupon's top categories tagged by the daily walk, things-to-do first, then the leaf labels inside the chosen one; the city picker lists the 50 cities with the most listable products as "City, ST". A chosen pair shows 20 deals (the top three as cards, the rest as ranked rows) or a heading that says "All N"; each deal shows the original price struck through, the price to pay, the saving in money and in percent, and a link to the deal; four tiles sum the list up (biggest saving, typical saving, saved across the top 20, promo codes); "By percent saved" puts the largest percent first; the promo code and promo price appear only in the footnotes, never in a price cell; a city outside the list answers a sentence with a next step, not a 500; before the first category walk the page names when it runs; the page fits 390 px (document scroll width at or under 390). Public, noindex. |
| `category-walk` job | One Workflow instance, 38 `category1` values, things-to-do first, one request per second; one `sync_runs` row per category with counts; a failed category is recorded and skipped, never retried in the same cycle; a walk never writes a product row or moves the watermark. |
| `top-cities` job | 50 rows in `top_cities`, New York, NY first, keyed by city and state, replaced in one write; an empty catalogue keeps yesterday's list. |


## The walkthrough checks for the page

`bin/walkthrough.ts` runs these against the live host, in this order (the check names are the sentences it
prints; a miss prints the reason and the run exits 1):

- the top deals page opens with 20 real deals for the default pair, never empty
- a chosen city and category (New York, NY, beauty-and-spas) returns 20 ranked deals or says why fewer
- sort by percent puts the largest percent first, sort by amount the largest amount
- every deal shows the original above the price to pay; the promo price is only in the footnotes
- a city outside the list answers a sentence, not a 500
- the Top deals link is in the nav of every page

Rounds 3 and 4 (2026-09-30 20:12 and 20:13 UTC): 18 passed, 0 missed, the whole site; document scroll
width 390 px on the phone pages, 1280 px on the desktop pages.
