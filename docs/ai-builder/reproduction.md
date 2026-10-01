<!-- Module: docs/ai-builder/reproduction.md · Tested: n/a -->
# Reproduction from a clean clone

On 2026-09-30 at 20:29 UTC a fresh agent (Claude Sonnet, no memory of the project) was given one
instruction: clone the public snapshot (commit 409293e), follow `README.md` "Run it yourself" literally
without a Cloudflare account or a partner key, and report what worked and what did not. Its report,
as sent, with nothing changed but the headings:

## Environment

bun 1.4.0, node v26.5.0, wrangler 4.143.1 (update to 4.145.0 available, not installed).

## Steps and outcomes

- `bun install`: exit 0, 0.5 s, 74 packages, no errors.
- `wrangler.jsonc` confirmed `database_id` "PENDING_CREATE"; skipped `wrangler login` and
  `wrangler d1 create` as instructed.
- `bun run db:init` (`wrangler d1 migrations apply zorasocial --local`): exit 0, 3.1 s, all 9
  migrations applied (0001 through 0009), local D1 at `.wrangler/state/v3/d1`.
- Created `.dev.vars` with the 4 named secrets (`GROUPON_PARTNER_API_KEY`, `ZAL_AGENT_TOKEN`,
  `ZAL_INGEST_TOKEN`, `ZAL_ADMIN_TOKEN`), each a placeholder of 28 or more characters. Confirmed
  `.gitignore` already lists `.dev.vars`; no tracked change appeared in `git status`.
- `bun run typecheck`: exit 0, 3.2 s, both `tsconfig.json` and `tsconfig.scripts.json` clean.
- `bun test`: exit 0, 4.27 s, 809 pass, 0 fail, 2,380 expect() calls across 73 files. One console
  line, not a failure: `{"at":"sync.startFullSync",...,"error":"the test environment has no Workflow
  runtime"}`, an expected fake-environment log; the run still passed.
- `bun run dev` (`wrangler dev`): started cleanly in about 6 s, no Cloudflare login prompt or failure
  in local mode. Listening on `http://localhost:8787`.

## Local page answers (status, first 300 characters)

- `/health`: 200, body `ok`.
- `/`: 200, HTML, `<title>Find a deal · Zora Agent Lab</title>`, noindex and nofollow meta present.
- `/top-deals`: 200, HTML, `<title>Top deals · Zora Agent Lab</title>`, noindex and nofollow meta present.
- `/data/top-deals.json`: 200, body exactly
  `{"query":null,"cities":[],"categories":[],"labels":[],"rows":[],"taggedAt":null,"citiesRefreshedAt":null}`,
  empty because no catalogue sync has run against a real Partner API key.
- `/robots.txt`: 200, body `User-agent: *` / `Disallow: /`.

## Blockers (no Cloudflare account, no partner key, by the exercise's own scope)

- `wrangler login`: skipped, not attempted.
- `wrangler d1 create`: skipped, not attempted; local dev worked with the literal `PENDING_CREATE`
  as the local database name, so this did not block anything through `bun run dev`.
- `bin/register`: not run, requires a real partner key exchange.
- `bin/publish`: not run, requires a Cloudflare account, a remote D1 id, and `wrangler secret put`
  for all four secrets.
- Real catalogue data: unreachable without a live partner key and a sync job, so `/top-deals` and
  `/data/top-deals.json` render only an empty, structurally valid shell locally.

## README correction

In "Run it yourself" the fenced command block ran `bun run dev` as the last step, but the requirement
to create `.dev.vars` first was stated only in a prose paragraph after that block, not inside the
steps. A literal step-by-step reader could hit `bun run dev` before being told `.dev.vars` needs to
exist. (It did not actually block start-up; `wrangler dev` starts either way, but the ordering read
backwards.) No other line in "Run it yourself" was inaccurate; every command matched actual behaviour
exactly, including the `PENDING_CREATE` placeholder working for local-only dev.

## Verdict

A builder with a Cloudflare account and a completed partner registration can get from this checkout
to a running local page: every step up through local dev worked without a single error, start to
finish in well under a minute of compute. What remains unproven from the public snapshot alone: real
D1 provisioning and remote migrations, the partner key exchange via `bin/register`, a production
deploy via `bin/publish`, and any actual deal content, since local `/top-deals` and
`/data/top-deals.json` are reachable only as an empty shell without a live partner key and a sync.

---

What the integrator did with it: the `.dev.vars` step moved into the command block (`README.md`,
"Run it yourself") and the empty-state behaviour without a key is now stated there. The unproven
steps (D1 provisioning, registration, the production deploy) were done for the live site by the
owner on 2026-09-29 and 2026-09-30 with the scripts named above; a second builder proving them needs
their own Cloudflare account and partner registration, which this repository cannot supply.
