<!-- Module: docs/lanes/partner-client.md · Tested: n/a -->
# Lane partner-client

**You build:** `src/partner/` — the only code that calls the Groupon Partner Storefront API.
**Keep this export:** `createPartnerClient(config: PartnerConfig, clock: Clock, fetchImpl: Fetch): PartnerClient` in `src/partner/index.ts`.
**Read first:** `src/contracts/ports.ts` (PartnerClient, Result, PartnerError, CallMeta), `src/contracts/partner.ts`, guide `docs/reference/partner-guide-v7.txt` lines 311-388 (Conventions), 484-566 (Syncing), 568-690 (Cart), 724-847 (Reading the order), 849-992 (Errors, Retry policy).
**Test with:** a scripted `Fetch` you write in `test/partner/` and `FakeClock` from `test/fakes/clock.ts`. `test/fakes/partner.ts` shows the behaviour other lanes expect from you.

## Behaviour

1. Every request sends `g-api-key` (never `Authorization: Bearer`), `user-agent` from the config, `accept: application/json`, a fresh `x-request-id` (`newId()`), and `country=US` (query on reads, body on cart writes). Base path `/octo-gateway/v1/`.
2. Empty `config.apiKey`: send nothing, return `{ ok: false, error: { code: "NO_KEY", retryable: false, shape: "none" } }` with `httpStatus: null`.
3. Pacing: the start of two requests of one client instance is at least `config.minIntervalMs` apart. Wait with `clock.sleep`.
4. Timeout: `config.timeoutMs` per attempt with `AbortSignal.timeout` (the one allowed timer). A timeout is code `TIMEOUT`, a failed fetch is `NETWORK`.
5. Success means a 2xx status AND no error code in the body. Read the code with `body.error ?? body.details?.error ?? body.code`. Never decide by HTTP status alone: Products, Supplier, Booking and partners/me answer every error as HTTP 400, including `INTERNAL_SERVER_ERROR`.
6. `shape`: `"flat"` when the code came from `body.error`, `"envelope"` from `body.details.error`, `"auth"` when `body.code === "unauthenticated"`, `"none"` for client-side codes.
7. `PRICE_MISMATCH` carries `currentPrice` (from `body.currentPrice ?? body.details?.currentPrice`). HTTP 429 or `RATE_LIMITED` carries `retryAfterSec` from the `Retry-After` header.
8. Retry with backoff exactly as the guide's Retry policy says (2, 4, 8 s, at most 5 tries) and only for `INTERNAL_SERVER_ERROR`, `NETWORK`, `TIMEOUT`, HTTP 429, HTTP 5xx. With `Retry-After`, wait at least that long. `meta.attempts` counts tries.
9. **Never retry** `addCartItems` and never retry `raw`. Never call `/register`.
10. Map success bodies to the success shapes in `src/contracts/partner.ts`. A 2xx body that lacks a required field (`products`, `hasMore`, `timestamp`, cart `id`, `buyLink`, booking `uuid`) is `UNPARSEABLE`.
11. `abandonCart` succeeds on an empty body.
12. `raw`: one attempt; returns status, headers (lower-case names) and parsed body as they are; `auth` picks the header: `"key"`, `"bearer"` (`Authorization: Bearer <key>`), `"none"`.
13. The key never appears in an error message, a log line or `meta`.

## Tests you must have

Header set; NO_KEY sends nothing; pacing sleeps; each of the three error shapes; HTTP 400 with `INTERNAL_SERVER_ERROR` is retried and then succeeds; five failures give up with `attempts: 5`; `Retry-After` respected; `addCartItems` not retried after a timeout; `PRICE_MISMATCH` carries the price; `UNPARSEABLE` on a broken success body; the key is absent from every error and log.
