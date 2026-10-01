<!-- Module: docs/lanes/agent-api.md · Tested: n/a -->
# Lane agent-api

**You build:** `src/agent/api/` — the HTTP API for agents, mounted at `/api/v1` behind the agent token (the gate is already in `src/app.ts`).
**Keep this export:** `agentApi: Hono<AppEnv>` in `src/agent/api/routes.ts`.
**Read first:** `src/contracts/ports.ts` (ShoppingService and its result types), `src/contracts/env.ts`, `src/lib/http.ts`, `src/ui/routes.ts` (`queryOf` shows how the form is read; write your own reader, do not import from `src/ui`).
**Test with:** `createApp({ deps: world.deps })` from `src/app.ts` with `makeWorld()` and `makeEnv()`; script `world.shopping` (`FakeShoppingService`). Send `Authorization: Bearer <TEST_SECRETS.ZAL_AGENT_TOKEN>`.

## Routes (all JSON, all with `PRIVATE_HEADERS`, channel `"agent-api"`)

| Route | Answer |
|---|---|
| `GET /search?q=&state=&city=&category=&maxPrice=&limit=` | 200 `{ deals: DealCard[], count }`. `maxPrice` is in dollars (`49.5` → 4950). At least one of the five criteria, else 400 `missing_criteria`. |
| `GET /deals/:productId` | 200 `DealDetail`, 404 `not_found` |
| `POST /checkout` body `{ items: [{ productId, optionId, quantity }] }` | `link` → 200; `price_changed` → 409; `unavailable` → 409; `not_found` → 404; `error` → 502. The body is always the `CheckoutResult`. |
| `GET /orders/:uuid` | not a UUID → 400 `bad_uuid`; `order` → 200; `not_found` → 404; `error` → 502 |
| `GET /` | 200: a short JSON description of the four routes and the price rule, so an agent can discover the API |

## Rules

1. Validate everything: string lengths (text at most 200), integers, `items` 1..20, quantity 1..100, body at most 16 KB and valid JSON (400 `bad_json`). Unknown fields are ignored.
2. Errors use `errorJson`. Never echo the token. Never return a stack trace.
3. No business logic here: the service decides, the route translates.

## Tests you must have

Each route's success; each status mapping; each validation refusal; oversized body; broken JSON; the shopping service is called with the channel `"agent-api"`; headers are private.
