<!-- Module: requests/docs-showcase.md · Tested: n/a -->
# Requests from lane docs-showcase

## Today's price truth match rate, for the release page's outcome measure

What: today's (2026-10-01) count of sampled carts and public pages that matched the catalogue's
retail price, the same shape as `cartSamples` and `publicComparison` in `/data/price-truth.json`
(sampled, matched, mismatch; matchedDeals, showsRetail).

Why: CEO review round 1, finding 13, asks for a measurable shopper outcome with today's number and
the query (`docs/ops/loop5.md`). `docs/ai-builder/evidence.md`, "Outcome measure", carries `<fill>`
for it. docs-showcase has no production access (no secrets, no network) to run
`wrangler d1 execute zorasocial --remote` or read the live `/data/price-truth.json`.

Exact change needed: run the query, give me the day's sampled/matched/mismatch and
matchedDeals/showsRetail counts, and I will fill the `<fill>` in `evidence.md`, "Outcome measure".

**Answered**, CEO review round 3 fixes: the integrator read `/data/price-truth.json` at 04:33 UTC and
gave the 2026-10-01 counts (20 sampled, 20 matched, 0 mismatch; no `publicComparison` row yet for
2026-10-01). Filled into `evidence.md`, "Outcome measure".
