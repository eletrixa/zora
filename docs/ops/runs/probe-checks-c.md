<!--
Run notes for lane probe-checks-c: what the live probe found and what was fixed.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  docs/ops/runs/probe-checks-c.md
Deps:    n/a
Tested:  n/a
-->

## 2026-09-30 11:22 UTC live probe run — cart-lifecycle failures

The live probe run against production failed three steps of `cart-lifecycle`:

1. `abandon`: "expected status ABANDONED, got ACTIVE". The partner guide (`docs/reference/partner-guide-v7.txt`,
   section "Abandon a cart") says abandon returns no body, and a read afterwards returns an empty cart
   (`itemCount: 0`) or `INVALID_PRODUCT_ID` on further writes. It never promises status `ABANDONED`.
2. `change` and `totals`: "expected line total 15930, got 7965" after a quantity-2 PATCH with `expectedPrice`
   set to retail. The old detail did not say whether the API ignored the new quantity or returned quantity 2
   with an unmultiplied `lineTotal`.

## Fix

`src/probe/checks/cart-lifecycle.ts`:

- `abandon` now passes on `ABANDONED`, on an empty cart, or on `INVALID_CART_ID`. It fails only when the cart
  still holds items and is not `ABANDONED`, and the detail names the item count and status.
- `change` and `totals` failure details now include the line's `quantity`, `unitPrice` (`pricing.retail`),
  `lineTotal`, and the cart's `grandTotal`, and call out the two known-shape failures by name.

Verified against the fakes with new tests in `test/probe/checks/cart-lifecycle.test.ts`; the live production
run itself was not re-run as part of this fix.

Gates: `bun run typecheck`, `bun test` (535 pass), `bun bin/lane-check.ts probe-checks-c` — all green.
