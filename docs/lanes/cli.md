<!-- Module: docs/lanes/cli.md · Tested: n/a -->
# Lane cli

**You build:** `bin/zal` (a three-line bash wrapper that runs `bun bin/zal.ts "$@"`) and `bin/zal.ts` — the command line over the HTTP API.
**Read first:** `docs/lanes/agent-api.md` (the routes you call), `src/contracts/ports.ts` (DealCard, CheckoutResult, OrderStatusResult, JobSummary), `src/lib/money.ts`.
**Test with:** export a `main(argv, io)` function where `io` holds `fetch`, `env`, `stdout`, `stderr`, `readVault`; tests pass fakes. No network in tests.

## Commands

```
zal search <text...> [--state IL] [--city Chicago] [--category Massage] [--max 50] [--limit 10] [--json]
zal deal <productId> [--json]
zal checkout <productId> <optionId> [--qty 1] [--json]
zal order <grouponOrderUuid> [--json]
zal job <sync-full|sync-delta|probe|cart-sample|promo-gap|cart-sweep>     (admin token, POST /admin/jobs/<job>)
zal help
```

## Rules

1. Host from `ZAL_HOST`, default `https://zorasocial.asajj.cz`. Token from the environment (`ZAL_AGENT_TOKEN`, `ZAL_ADMIN_TOKEN`); when unset, read that ONE variable from `~/s/.env.master` (`io.readVault(name)`); never read or print anything else from the vault; never print a token.
2. Human output: one block per deal (title, place, `You pay $49.00`, the promo sentence when present, product and option id). `checkout` prints the total and the checkout link on its own line. `--json` prints the API body unchanged.
3. Exit codes: 0 success, 1 the API said no (not found, unavailable, price changed, error), 2 wrong usage, 3 no token or network failure. Errors go to stderr in one sentence.
4. No dependencies beyond Bun.

## Tests you must have

Each command builds the right request; token from env and from the vault reader; token never printed; human and JSON output; each exit code; unknown command prints usage.
