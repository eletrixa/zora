<!-- Module: docs/lanes/carts.md · Tested: n/a -->
# Lane carts

**You build:** `src/carts/` — creating, logging, abandoning and sweeping carts.
**Keep these exports** in `src/carts/index.ts`: `createCartService(partner, db, clock): CartService`, `runCartSweep: Job`, `SWEEP_AFTER_MS`.
**Read first:** `src/contracts/ports.ts` (CartService, CartOutcome, CartLineRequest, CartSource, Job), `migrations/0005_commerce.sql` (carts_log), guide lines 568-690.
**Test with:** `FakePartnerClient` + `createTestDb()` + `FakeClock`. `FakeCartService` in `test/fakes/services.ts` shows the outcome mapping.

## Behaviour

1. `create(lines, source)`: refuse before any call when there are 0 or more than 20 lines, a quantity outside 1..100, a non-integer or negative `expectedPriceMinor`, or two lines with the same option (`kind: "error"`, code `BAD_REQUEST`, `meta.httpStatus: null`). Otherwise ONE `partner.createCart` call with every line and `expectedPrice` on each.
2. Outcome mapping: success → `created` (and a `carts_log` row: `status = 'open'`, `line_count`, `total_minor = totals.grandTotal`, `request_id`); `PRICE_MISMATCH` with `currentPrice` → `price_changed` naming the line whose expected price differs (one line: that line; several: the first line, and say so in a comment); `PRODUCT_NOT_CARTABLE`, `INVALID_PRODUCT_ID`, `UNPROCESSABLE_ENTITY` → `unavailable`; everything else → `error`.
3. A created cart whose response has a line with `available: false` is abandoned at once and reported as `unavailable` with the line's `unavailableReason`.
4. `abandon(cartId)`: calls the API, then marks the row `abandoned` with `closed_at`. `INVALID_CART_ID` from the API marks the row `expired` and returns ok (the cart is gone, which is what was wanted). Calling it twice is safe. A cart we never logged is still abandoned at the API.
5. `listOpen(olderThanMs)`: rows with `status = 'open'` created before now minus `olderThanMs`, oldest first.
6. `runCartSweep`: for each source, abandons open carts older than `SWEEP_AFTER_MS[source]`. At most 30 per run. Summary says how many were abandoned and how many failed; `ok` is false when any failed.
7. Never retry cart creation in this lane. The partner client owns retries.

## Tests you must have

Each refusal sends nothing; each outcome; the log row; unavailable line abandons the cart; abandon twice; abandon of an unknown cart; listOpen by age; sweep respects the age per source and the cap of 30.
