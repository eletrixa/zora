<!-- Module: README.md · Tested: n/a -->
# Zora Agent Lab

A small website that finds the best Groupon deals and shows you what you really pay. It is live at
`https://zorasocial.asajj.cz`, and one person built it with Claude. This repository is the whole thing:
the code, the design, and the prompts that made it.

## What you can do there

**See the top deals in your city.** The home page (`/`) asks two things: what kind of deal, and which
city. It answers with the 20 deals that save the most, sorted by dollars saved or by percent saved.
Every row shows the original price crossed out and the price you pay.

**Find a deal in plain words.** Type something like "massage" or "car wash" on `/find`, pick a city if
you like, and you get deal cards with the price and what you save. The same search answers computer
programs too, so an AI assistant can shop here for you (details for builders below).

**Check that the price is honest.** `/price-truth` compares the price the site shows with the price
Groupon's cart charges. Every day the lab puts real deals in a real cart, reads the number, and
records whether it matched.

**See whether Groupon's partner service works today.** `/scorecard` runs the same steps a partner would
run, against the real Groupon service, every day, and keeps a pass or fail record.

Each deal also has its own page (`/deals/:id`) with its options, places and price history.

## The one rule about prices

The price you pay is always the retail price, the number Groupon's cart charges. Some deals have a promo
code. Typing it at Groupon checkout lowers the price, so the site shows it as a sentence under the deal,
such as "Type code FALL at Groupon checkout to pay $376.20." A promo price is never shown as the price.

## Two looks

Every page has a switch on the logo between two looks, lab and Zora pixel. The choice is remembered in a
cookie (`zal_theme`, set by `POST /theme`) and the page flips without reloading.

## What is live

The partner is registered and the full catalogue is loaded: 55,822 listable products on 2026-09-30 at
20:10 UTC (`docs/ai-builder/evidence.md` keeps the query). Every page is designed, public and told to
stay out of search engines: Top deals, the home page (`/`); Find a deal (`/find`); Price truth
(`/price-truth`); the Scorecard (`/scorecard`); a deal's own page (`/deals/:id`); and the agent API, MCP
and CLI.

## Built with AI

The site is published as an AI Builder example. The story, with the prompts that built each round and
the loop that ran them, is `docs/ai-builder/README.md`. The release evidence (which revision is deployed,
the timestamped queries behind every number, the timeline, the acceptance runs, the open items with
owners) is `docs/ai-builder/evidence.md`. This public repository is a snapshot made by an exporter that
rewrites private strings to neutral phrases and scans for any that survive. The exporter itself stays in
the private repository, because its rules list what it removes.

## Design

The screens are designed on a Claude Design canvas (`design/README.md` has the link). The language that
binds every page in both looks is `design/LANGUAGE.md`; the boards are generated from it by
`design/gen/`, in rounds archived under `design/rounds/`. `design/` holds a copy of the canvas files,
refreshed after the owner edits the canvas and before a UI lane starts.

---

The rest of this page is for people who want to run or change the code.

## Gates

```
bun run typecheck
bun test
bun bin/lane-check.ts <lane>
```

`bun bin/lane-check.ts <lane>` fails when a lane's branch touches a file outside the globs it owns
in `lanes.json`.

## Run it yourself

```
bun install
npx wrangler login
npx wrangler d1 create zorasocial   # paste the id into wrangler.jsonc over PENDING_CREATE
bun run db:init                     # the local database; PENDING_CREATE is fine for local dev
printf 'GROUPON_PARTNER_API_KEY=...\nZAL_AGENT_TOKEN=...\nZAL_INGEST_TOKEN=...\nZAL_ADMIN_TOKEN=...\n' > .dev.vars
bun run typecheck && bun test
bun run dev                         # http://localhost:8787
```

`.dev.vars` is gitignored: any 16 or more character value for the three tokens, and the partner
key from `bin/register` after changing the contact name and email in it. Without a partner key the
pages answer with their empty state and `/data/top-deals.json` is an empty report; the catalogue
fills once `bin/register` has a key and `zal job sync-full` has run. `bin/publish` deploys to
production once the four secrets are set with `wrangler secret put`. A second builder, from a clean
clone with no Cloudflare account or partner key, proved install, the local database, both gates and
every page answering locally in its empty state; registration, a deployment and a populated catalogue
were outside that exercise and remain unproven by it (`docs/ai-builder/reproduction.md`; the open item
for someone to prove them next is in `docs/ai-builder/evidence.md`).

A fork changes six things first: the `routes` pattern in `wrangler.jsonc`, for its own domain;
`ZAL_PUBLIC_HOST` for `bin/publish`'s smoke test; the host argument to `bin/walkthrough`; `ZAL_HOST`
for `bin/zal`; its own `wrangler login` and D1 database id; and its own partner registration, with its
own contact name and email in `bin/register`.

## Publish

```
bin/publish
```

In order: aborts if `wrangler.jsonc` still holds a pending D1 database id, runs `bun run typecheck`
and `bun test`, applies the D1 migrations to the remote database, deploys the Worker, then smoke
tests `/health`, `/logo.png`, `/`, `/find`, `/top-deals` (a 301), `/scorecard`, `/api/v1/search`,
`/ingest/observations` and `/3pd/return` for their expected status codes. It deploys with the
wrangler OAuth login, unsetting `CLOUDFLARE_API_TOKEN` first, because the deploy needs the D1 scope
an API token may lack.

## Register

```
bin/register
```

Registers the partner "Zora Agent Lab" with one call to `POST /octo-gateway/v1/register` and never
runs it twice: it refuses if a key is already in the vault, and it refuses if an earlier attempt's
outcome is still unknown (told instead to email `req.partner.api@groupon.com`). Before sending, it
checks that the logo and return addresses already answer. It prints the payload and waits for
`yes` on a terminal, unless run with `--yes` for an approval already given in words. After the one
call, the key goes to the vault and to the Worker secret, and only the partner id is printed.

## How an agent uses it

HTTP, behind the `ZAL_AGENT_TOKEN` bearer token, under `/api/v1`:

- `GET /api/v1/search`: text, state, city, category, max price, limit.
- `GET /api/v1/deals/:productId`: full detail of one deal.
- `POST /api/v1/checkout`: 1 to 20 `{ productId, optionId, quantity }` lines, returns a link,
  a price change, an unavailable reason, a not-found, or an error.
- `GET /api/v1/orders/:uuid`: order status and voucher links.

MCP, same token, at `/mcp` (streamable HTTP), with four tools: `search_deals`, `get_deal`,
`create_checkout_link`, `get_order_status`.

CLI, `bin/zal`, over the HTTP API:

```
zal search <text...> [--state IL] [--city Chicago] [--category Massage] [--max 50] [--limit 10] [--json]
zal deal <productId> [--json]
zal checkout <productId> <optionId> [--qty 1] [--json]
zal order <grouponOrderUuid> [--json]
zal job <sync-full|sync-delta|probe|cart-sample|promo-gap|cart-sweep|category-walk|top-cities>
zal help
```

`claude mcp add --transport http zora-agent-lab https://zorasocial.asajj.cz/mcp` adds the MCP
server to a Claude Code session.

In the API the price the shopper pays is always `pay` / `payMinor` / `payText`. A promo price is a
separate field with its code and a sentence to type it at Groupon checkout; it is never the price to pay.

## Secrets

Four Worker secrets, set with `wrangler secret put`, never written into a file: `GROUPON_PARTNER_API_KEY`,
`ZAL_AGENT_TOKEN`, `ZAL_INGEST_TOKEN`, `ZAL_ADMIN_TOKEN`. The
master copy lives in the vault, `~/s/.env.master`.

## The zora collector

`collector/` reads the listing pages in `collector/pages.json`, plus the partner guide hub page,
and posts what it saw to `<host>/ingest/observations`. It runs on the machine zora, once a day,
never inside the Worker. Run it once by hand first with `bun collector/run.ts`; it exits non-zero
if nothing was accepted. Install it as a systemd user timer:

```
mkdir -p ~/.config/systemd/user
cp collector/zorasocial-collector.service collector/zorasocial-collector.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zorasocial-collector.timer
```

## Parallel work

Work is split into lanes; `lanes.json` says which files each lane owns. Each lane runs on its own
branch, `lane/<name>`, in its own worktree. `bin/lane-worktrees <wave>` creates one worktree and
branch per lane of a wave. `bin/lane-check.ts <lane>` fails a lane that touched a file it does not
own. `bin/lane-merge <lane>` rebases the lane on main, runs the gates in the worktree, merges
without fast-forward, then runs the gates again on main, undoing the merge if they fail.
