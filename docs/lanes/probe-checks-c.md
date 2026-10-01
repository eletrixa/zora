<!-- Module: docs/lanes/probe-checks-c.md · Tested: n/a -->
# Lane probe-checks-c

**You build:** three checks in `src/probe/checks/`: `cart-lifecycle.ts`, `price-mismatch.ts`, `buy-link.ts`, and their tests in `test/probe/checks/`.
**Read first:** `src/contracts/ports.ts` (ProbeCheck, ProbeContext, PartnerClient cart methods, CartService, CatalogueStore.sampleListableOptions) (the rules for every check are at the end of this brief), guide lines 568-700.

Each check picks its options with `ctx.catalogue.sampleListableOptions(2, <check name + UTC day>)`. An empty catalogue: every step is `skip` ("the catalogue copy is empty").

## The checks

**cart-lifecycle** — Steps in order: `create` (`ctx.carts.create` one line, quantity 1, expected price = the option's `retail`, outcome `created`); `read` (`partner.getCart` returns the same id, one item, `totals.grandTotal` = retail); `add` (`partner.addCartItems` with the second option; two items; **if it times out do not retry, read the cart and report what is there**); `change` (`partner.updateCartItem` quantity 2 on the first item; line total = 2 × retail); `remove` (`partner.removeCartItem` of the second item; one item left); `totals` (grand total equals the sum of line totals; `grandTotal` excludes tax and promo, so it must equal `retail × quantity`); `abandon` (`ctx.carts.abandon`, then `getCart` shows status `ABANDONED` or an `INVALID_CART_ID` error; both pass). With one option only, `add` and `remove` are `skip`.

**price-mismatch** — `partner.createCart` with `expectedPrice` = retail + 1 (raw partner call, because the cart service would hide the detail). Steps: `refused` (the call fails with `PRICE_MISMATCH`; a created cart is a `fail` and is abandoned); `current-price` (`error.currentPrice` is an integer and equals the catalogue `retail`; when it differs the detail says both, and the verdict is still `pass` because the catalogue copy may be hours old, but the detail starts with "catalogue copy is stale:").

**buy-link** — creates a cart through `ctx.carts.create`. Steps: `present` (`buyLink` is a non-empty `https://` address); `host` (its host is `ctx.config.checkoutHost`, or a CJ host when the registration has a CJ id; here it is `partner.groupon.com`); `reachable` (`ctx.fetch(buyLink, { redirect: "manual", headers: { "user-agent": ... } })` answers 200 or a 3xx; the body is never read and no redirect is followed); then abandon.
## Rules for every check

1. Export `check: ProbeCheck` with the fixed `name`. `run(ctx)` **never throws**: wrap the body, a crash is a `fail` step named `crashed`.
2. A check reads and calls; it **never writes to the database** (the runner writes).
3. One step per thing proven, with a short stable `step` id. `detail` is one sentence a person can read; for a fail it says what was expected and what was seen. Copy `httpStatus`, `errorCode`, `latencyMs`, `requestId` from the call's `meta`.
4. A missing key (`error.code === "NO_KEY"`) makes every step of the check a `skip` with the detail "no API key yet".
5. Every cart a check creates is abandoned before the check returns, also when a later step fails (`try/finally`). Use `ctx.carts.create(..., "probe")` and `ctx.carts.abandon`.
6. At most 12 partner calls per check.
7. Test with `makeWorld()` and a hand-built `ProbeContext` (`{ partner: world.partner, carts: world.carts, catalogue: world.catalogue, db: world.db.d1, clock: world.clock, fetch: <your fake>, config: {...} }`). Script failures with `world.partner.failNext(...)` and `world.partner.onRaw`.
8. Each check needs tests for: all steps pass on the fakes; each step failing; the crash path; the no-key path.
