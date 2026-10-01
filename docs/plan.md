<!-- Module: docs/plan.md · Tested: n/a · Approved by Robert 2026-09-29 -->
# Zora Agent Lab: full implementation plan

> **Changes since approval (2026-09-29).** Where this plan and a lane brief in `docs/lanes/` differ, the brief wins.
> The collector posts to one address, `POST /ingest/observations`, not `/ingest/public-prices`. D1 is used with
> plain SQL, without drizzle. The MCP server is hand-written and stateless. Deploys use the wrangler login.
> The account is on Workers Paid (25 cron triggers across the account). Loop 0 record: `docs/ops/loop0.md`.

## Context

The CEO asked on 2026-09-28 (in the team chat) that Robert connects to the Groupon
Partner Storefront API himself. The discovery plan of 2026-09-29
(a discovery report outside this repo) ranked what
to build. Robert chose three products and the frame around them:

- **Price truth monitor**: measures the gap between the price shown and the price paid.
- **Partner experience daily probe**: runs the partner flow against production every day and keeps a scorecard.
- **Agent shopping tool**: a request in plain words returns deals and one checkout link (MCP, HTTP, CLI).
- Partner name **Zora Agent Lab**, logo made with `/img`, frontend designed in **Claude Design**, host **`zorasocial.asajj.cz`**.

Outcome: a registered partner, a working lab at `zorasocial.asajj.cz`, and numbers for the CEO and the partner API team within Iteration 1 (2026-10-01..14).

## What exploration found

- **Hosting pattern exists.** an earlier Worker project (worker `cw-product`, `cw.asajj.cz`) and
  a second one (`fl.asajj.cz`) are Cloudflare Workers with a custom domain on the asajj.cz
  zone. flight/crm is the closest model: Hono + drizzle + D1 + static assets + PIN gate, bun tests.
- **PIN gate to reuse:** the earlier project's PIN gate (HMAC cookie, fail closed). Publish script
  to copy: the earlier project's publish script (reads `CLOUDFLARE_API_WORKERS_EDIT` and
  `CLOUDFLARE_ACCOUNT_ID` from `~/s/.env.master`, deploys, smoke tests).
- **`/img`** = the `/img` skill and the `pig` CLI, key
  injected per command, every run logged as LLM spend.
- **Claude Design** = the Design Artifact type (`type_url`
  `(private Claude Design canvas, link not published)`): artboards on a canvas.
- **API shape** (`openapi.json` `v003`): products carry options, units and
  `pricing {original, retail, discountedPrice{amount, promoCode, endDate}}`; carts return
  `buyLink`, `testMode`, `partner.partnerId`; cart items carry a `url`.
- **Public price source.** From zora, a groupon.com listing page (`/local/chicago/massage`) returns
  HTTP 200 with JSON-LD: deal URL, `price` and list price per deal. A single deal page returns
  HTTP 403 (country CZ). So the public price comes from listing pages, fetched from zora.
- **Cloudflare limits.** Workflows on the free plan allow 50 subrequests per instance and D1 free
  allows 100,000 row writes a day. A catalogue of about 57,000 products needs **Workers Paid
  ($5 a month)**. First step checks whether the account already has it.

## Decisions taken as defaults

| Decision | Default | Reason |
|---|---|---|
| Runtime | One Cloudflare Worker `zorasocial` + D1 + Workflows + Cron | Same pattern as `fl.asajj.cz`; the redirect address must not depend on zora being up. |
| Repo | New repo `~/groupon/zorasocial`, git author set on the machine | Not ai-twin: different product, different secrets. |
| Access | PIN gate on everything except `/health`, `/logo.png`, `/3pd/return` | Robert's standing rule for asajj.cz surfaces. Groupon's checkout must reach the logo, the shopper must reach the return page. |
| Agent access | `/mcp` and `/api/v1/*` behind a bearer token | They create carts with our partner key. |
| LLM inside the Worker | None in version 1 | Agents bring their own model through MCP. The web page is search and cards, not chat. No hidden spend. |
| Orders | Never automated | Real money. Robert places the two test orders by hand. |
| Brand | Own identity from the logo, no Groupon marks | The partner name may not contain "Groupon"; the lab must not look like Groupon. |

## How it is executed: loops, models, git for parallel agents

Robert's instruction on the first draft: run it as a loop, use haiku, sonnet and opus wherever
confidence is 90% or more, design git so the most agents can work at once.

### Contracts first (Wave 0, serial, Fable session)

Agents can only run in parallel when nothing they need is still moving. So Wave 0 freezes every
shared surface before any lane starts:

- `src/contracts/partner.ts`: types generated from `openapi.json` (`openapi-typescript`).
- `src/contracts/ports.ts`: the interfaces lanes call each other through: `PartnerClient`,
  `CatalogueStore`, `SearchIndex`, `CartService`, `ProbeCheck`, `Clock`.
- `test/fakes/`: a fake `PartnerClient` with fixtures cut from the `openapi.json` examples, and an
  in-memory D1 (bun `sqlite`) loaded from the migrations. **Every lane builds and tests without a
  key.**
- `migrations/0001..0006`: the whole schema, one file per domain, written once.
- `src/index.ts`: the route table with every lane already mounted on a stub
  (`src/lanes/<lane>/routes.ts`), and `src/cron.ts` with every scheduled job already listed.
- `lanes.json`: lane name, owned globs, model, dependencies, gate commands.
- `bin/lane-check <lane>`: fails when `git diff --name-only main...lane/<lane>` touches a file
  outside the lane's globs. Deterministic, no LLM.

### Git layout

| Rule | Detail |
|---|---|
| One lane, one branch, one worktree | Branch `lane/<name>`, worktree from the Agent tool's `isolation: "worktree"`. No agent works on `main`. |
| Disjoint ownership | A lane owns a directory. Two lanes never own the same file. |
| Frozen shared files | `package.json`, `wrangler.jsonc`, `migrations/`, `src/contracts/`, `src/index.ts`, `src/cron.ts`, `lanes.json` belong to the integrator. A lane that needs a change writes `requests/<lane>.md` and carries on against the fake. |
| No shared log files | Changelog entries go to `changes/<lane>.md`, LLM run rows to `docs/ops/runs/<lane>.md`. The integrator folds them into `CHANGELOG.md` and `docs/ops/llm-manual-runs.md` at merge. |
| Small commits, ticket-style names | One commit per passing test group, message `<lane>: <outcome>`. |
| Merge | Lane rebases on `main`, gates pass, integrator merges `--no-ff` in dependency order. A conflict means the ownership rule was broken; fix the rule, not the conflict. |

### Lanes and models

Model rule: the cheapest model I am at least 90% confident will pass the lane's gates. A lane that
fails its gates twice moves up one tier (haiku, sonnet, opus, Fable).

| Wave | Lane | Owns | Model | Depends on |
|---|---|---|---|---|
| 0 | contracts, skeleton, PIN gate, return page, publish | shared files, `src/auth.ts`, `src/return/` | Fable session | none |
| 0 | `bin/register` (key handling) | `bin/register` | opus, reviewed by Fable | skeleton |
| 1 | partner-client | `src/partner/` | sonnet | contracts |
| 1 | sync | `src/sync/` | opus (resume and cursor correctness) | contracts |
| 1 | search | `src/search/`, `test/eval/` | sonnet | contracts |
| 1 | agent-api | `src/agent/api/` | sonnet | contracts |
| 1 | agent-mcp | `src/agent/mcp/` | sonnet | contracts |
| 1 | cli | `bin/zal` | haiku | contracts |
| 1 | monitor | `src/monitor/` | sonnet | contracts |
| 1 | collector | `collector/` | sonnet | contracts |
| 1 | probe-runner | `src/probe/run.ts`, `src/probe/scorecard.ts` | sonnet | contracts |
| 1 | probe-checks | `src/probe/checks/*.ts`, one file per check | haiku, one agent per three checks | contracts |
| 1 | docs-rules | `AGENTS.md`, `rules/`, `README.md` | haiku | none |
| 2 | ui-components | `src/ui/components/`, `public/static/` | sonnet | approved design |
| 3 | ui-pages, one agent per page | `src/ui/pages/<page>.tsx` | sonnet | ui-components |
| every wave | integration, live-key checks, final audit | shared files | Fable session | lanes |

Wave 1 is 12 lanes with no edges between them, so all run at once, in two workflows of at most
ten agents each. The Claude Design work and the logo run in the Fable session during Wave 1,
because they need the Artifact tool and Robert's eye.

### The loop

Each wave runs the same loop, at most three times per lane:

1. **Build**: lane agents write tests first, then code, inside their worktree.
2. **Gates** (deterministic): `bun test`, `tsc --noEmit`, `bin/lane-check`.
3. **Review** (sonnet, read-only): `code-reviewer`, `security-reviewer`, `silent-failure-hunter`
   on the lane diff. Each finding needs a file, a line and a failing case.
4. **Fix**: a sonnet fixer per lane takes only confirmed findings.
5. Back to 2. Green gates and no confirmed finding ends the loop.

After three loops the Fable session decides: merge with the open finding written into
`findings`, or take the lane over. Past audits here did not converge on their own, so the cap is
fixed.

**Loop 0 runs before any code:** two sonnet reviewers attack this plan and the Wave 0 contracts.
One checks the Cloudflare parts against the documentation (Workflows, D1 FTS5, MCP on Workers).
One looks for places where two lanes would need the same file. Their confirmed findings change
the contracts before the lanes start.

Every agent run is logged with model, lane and billed cost. Workflows stay under ten agents each.

## Phases

The phases below say what is built. The section above says who builds it and when.

### Phase 0: repo and skeleton (before registration)

Registration needs a live logo and redirect address, so the skeleton ships first.

- `~/groupon/zorasocial`: `AGENTS.md` (root, mandatory per the GIQ baseline), minimal `CLAUDE.md`
  with `@AGENTS.md`, `rules/` ported from the owner's global coding rules (outside the repo)
  (file headers, security, TDD), `CHANGELOG.md`, `docs/ops/llm-manual-runs.md`.
- Stack as in flight/crm: bun, TypeScript, Hono, drizzle-orm, wrangler 4, `bun test`.
- `wrangler.jsonc`: worker `zorasocial`, route `zorasocial.asajj.cz` (`custom_domain: true`),
  D1 binding `DB`, assets `./public` with `run_worker_first`, cron triggers, one Workflow binding.
- `src/auth.ts`: the cw PIN gate ported to a Hono middleware. Secrets `ZAL_PIN`,
  `ZAL_SESSION_SECRET`.
- Public routes: `/health`, `/logo.png`, `/3pd/return` (validates `grouponOrderUuid` as a UUID,
  stores it, shows a holding page).
- `bin/publish`: copy of the cw script; smoke test expects 401 on `/`, 200 on `/health` and
  `/logo.png`.
- Check the Cloudflare plan. If it is free, stop and tell Robert the cost before going on.

### Phase 1: logo and registration

- **Logo** with `/img`: three 1:1 drafts on the fast model, Robert picks one, final with `-h`.
  Prompt direction: simple mark plus the words "Zora Agent Lab", flat, readable at 120 px, no
  Groupon green. Saved to `public/logo.png`, compressed. Each run logged in
  `docs/ops/llm-manual-runs.md`.
- **`bin/register`** (the only place the key is ever handled):
  - refuses to run if `GROUPON_PARTNER_API_KEY` already exists in `~/s/.env.master`;
  - checks that `logoUrl` and `redirectUrl` answer 200 first;
  - prints the payload and waits for Robert to type `yes`;
  - one `POST /octo-gateway/v1/register`, 60-second limit, **no retry**, `x-request-id` logged;
  - response written to a mode-600 file outside git; key moved into `~/s/.env.master` and piped
    to `wrangler secret put GROUPON_PARTNER_API_KEY`; **prints only the partner id**;
  - on a timeout: stops and tells Robert to email `req.partner.api@groupon.com`.
- Payload: `displayName` "Zora Agent Lab", `partnerContactName` "Robert Vojacek",
  `partnerContactEmail` `partner-contact@example.com`,
  `logoUrl` `https://zorasocial.asajj.cz/logo.png`,
  `redirectUrl` `https://zorasocial.asajj.cz/3pd/return`. No scope, no CJ, no page cap.
- Then `GET /partners/me` and `GET /supplier`. Minutes and errors go into the scorecard as the
  first entry.
- Robert sends the partner id to the partner API team and asks for an internal tag. The plan drafts the
  message; Robert sends it.
- Document the new secrets in `~/s/.env.master.md`.

### Phase 2: partner client, catalogue copy, search

- `src/partner/client.ts`: the single place that calls the API. Sends `g-api-key`, custom
  `User-Agent`, `country=US`, `x-request-id`. Reads errors with
  `body.error ?? body.details.error ?? body.code`, never by HTTP status. Backoff 2, 4, 8 s, at most
  5 tries, only on the retryable codes. Never retries add-items. One request per second.
- D1 schema (`migrations/`): `products`, `options`, `locations`, `products_fts` (FTS5),
  `sync_runs`, `price_observations`, `price_changes`, `probe_runs`, `probe_checks`, `carts_log`,
  `orders`, `agent_requests`, `findings`.
- `src/sync/workflow.ts` (Cloudflare Workflow): one step per page at `limit` 100; follows
  `nextCursor` until `hasMore` is false; saves `lastRefreshAt` (final timestamp minus 10 minutes)
  only after a complete walk; resumes from the stored cursor.
- Cron: delta with `updatedSince` every 3 hours; every changed price becomes a `price_changes` row.
- Listable rule from the guide: product active, `availabilityRequired` false, at least one option
  not inactive.
- `src/search/`: FTS5 with bm25 plus filters (state, city, category, highest price).
- `test/eval/queries.json` with 20 requests and `bin/eval-search`. Target: 16 of 20 with a
  relevant, purchasable deal in the top three.

### Phase 3: agent shopping tool

- HTTP: `GET /api/v1/search`, `GET /api/v1/deals/:id`, `POST /api/v1/checkout`,
  `GET /api/v1/orders/:uuid`. Bearer `ZAL_AGENT_TOKEN`.
- MCP at `/mcp` (streamable HTTP, same token). Tools: `search_deals`, `get_deal`,
  `create_checkout_link`, `get_order_status`.
- Price rule in every answer: **the price to pay is `retail`**. The promo price is a separate
  field with the code and the sentence that the shopper must type it at checkout.
- `create_checkout_link` sends `expectedPrice`, handles `PRICE_MISMATCH` by returning the new
  price instead of a link, returns `buyLink` verbatim, logs the cart in `carts_log`.
- `bin/zal`: bun CLI over the HTTP API. README line for
  `claude mcp add --transport http zora-agent-lab https://zorasocial.asajj.cz/mcp`.
- Fresh-agent test (experiment E6): a sonnet agent with only the MCP address and the goal
  "checkout link for a massage in Chicago". Logged as an LLM run.

### Phase 4: price truth monitor

Three comparisons, all stored as `price_observations`:

1. **Promo gap** (whole catalogue, from the sync): share of listable options that carry a
   `discountedPrice`, and median and 90th percentile of `(retail - discounted) / retail`. This is
   the size of "price shown is not the price paid".
2. **Catalogue against cart** (daily sample of 20 options): create a cart with `expectedPrice`,
   compare cart `retail` and totals, record every `PRICE_MISMATCH`, abandon the cart at once.
3. **API against groupon.com** (from zora): `collector/public-prices.ts`, a bun script on a
   systemd user timer. It fetches listing pages for a fixed set of city and category pairs, reads
   the JSON-LD prices, and posts them to `POST /ingest/public-prices` (token `ZAL_INGEST_TOKEN`).
   Shows which price the public site displays: `retail` or the promo price.

Join between API products and public deals: first check in Phase 2 whether `reference` or the cart
item `url` holds the deal permalink. Fallback: title plus city.

Pages: gap distribution, worst 50 deals, mismatch rate by day, freshness of price changes.

### Phase 5: partner experience daily probe

Cron once a day at 04:00 UTC. Each check writes one `probe_checks` row with verdict, HTTP status,
error code, latency and request id.

| Check | What it proves |
|---|---|
| `openapi.json` hash against the stored one | Contract drift |
| Guide version string (fetched by the zora collector) | Guide drift |
| `GET /partners/me`, `GET /supplier` | Key alive, registration unchanged |
| `GET /products` first page, three-page cursor walk, one delta | Catalogue works; response matches the schema |
| No key, Bearer header, state outside the list | Refusals behave as the guide says |
| Cart create, add, change quantity, read, remove, abandon | Cart lifecycle |
| Wrong `expectedPrice` | `PRICE_MISMATCH` with `currentPrice` |
| `buyLink` first response, no redirect followed | Checkout page reachable on `partner.groupon.com` |
| `GET /partner-bookings/{uuid}` for the known test order | Order read works (after Phase 7) |

Scorecard: pass rate over 7 and 30 days, median and 95th percentile latency per endpoint, drift
events, guide-against-behaviour differences, time to first order, and a hand-kept `findings` list
(what stopped us, what the guide did not say). Optional alert: one Telegram message when the daily
verdict changes.

### Phase 6: frontend in Claude Design

Starts right after Phase 0, in parallel with Phases 2 to 5, because it needs only the data shapes.

- Create the Design artifact "Zora Agent Lab" from the Design type. Artboards, desktop and phone:
  1. PIN login
  2. Deal finder: search, filters, result cards with the honest price card
  3. Deal page: options, locations, terms, price history
  4. Checkout hand-off: cart summary, one button on `buyLink`
  5. Return page: order status with polling, one voucher button per unit
  6. Price truth dashboard
  7. Partner experience scorecard
- Robert reviews on the canvas. After approval the screens are built as Hono server-rendered
  pages with one stylesheet in `public/static/`, tokens taken from the design.
- Copy passes the `copywriting` and `humanizer` skills.

### Phase 7: first real order and report

- Robert places two orders by hand: cheapest voucher, signed in on desktop; then as a guest on a
  phone. The return page and `GET /partner-bookings` are checked, the refund is requested by email
  the same day.
- Report for the CEO and the partner API team as a GIQ report (pre-rendered, no scripts): registration experience, price truth numbers, probe results,
  findings. Findings go to the API team first.
- Update the owner's notes with what
  was verified.

## Order and dates

| Day | Work |
|---|---|
| Wed 09-30 | Wave 0: contracts, skeleton live, Loop 0 on the plan, logo, registration |
| Wed 09-30 to Thu 10-01 | Wave 1: 12 lanes in parallel against the fakes; design artboards in the Fable session |
| Thu 10-01 | Integration with the real key: full load, search evaluation, first probe run |
| Fri 10-02 | Scorecard draft to the partner API team; design review with Robert |
| Mon 10-05 | Waves 2 and 3: components, then one agent per page; price truth with three days of data; Phase 7 orders |
| Tue 10-06 | GIQ report |
| By Wed 10-14 | Everything live; numbers ready for the Iteration 1 review |

## Files to create (new repo `~/groupon/zorasocial`)

- `wrangler.jsonc`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `rules/`, `CHANGELOG.md`
- `lanes.json`, `bin/lane-check`, `src/contracts/`, `src/cron.ts`, `test/fakes/`, `changes/`,
  `requests/`, `docs/ops/runs/`
- `src/index.ts`, `src/auth.ts`, `src/return/`, `src/partner/client.ts`, `src/partner/errors.ts`
- `src/sync/workflow.ts`, `src/sync/listable.ts`, `src/search/`
- `src/agent/api/`, `src/agent/mcp/`
- `src/monitor/promo-gap.ts`, `src/monitor/cart-sample.ts`, `src/monitor/ingest.ts`
- `src/probe/run.ts`, `src/probe/checks/*.ts`, `src/probe/scorecard.ts`
- `src/ui/components/`, `src/ui/pages/<page>.tsx`, `public/static/app.css`, `public/logo.png`
- `collector/public-prices.ts`, `collector/zorasocial-collector.{service,timer}`
- `bin/publish`, `bin/register`, `bin/zal`, `bin/eval-search`
- `migrations/*.sql`, `test/**`, `test/eval/queries.json`, `docs/ops/llm-manual-runs.md`

Changed outside the repo: `~/s/.env.master` and `~/s/.env.master.md` (new secrets), ai-twin
`CHANGELOG.md` (pointer to the new repo), two memory notes.

## Verification

- **Unit tests** (`bun test`, written first): error reader for the three body shapes, backoff
  rules, listable rule, cursor resume, price arithmetic in minor units, UUID check on the return
  page, PIN gate. Fixtures come from `openapi.json` examples, never from a live key.
- **Parallel safety:** `bin/lane-check` passes for every lane before merge; no merge conflict in
  Wave 1.
- **Skeleton:** `bin/publish` smoke test; `curl` shows 401 on `/`, 200 on `/logo.png`.
- **Registration:** `GET /partners/me` returns "Zora Agent Lab"; `grep` of the repo, the shell
  history and the session transcript finds no string starting with `grpn_`.
- **Sync:** `sync_runs` shows a finished full load; listable count within 10% of 56,917.
- **Search:** `bin/eval-search` prints at least 16 of 20.
- **Agent tool:** `bin/zal search "massage in Chicago"` returns deals; `bin/zal checkout` returns
  a link on `partner.groupon.com`; the MCP tools answer inside a Claude Code session.
- **Price truth:** dashboard shows the promo gap for the whole catalogue and a cart sample with
  all carts abandoned (`carts_log` has no open cart older than one hour).
- **Probe:** one manual run through `wrangler dev --test-scheduled`, then the first cron run in
  production with every check recorded.
- **Frontend:** screenshots of each page at desktop and phone width against the approved
  artboards.

## Risks kept in view

- The key is shown once and tool output is saved in transcripts: only `bin/register` touches it.
- Every successful register call creates a partner that cannot be deleted: one call, no retry.
- The probe and the cart sample write to production: one request per second, 20 carts a day, all
  abandoned.
- The test partner and test orders must not count toward the bet's results: internal tag asked
  for on day one.
- The public-price collector reads groupon.com listing pages politely: a fixed small set of
  pages, once a day.

---

# Part 2: the products with the real key (from 2026-09-30, 10:00 UTC)

## Context

Registration is done (partner `<partner id>`, active). The code for all
three products is merged and live (526 tests), but every number so far came from fakes. What
remains is running the products against production, checking each assumption the plan made, and
turning the results into numbers for the CEO and the partner API team.

Live facts already known at the time of writing:
- Full load `full-fbbd5693…` running since 09:11 UTC: 495 pages, 24,890 products, 22,631
  listable at 09:46 (about 4 s a page; 1,150 pages expected, done about 10:40 UTC).
- `products.reference` holds the groupon.com deal slug (`hair-by-velli-1-1`), so the join between
  the API and the public site is exact, not title-plus-city. Ingest already matches on it.
- 65,528 of 69,477 options loaded so far (94%) carry a `discountedPrice` with a promo code. The
  promo gap is the headline number, not an edge case.
- Two findings recorded from the first probe: F-001 (pages carry no `timestamp`), F-002
  (`state=IL` answers 400 instead of an empty page).

## Steps, in order

### A. Catalogue complete (today, Fable session, no agent)
1. Wait for `sync_runs.status = complete`; record pages, products, listable, duration, errors.
2. Compare listable with the guide's 56,917 (within 10% passes; outside it becomes a finding).
3. Confirm the delta cron (`0 */3 * * *`) produced a `delta-*` run and `price_changes` rows by
   the evening; if the first delta returns everything again, the `lastRefreshAt` rule is wrong
   and becomes a finding.

### B. Price truth: the three comparisons (today and tomorrow)
1. **Promo gap** (whole catalogue): `POST /admin/jobs/promo-gap` once the load is complete, then
   the daily cron at 04:30 UTC. Numbers: promo share, median and 90th percentile of
   `(retail - discounted) / retail`, worst 50 deals. Check the read model in
   `src/monitor/read-model.ts` (`latestSnapshot`, `history`, `worstGaps`) against real data.
2. **Catalogue against cart**: `POST /admin/jobs/cart-sample` (20 options, `expectedPrice` =
   retail, mismatches recorded, every cart abandoned). Verify `carts_log` has no open cart older
   than one hour, then leave it to the cron at 04:30.
3. **API against groupon.com**: install the collector timer on zora per `collector/README.md`
   (`ZAL_INGEST_TOKEN` from the vault, run once by hand first). Before installing, replace the
   guessed page list in `collector/pages.json` with the ten city-and-category pairs that carry
   the most listable products in D1 (one query). The comparison answers one question per matched
   deal: does groupon.com show `retail`, the promo price, or something else. `PublicPriceComparison`
   in `src/contracts/reports.ts` already carries the shape; the page needs the verdict line.
4. **Freshness**: `price_changes` per day from the delta sync, shown on the page.
5. Lane `monitor-live` (sonnet, one loop): read the price-truth page with real data, fix what the
   fakes hid (empty states, zero denominators, units), add the public-price verdict and freshness
   sections if missing. Owns `src/monitor/`, `src/ui/pages/price-truth.tsx`.

### C. Partner experience probe (today)
1. `POST /admin/jobs/probe` after the load: cart, price mismatch and buy-link checks now have
   deals to work on. Expected: 16 passed, 0 failed except the order read (no order yet).
2. Every failure becomes a finding with the guide sentence it contradicts, or a bug in our check.
3. Review item A3: the scorecard shows the age of the last run (lane `probe-live`, sonnet, owns
   `src/probe/scorecard.ts`, `src/ui/pages/scorecard.tsx`).
4. Daily cron at 04:00 UTC stays; first cron verdict checked on 10-01 morning.

### D. Agent shopping tool (today and 10-01)
1. `bun bin/eval-search.ts` against the full catalogue; target 16 of 20. Below target: lane
   `search-tune` (sonnet, owns `src/search/`, `test/eval/`), at most two loops, ranking only.
2. `bin/zal search "massage in Chicago"`, `bin/zal checkout <option>` (link on
   `partner.groupon.com`, cart abandoned after the check).
3. Experiment E6: a fresh sonnet agent with only the MCP address and the goal "checkout link for
   a massage in Chicago". Pass = a valid `buyLink` returned with the retail price and the promo
   sentence. Logged as an LLM run.
4. README carries the `claude mcp add --transport http zora-agent-lab https://zorasocial.asajj.cz/mcp` line (check, it was written by the docs lane).

### E. UI Waves 2 and 3 (after Robert reviews the canvas)
Unchanged from Part 1: components lane (sonnet), then one sonnet agent per page, plain pages
replaced by the designed ones. Not started until the canvas is approved.

### F. Test orders (Robert, by hand, 10-01 or later)
Cheapest voucher, signed in on desktop; then guest on a phone. After the first order:
`KNOWN_ORDER_UUID` set as a Worker var, return page and `GET /partner-bookings` checked, refund
requested at `req.partner.api@groupon.com` the same day.

### G. Numbers out (10-02 draft, 10-06 GIQ)
1. Message to the partner API team with the partner id and the ask for an internal tag (drafted by me,
   sent by Robert) — today.
2. 10-02: scorecard and price truth numbers with two days of data, as a short note to the partner API team; findings F-001.. go to the API team.
3. 10-06: GIQ report (pre-rendered, no scripts).
4. The owner's notes updated with verified facts.

## Models and loops
Same rule as Part 1: cheapest model with at least 90% confidence, one tier up after two failed
gates. Live-key work (A, B1–B3, C1–C2, D1–D3, G) stays in the Fable session because it touches
production with our key; lanes `monitor-live`, `probe-live`, `search-tune` are sonnet in
worktrees with `bin/lane-merge`. Every agent run logged in `docs/ops/llm-manual-runs.md`.

## Verification
- `sync_runs` complete row; listable within 10% of 56,917; a delta run with `price_changes`.
- `promo_gap_snapshots` has one row; the price-truth page shows share, median, p90, worst 50.
- `cart_samples` has 20 rows for today; `carts_log` has no open cart older than one hour.
- `public_price_observations` has rows with `matched_product_id` set for most observations.
- `probe_runs` latest: 0 failed apart from the order-read check; scorecard shows run age.
- `bin/eval-search.ts` prints ≥ 16 of 20; E6 agent returns a `partner.groupon.com` link.
- Repo, shell history and transcript contain no string starting with `grpn_`.

# Part 3: Top deals, the AI Builder showcase (from 2026-09-30, 14:15 UTC)

## Context
The CEO asked (team chat, 2026-09-30) for something to show people: pick a category (Things To Do is
enough), pick a city (top 50), and get a page listing the top 20 Groupon deals in that city and
category, sortable by the discount in money and in percent, showing only the original price and the
final price after the discount. Presented as an example AI Builder project: the prompts that built
it exported, the source on git.

## Decisions
- Prices shown: original (struck) and retail (the price the shopper pays); the promo code is a
  footnote sentence (rule 2), never a column.
- Category: a daily walk of Groupon's 38 `category1` values (things-to-do first) tags
  `product_categories`; the leaf labels inside a category come from `products.category_labels`.
- The 50 cities with the most listable products, keyed by (city, state), refreshed daily.
- A new Claude Design canvas for this page only; the boards exported into `design/project/`.
- A public GitHub snapshot made by `bin/export-public` (one commit, private strings rewritten and
  scanned), pushed by hand. MIT, copyright Groupon, Inc.
- Every prompt is a file in the repo before an agent sees it (`docs/lanes/`, `docs/ai-builder/prompts/`).
- Lanes: sync-category (opus), top-deals, ui-components, ui-top-deals, docs-showcase, export-public
  (sonnet), in parallel worktrees; the integrator session holds the shared files.
- The final gate: a CEO-style review by a second model (GPT through the codex CLI) of the public
  snapshot only, scored in stars, looped until 4 of 5 with no lens below 3.

## Schedule
Wave 0 (schema, contracts, stubs, fakes, cron) on main; five lanes at once plus the design boards;
the page lane and the route; publish, bootstrap `top-cities` and `category-walk`; loop 4 rounds
(`docs/ops/loop4.md`) until two clean rounds; the snapshot; the CEO review loop; hand-over.

## Verification
- `bin/walkthrough --no-carts` 0 missed, two rounds in a row; screenshots at 1280 and 390 px.
- Production: 38 complete category runs, `top_cities` with New York first, `/data/top-deals.json`
  rows with `payMinor` equal to retail.
- `bin/export-public` exits 0 with the gates green inside the snapshot; the scan finds nothing.
- The CEO review: 4 of 5 stars or better, the verbatim answer in `docs/ops/loop4/`.
