<!-- Module: docs/lanes/shopping.md · Tested: n/a -->
# Lane shopping

**You build:** `src/shopping/` — the one service behind the HTTP API, the MCP server and the pages.
**Keep this export:** `createShoppingService(parts: ShoppingParts): ShoppingService` and `interface ShoppingParts` in `src/shopping/index.ts`.
**Read first:** `src/contracts/ports.ts` (ShoppingService, DealCard, PromoNote, DealDetail, CheckoutResult, OrderStatusResult, CartSource), `migrations/0005_commerce.sql` (orders, agent_requests), `cardOf()` in `test/fakes/services.ts` (the reference for a card), guide lines 636-660 and 692-847.
**Test with:** `makeWorld()`; use its fake search, catalogue, carts and partner.

## Behaviour

1. **The price rule.** `payMinor` is always `retail`. `promo` is set only when the option has a promo amount lower than retail. `promo.instruction` is exactly:
   - with a code: `Type code <CODE> at Groupon checkout to pay <promo>. Without it you pay <retail>.`
   - without a code: `Groupon may offer <promo> at checkout. Expect to pay <retail>.`
   Money text comes from `formatMoney`.
2. `searchDeals(query, channel)`: `search.search(query)` mapped to cards, same order.
3. `getDeal(productId)`: from the catalogue. `null` when unknown or not listable. The card fields describe the cheapest sellable option; `options` lists every option with `sellable = active !== false`.
4. `createCheckoutLink(items, channel)`: 1 to 20 items, quantity 1..100, else `error` `BAD_REQUEST`. Each item is looked up in the catalogue: unknown → `not_found`; product not listable or option inactive → `unavailable`. The expected price is the catalogue `retail`. Then `carts.create(lines, channel)` and map: `created` → `link` with `buyLink` **verbatim**, totals from the cart, lines from the cart items, `expiresAt` from the cart; `price_changed` → `price_changed` with both prices and `nowText`; `unavailable` → `unavailable`; `error` → `error` with the code.
5. `getOrderStatus(uuid)`: `partner.getBooking`. `pending` is true for `ON_HOLD` and `PENDING`. Line titles come from the catalogue by `productId` (null when the product is gone). One `OrderVoucher` per unit item with its `myGrouponUrl`. `INVALID_BOOKING_UUID` → `not_found`. When an `orders` row exists for the uuid, update `status`, `last_checked_at`, `raw_json`; when none exists, insert one with `source = 'manual'`.
6. **Every call writes one `agent_requests` row**: channel, tool (`search_deals`, `get_deal`, `create_checkout_link`, `get_order_status`), the query text (search text, product id or order uuid), result count, latency from the clock, outcome (`ok`, `empty`, `price_changed`, `unavailable`, `not_found`, `error`). A failed log write never fails the call.
7. The service never throws for an expected failure.

## Tests you must have

Card equals `cardOf` for every fixture hit; both instruction sentences; no promo when promo is not lower than retail; checkout link verbatim; price change after `partner.setRetail`; bookable product unavailable; unknown option not found; order pending and confirmed with vouchers; order row updated and inserted; one log row per call with the right outcome.
