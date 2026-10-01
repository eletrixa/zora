<!-- Module: docs/lanes/probe-checks-b.md · Tested: n/a -->
# Lane probe-checks-b

**You build:** four checks in `src/probe/checks/`: `catalogue-page.ts`, `catalogue-walk.ts`, `catalogue-delta.ts`, `refusals.ts`, and their tests in `test/probe/checks/`.
**Read first:** `src/contracts/ports.ts` (ProbeCheck, ProbeContext, PartnerClient incl. `raw`), `src/contracts/partner.ts` (the rules for every check are at the end of this brief), `migrations/0002_sync.sql` (sync_state), guide lines 484-566 and 849-960.

## The checks

**catalogue-page** — `listProducts({ limit: 10 })`. Steps: `read` (succeeded); `count` (1 to 10 products); `shape`: every product has a non-empty `id` and `title`, a `status` from the documented three, an `options` array, and every option's first unit has a pricing entry whose `retail` and `original` are non-negative integers and whose `currencyPrecision` is an integer; the detail names the first product and field that breaks; `promo`: where `discountedPrice` is present and not null, `amount` is an integer and lower than or equal to `retail` (a promo above retail is a `fail`); `timestamp` parses as a time.

**catalogue-walk** — three pages of `limit: 10` with the cursor. Steps: `page-1`, `page-2`, `page-3` (each succeeded; a walk that ends early because `hasMore` is false passes and the rest are `skip`); `no-repeat` (no product id appears on two pages); `cursor` (`nextCursor` is a non-empty string whenever `hasMore` is true).

**catalogue-delta** — reads `sync_state.last_refresh_at` from `ctx.db`. None: one `skip` ("no full load yet"). Else `listProducts({ limit: 10, updatedSince })` **without `active`**. Steps: `read` (succeeded), `shape` (an array, possibly empty). Detail says how many products changed on the first page.

**refusals** — with `ctx.partner.raw`. Steps: `no-key` (`auth: "none"`, GET products → HTTP 401 and body `code === "unauthenticated"`); `bearer` (`auth: "bearer"` → HTTP 401; the guide says a Bearer header is refused); `state-code` (`auth: "key"`, `state=IL` → the guide says a state abbreviation returns an empty page for a partner without a state scope: HTTP 200 and zero products); `bad-cursor` (`cursor=not-a-cursor` → an error code in the body, any; a 200 with products is a `fail`). For each, a different observed behaviour is a `fail` whose detail quotes the guide's promise and what came back.
## Rules for every check

1. Export `check: ProbeCheck` with the fixed `name`. `run(ctx)` **never throws**: wrap the body, a crash is a `fail` step named `crashed`.
2. A check reads and calls; it **never writes to the database** (the runner writes).
3. One step per thing proven, with a short stable `step` id. `detail` is one sentence a person can read; for a fail it says what was expected and what was seen. Copy `httpStatus`, `errorCode`, `latencyMs`, `requestId` from the call's `meta`.
4. A missing key (`error.code === "NO_KEY"`) makes every step of the check a `skip` with the detail "no API key yet".
5. Every cart a check creates is abandoned before the check returns, also when a later step fails (`try/finally`). Use `ctx.carts.create(..., "probe")` and `ctx.carts.abandon`.
6. At most 12 partner calls per check.
7. Test with `makeWorld()` and a hand-built `ProbeContext` (`{ partner: world.partner, carts: world.carts, catalogue: world.catalogue, db: world.db.d1, clock: world.clock, fetch: <your fake>, config: {...} }`). Script failures with `world.partner.failNext(...)` and `world.partner.onRaw`.
8. Each check needs tests for: all steps pass on the fakes; each step failing; the crash path; the no-key path.
