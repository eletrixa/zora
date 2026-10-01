# Zora Agent Lab (zorasocial)

Four products on the Groupon Partner Storefront API, live at `https://zorasocial.asajj.cz`:

1. **Price truth monitor**: measures the gap between the price shown and the price paid.
2. **Partner experience daily probe**: runs the partner flow against production every day and keeps a scorecard.
3. **Agent shopping tool**: a request in plain words returns deals and one checkout link (HTTP, MCP, CLI).
4. **Top deals**: pick a category and a city, see the 20 deals with the largest discount, by amount or by percent (the AI Builder showcase).

Owner: Robert Vojacek. Plan: `docs/plan.md`. API reference: `docs/reference/partner-guide-v7.txt` and
`docs/reference/partner-openapi-v003.json`. Read the part of the guide that covers your lane before you write code.

## Stack

Cloudflare Worker (`src/index.ts`) with Hono, D1 (plain SQL, no ORM), Workflows and Cron. Bun for tests,
scripts and the zora collector. TypeScript strict. No LLM runs inside the Worker.

## How the repo is divided

Work is split into **lanes**. `lanes.json` says which files each lane owns.

- You work on branch `lane/<your-lane>` in your own worktree. Never on `main`.
- You change **only the files your lane owns**. `bun bin/lane-check.ts <lane>` fails otherwise.
- Shared files belong to the integrator: `package.json`, `wrangler.jsonc`, `lanes.json`, `AGENTS.md`,
  `migrations/`, `src/contracts/`, `src/lib/`, `src/app.ts`, `src/index.ts`, `src/cron.ts`,
  `src/container.ts`, `src/return/`, `src/ui/routes.ts`, `src/probe/checks/index.ts`,
  `test/fakes/`, `test/contracts/`, `test/app/`, `CHANGELOG.md`, `docs/ops/llm-manual-runs.md`.
- Need a change in a shared file, a new dependency, or a contract change? Write it in
  `requests/<lane>.md` (what, why, the exact change) and keep building against what exists.
  Do not edit the shared file. Do not add packages.
- Your changelog lines go in `changes/<lane>.md`. The integrator folds them into `CHANGELOG.md`.

## Contracts

`src/contracts/` is frozen. Lanes talk to each other only through the interfaces in
`src/contracts/ports.ts`. Each lane keeps the export names and signatures of its stub file, because
`src/container.ts`, `src/cron.ts` and `src/app.ts` import them by name.

Build and test against the fakes in `test/fakes/` (`makeWorld()` in `test/fakes/env.ts` wires them).
No test may call the network or need an API key.

## Rules that are never broken

1. **Money is an integer in minor units.** Format only with `formatMoney` from `src/lib/money.ts`.
2. **The price a shopper pays is `retail`.** A promo price is reported separately, with its code and the
   sentence that the shopper must type it at checkout. Never show the promo price as the price.
3. **`buyLink` is used verbatim** from the latest cart response. Never build a checkout address.
4. **Errors are read from the body**, `body.error ?? body.details?.error ?? body.code`, never from the
   HTTP status. Products, Supplier, Booking and partners/me answer every error as HTTP 400.
5. **Retry only** `INTERNAL_SERVER_ERROR`, network errors, HTTP 429 and 5xx: 2, 4, 8 s, at most 5 tries.
   **Never retry adding cart items.** Never call `POST /register` from code in `src/`.
6. **One request per second** to the partner API. Every cart the probe or the monitor creates is abandoned.
7. **Secrets** are Worker secrets. Never write a key, token or PIN into a file, a log line, a test, a
   commit or an error message. Test values live in `test/fakes/env.ts`.
8. **Time** comes from `Clock` (`deps.clock`). No `Date.now()` and no `setTimeout` in lane code.
9. **Expected failures are values** (`Result`, outcome unions). Throw only on programmer error.
   Never swallow an error: return it, or log it with `console.error(JSON.stringify({...}))` and return it.
10. **Every value that reaches HTML is escaped.** Every SQL value is bound with `?1`, never concatenated.

## Working loop (TDD)

RED: write the failing test first. GREEN: the smallest code that passes. REFACTOR 1: check against the
contract and the guide. REFACTOR 2: check against this file and `rules/`. Commit after each passing group:
`<lane>: <outcome>`. Do not push. Do not merge.

Gates before you hand in, all three green:

```
bun run typecheck
bun test
bun bin/lane-check.ts <lane>
```

## File headers

Every file you create or change starts with this header (block comment of the language):

```
<One-line summary of what this module does.>

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  <path from the repo root>
Deps:    <key dependencies>
Tested:  <path of the test file, or "n/a">
```

## Writing

Plain words, short sentences, no dashes as punctuation in user-facing text. Comments say why, not what.
Test names read as facts: `it("answers PRICE_MISMATCH with the current price")`.
