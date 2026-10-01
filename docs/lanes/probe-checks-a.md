<!-- Module: docs/lanes/probe-checks-a.md · Tested: n/a -->
# Lane probe-checks-a

**You build:** four checks in `src/probe/checks/`: `openapi-drift.ts`, `guide-version.ts`, `registration.ts`, `order-read.ts`, and their tests in `test/probe/checks/`.
**Read first:** `src/contracts/ports.ts` (ProbeCheck, ProbeContext, ProbeConfig, ProbeStepResult) (the rules for every check are at the end of this brief), `migrations/0003_prices.sql` (guide_observations), `migrations/0004_probe.sql` (contract_snapshots).

## The checks

**openapi-drift** — `ctx.fetch(ctx.config.openapiUrl)` with a `user-agent` header. Step `fetch`: status 200 and a body that parses as JSON with a `paths` object. Step `hash`: `sha256Hex` of the body text; read `contract_snapshots` (kind `openapi`); `pass` when there is no snapshot or the hash equals it, `fail` when it differs (detail names the first 12 characters of both hashes). Always set `observed: { kind: "openapi", value: <hash> }` on the `hash` step.

**guide-version** — reads the newest row of `guide_observations` (the zora collector writes them). No row, or the newest is older than 48 hours: step `fresh` is `skip` ("no guide reading in the last 48 hours"). Newest has `version` null: `fail` ("the guide page could not be read, HTTP <status>"). Else step `version`: compare with `contract_snapshots` kind `guide` like above, and set `observed: { kind: "guide", value: <version> }`.

**registration** — `ctx.partner.getPartner()`. Steps: `read` (call succeeded), `name` (`displayName` equals `ctx.config.expectedDisplayName`), `active` (`status === "active"`), `urls` (`logoUrl` and `redirectUrl` are set and start with `https://`). Then `ctx.partner.getSupplier()`: step `supplier` (succeeded, `id` not empty).

**order-read** — `ctx.config.knownOrderUuid` null: one `skip` step ("no test order yet"). Else `ctx.partner.getBooking(uuid)`: step `read` (succeeded), `status` (one of the seven documented statuses), `items` (at least one item, every item has `optionId` and at least one unit item with a `myGrouponUrl` starting with `https://`).
## Rules for every check

1. Export `check: ProbeCheck` with the fixed `name`. `run(ctx)` **never throws**: wrap the body, a crash is a `fail` step named `crashed`.
2. A check reads and calls; it **never writes to the database** (the runner writes).
3. One step per thing proven, with a short stable `step` id. `detail` is one sentence a person can read; for a fail it says what was expected and what was seen. Copy `httpStatus`, `errorCode`, `latencyMs`, `requestId` from the call's `meta`.
4. A missing key (`error.code === "NO_KEY"`) makes every step of the check a `skip` with the detail "no API key yet".
5. Every cart a check creates is abandoned before the check returns, also when a later step fails (`try/finally`). Use `ctx.carts.create(..., "probe")` and `ctx.carts.abandon`.
6. At most 12 partner calls per check.
7. Test with `makeWorld()` and a hand-built `ProbeContext` (`{ partner: world.partner, carts: world.carts, catalogue: world.catalogue, db: world.db.d1, clock: world.clock, fetch: <your fake>, config: {...} }`). Script failures with `world.partner.failNext(...)` and `world.partner.onRaw`.
8. Each check needs tests for: all steps pass on the fakes; each step failing; the crash path; the no-key path.
