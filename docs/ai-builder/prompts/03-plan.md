<!-- Module: docs/ai-builder/prompts/03-plan.md · Tested: n/a -->
# Prompt 03: the plan

Written by the coding session in plan mode and approved by the builder on 2026-09-30 at about 15:30 UTC
(the first version was rejected at 15:05 UTC with the three requirements now under "Decisions"). Copied
from the plan file unchanged except: names replaced by roles, paths outside the repository, one private
canvas link and the private strings the redaction rules list replaced by neutral phrases, the second model
named as such. The plan was written before the design concepts existed; the design turns are in
`04-design-prompt.md`, and what actually happened is in `docs/ops/loop4.md`.

---

# Plan: "Top deals" page as an AI Builder showcase (product 4 of Zora Agent Lab)

## Context

the CEO asked (Google Chat, 2026-09-30, in Czech) for something to show people: pick a category
(Things To Do is enough), pick a city (top 50), and get a page listing the top 20 Groupon deals in
that city and category, sortable by discount in money and in percent, showing only the original
price and the final price after the discount. He wants it presented as an example "AI Builder"
project: export the prompts that built it and put the source on git.

the builder's instruction: build it as an example AI Builder product on zorasocial, loop-develop it
against success criteria (the loop 3 method), use Claude Design with the distinctive Zora Agent
Lab look; use the cheapest model with at least 90 % confidence per lane (haiku, sonnet, opus);
plan for the maximum number of parallel agents so it is fast; at the end have the second model (GPT via the
codex CLI) review it as the CEO would, and loop until it scores 4 of 5 stars.

### Facts established (read-only, 2026-09-30)

- `options` holds `original`, `retail`, `promo_amount`, `promo_code`, `promo_ends_at` in minor
  units. 154,037 sellable options on listable products; 149,539 have `original > retail`;
  144,773 carry a promo; 20 have `original = 0`.
- `products.category_labels` is a JSON array of leaf labels (543 distinct on listable products,
  e.g. "Facial" 6,057, "Escape Games" 652). No top-level category is stored.
- "Things To Do" exists only as a Products API filter, `category1=things-to-do`, one of 38
  values (docs/reference/partner-guide-v7.txt:291). Verified live with one GET each:
  `things-to-do` answers amusement parks, ziplines, dance classes; an unknown value answers an
  empty page, not an error. Our registration has no scope. The partner client already sends
  `country=US` and passes `category1` through (src/partner/index.ts:144-150).
- Top cities by listable products: New York NY 1,603, Los Angeles 1,152, Houston 1,132, Las Vegas
  1,029, Miami 892, Chicago 809 ... rank 50 is about 170. The key must be (city, state).
- Query cost on production D1 (warm): the top-deals query in the join form (candidates from
  `locations` by exact city and state, `JOIN options` on the primary key, `ROW_NUMBER` per
  product) answers New York in 145 to 371 ms. The `options.product_id IN (SELECT ...)` form took
  622 ms warm and 7.0 s cold: do not use it. The top-50 cities GROUP BY reads 270k rows in
  493 ms: a daily job, not per request.
- Cloudflare: the full load ran 1,230 pages as one Workflow instance (10,000 steps allowed on
  Workers Paid). `test/app/cron.test.ts` pins five triggers; Paid allows 250.
- the second model: `codex` CLI 0.156.1, logged in with ChatGPT, model `gpt-6-astra`, reasoning `ultra`.
  Invocation shape used by the builder's panel: `codex exec --skip-git-repo-check "<prompt>" < /dev/null`
  (`< /dev/null` is load-bearing). It supports `-C <dir>`, `-s read-only`, `-i <image>`.
  the second model must never receive anything private: it reviews the public snapshot directory only.
- The existing Claude Design canvas is on the builder's personal account; nothing is reachable from
  this session. No Design artifact exists here yet.
- Prompts of earlier waves live only in Claude Code transcripts, not in the repo.
- Exploration and planning reports (quoted code, SQL, conventions, exact rewrite tables) are in
  `a scratch folder outside the repo/`
  as `explore-{data,ui,process}.md` and `plan-{data,page,exportPlan}.md`. The lane briefs are
  written from them.

### Decisions the builder took on 2026-09-30 (do not reopen)

- Prices shown: original (struck) and retail (what the shopper pays). Discount = original minus
  retail. The promo code stays a footnote sentence (rule 2), never a column, never a price.
- Category: a daily `category1` walk (38 Groupon top categories, things-to-do first) plus the
  leaf labels inside the chosen top category.
- Design: a new Claude Design canvas for this page only, in the Zora Agent Lab look.
- Git: a public GitHub repo snapshot; the builder creates `groupon/zora-agent-lab` and pushes. Nothing
  leaves the machine in this task except the the second model review of the public snapshot. LICENSE: MIT,
  copyright Groupon, Inc.
- Public prompts carry no names: written as one AI builder would post them, professional, same
  length and substance, grammar and style cleaned. `docs/reference/` ships with a source note.
- Models: cheapest with at least 90 % confidence; a lane that fails its gates twice moves up one
  tier. Final gate: the second model CEO review at 4 of 5 stars.

## Architecture of the feature

```
daily 00:30 UTC cron ──> top-cities job (top_cities, 50 rows)
                    └──> category-walk job: one Workflow instance, 38 sync_runs of kind
                         'category' (things-to-do first); each page tags product_categories
GET /top-deals?category=<slug>&label=<leaf>&place=City, ST&sort=amount|percent
   route builds TopDealsQuery ──> reports.topDeals.report(query) (one call: pickers + rows)
   ──> renderTopDeals (pure renderer, cut from the Claude Design boards)
GET /data/top-deals.json: the same report as JSON
```

## Lanes, models, ownership

| Lane | Model | Why this tier | Owns (lanes.json) | Builds |
|---|---|---|---|---|
| integrator | Fable (this session) | serial critical path, shared files, production key, Artifact tool | everything shared | wave 0, design boards, wiring, merges, publish, loops, the second model runs |
| sync-category | **opus** | Workflow cycle, step idempotency and untag-by-run-id are subtle; the original sync lane was opus | `src/sync/**`, `test/sync/**` (existing `sync` entry) | category walk: `walk.ts` kind `category`, `tags.ts`, `category.ts`, `index.ts` job, `workflow.ts` cycle |
| top-deals | sonnet | SQL given verbatim, real SQLite tests | `src/top-deals/**`, `test/top-deals/**` | `cities.ts` job, `read-model.ts`, `index.ts` |
| ui-components | sonnet | two components, CSS with a byte cap, phone grid | `src/ui/components/**`, `public/static/app.css`, `test/ui/components/**` (existing) | `selectField`, `sortToggle`, ranked table and footnote CSS, phone layout, nav test |
| ui-top-deals | sonnet | pure renderer from the boards; loop 3 pages were sonnet | `src/ui/pages/top-deals.tsx`, `test/ui/pages/top-deals.test.tsx` | the page |
| docs-showcase | sonnet | prose the CEO reads; haiku is under 90 % on tone | `docs/ai-builder/**`, `docs/reference/README.md`, `LICENSE`, `README.md`, `docs/architecture.md` | the showcase story, prompt index, public README, license, source note |
| export-public | sonnet | a typed script with e2e tests over git | `bin/export-public`, `bin/export-public.ts`, `test/bin/export-public.test.ts` | the snapshot script and its tests |
| fix rounds | the owning lane's model | | | only the lanes that own a miss, in parallel |

the second model runs from the integrator session (no agent needed): one `codex exec` per review round.

## Schedule (wall clock, maximum parallelism)

```
P0  integrator, serial (~20 min): briefs and prompts, wave 0 commit, worktrees
P1  six workers at once (~30 to 45 min):
      lanes sync-category, top-deals, ui-components, docs-showcase, export-public (Workflow fan-out)
      + the integrator makes the Claude Design boards meanwhile
P2  merge top-deals, ui-components, sync-category (serial, gates each) ── then, at once:
      lane ui-top-deals (needs boards + components + contracts)
      + integrator: route, container, app tests, walkthrough checks, loop4.md skeleton
      + merge docs-showcase and export-public when they report
P3  merge ui-top-deals; publish; bootstrap jobs; loop 4 rounds (walkthrough + screenshots),
      misses fixed by their owning lanes in parallel, until two clean rounds
P4  snapshot with bin/export-public; the second model CEO review rounds until 4 of 5 stars (max 3 rounds),
      fixes by owning lanes in parallel, snapshot refreshed each round
P5  hand-over (no push, no message without the builder's go)
```

## P0: prompt capture and wave 0 (integrator, serial)

**Prompt capture.** Every prompt that leaves the Fable session is a file in the repo first; the
spawn message only points at the file. Lane briefs: `docs/lanes/sync-category.md`,
`docs/lanes/top-deals.md`, `docs/lanes/ui-components-top-deals.md`, `docs/lanes/ui-top-deals.md`,
`docs/lanes/docs-showcase.md`, `docs/lanes/export-public.md`, in the Wave 1 shape (`You build`,
`Keep these exports`, `Read first`, `Test with`, `## Behaviour`, `## Tests you must have`) plus the
common part (worktree `../zorasocial-wt/<lane>`, AGENTS.md, TDD, three gates, `changes/<lane>.md`,
commit `<lane>: <outcome>` with the Co-Authored-By line, report under 200 words as structured
output). Header: `<!-- Module: docs/lanes/<lane>.md · Tested: n/a · Given verbatim to the lane
agent, 2026-09-30 hh:mm UTC, model <model> -->`. Spawn line, exactly: `Your complete brief is the
file docs/lanes/<lane>.md in your worktree <abs path>. Read it first with cat, then do exactly
what it says.` Round 2 instructions are appended under `## Round 2, hh:mm UTC`. Never tell an
agent to read the vault; tokens reach agents by name through the environment. No `the home path`,
`a sibling project path`, `the notes path`, `a scratch path`, private canvas links or colleague names in any brief.
`docs/ai-builder/prompts/01-the-ask.md` (the ask in English, roles only, same length),
`02-the-instruction.md` (the builder's instruction, cleaned), `04-design-prompt.md` (before the Design
session) are written now; `03-plan.md` and `05-acceptance.md` at the end. Commit
`ops: briefs and prompts for top deals`.

**Migration `migrations/0009_top_deals.sql`**

```sql
ALTER TABLE sync_runs ADD COLUMN category1 TEXT;          -- set on kind 'category' runs
CREATE TABLE product_categories (
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  category1  TEXT NOT NULL,       -- Groupon category1 permalink, e.g. things-to-do
  run_id     TEXT NOT NULL,       -- the category walk that last saw the product here
  tagged_at  TEXT NOT NULL,
  PRIMARY KEY (product_id, category1)
);
CREATE INDEX product_categories_category ON product_categories (category1, product_id);
CREATE TABLE top_cities (
  city TEXT NOT NULL, state TEXT NOT NULL, listable_products INTEGER NOT NULL,
  rank INTEGER NOT NULL, refreshed_at TEXT NOT NULL, PRIMARY KEY (city, state)
);
```
`test/contracts/schema.test.ts` TABLES gains both tables.

**Contracts (additive, `src/contracts/reports.ts`)**

```ts
export type TopDealsSort = "amount" | "percent";
export interface TopDealsQuery {
  readonly city: string; readonly state: string;      // "" = the first city of the list
  readonly category1?: string;                        // absent = every category
  readonly label?: string;                            // leaf label, case-insensitive
  readonly sort: TopDealsSort;
}
export interface TopCity { readonly city: string; readonly state: string; readonly listableProducts: number }
export interface TopCategory { readonly category1: string; readonly products: number }
export interface TopLabel { readonly label: string; readonly products: number }
export interface TopDealRow {
  readonly rank: number; readonly productId: string; readonly optionId: string;
  readonly title: string; readonly optionTitle: string;
  readonly city: string | null; readonly state: string | null; readonly imageUrl: string | null;
  readonly currency: string; readonly precision: number;
  readonly originalMinor: number;   // struck price
  readonly payMinor: number;        // THE price the shopper pays (= retail)
  readonly discountMinor: number;   // original - pay
  readonly discountShare: number;   // discountMinor / originalMinor, 0..1
  readonly promo: PromoNote | null; // footnote only; same rule and sentences as shopping's promoOf
}
export interface TopDealsReport {
  readonly query: TopDealsQuery | null;   // city filled in; null before the first city refresh
  readonly cities: readonly TopCity[]; readonly categories: readonly TopCategory[];
  readonly labels: readonly TopLabel[]; readonly rows: readonly TopDealRow[];
  readonly taggedAt: string | null; readonly citiesRefreshedAt: string | null;
}
export interface TopDealsReadModel { report(query: TopDealsQuery): Promise<TopDealsReport> }
// Reports gains: readonly topDeals: TopDealsReadModel;
```
`PromoNote` imported from ports.ts (no cycle). `JobSummary.job` gains
`"category-walk" | "top-cities"`. `src/contracts/pages.ts` gains
`TopDealsPageProps { report: TopDealsReport; now: number }`. `SyncRunRow.kind` stays
`"full" | "delta"`; `getSyncStatus` filters `kind IN ('full','delta')`.

**Stubs** (pattern `git show 4dc3e5c:src/monitor/index.ts`): `src/top-deals/index.ts`
(`createTopDealsReadModel` notBuilt, `runTopCitiesRefresh` throws), `src/sync/index.ts`
`startCategoryWalk` (throws), `src/ui/pages/top-deals.tsx` `renderTopDeals` (shell +
`emptyState("Top deals are being built.")`), `shell.ts` `Active` gains `"top-deals"` and the nav
link second (two lines; ui-components adds the test).

**Wiring**: `container.ts` `buildReports` gains `topDeals`; `cron.ts` JOBS gains
`"category-walk"`, `"top-cities"`, SCHEDULE gains `"30 0 * * *": ["top-cities", "category-walk"]`;
`wrangler.jsonc` triggers gain `"30 0 * * *"`; `test/app/cron.test.ts` "stays within six triggers";
`bin/zal.ts` job names; `bin/publish` smoke gains `/top-deals 200`. Why 00:30 UTC: after the 00:00
delta, a 30 to 60 minute walk ends long before the 03:00 delta, the 04:00 probe, 04:30 promo-gap
and the Monday 05:00 full load.

**Fakes**: `fixtures.ts` `FIXTURE_CATEGORY1` (massage, facial, nails, laser, soldout:
beauty-and-spas; oil, carwash: automotive; bowling: things-to-do and food-and-drink; escape, kayak:
things-to-do; pizza: food-and-drink; yoga: health-and-fitness); `partner.ts` filters
`query.category1` through it; `seed.ts` `seedCategories(db, tags = FIXTURE_CATEGORY1, at, runId)`.
No fake read model: app tests run the real SQL on the in-memory SQLite.

**lanes.json**: `top-deals`, `ui-top-deals`, `docs-showcase`, `export-public` entries (wave 4,
owns as in the table). Product 4 bullet in `AGENTS.md` and `docs/plan.md` `# Part 3` (integrator).

Gates green, commit `integrator: top deals wave 0 (schema, contracts, stubs, fakes, schedule)`.
`bin/lane-worktrees 4`; rebase the `sync` and `ui-components` worktrees on main.

## P1: five lanes at once (Workflow fan-out) plus the design boards

Spawn with the Workflow tool: one `agent()` per lane in `parallel`, `agentType:
"general-purpose"`, `model` per the table, the spawn line as the prompt, a result schema
`{ lane, commits: string[], gates: "green" | "red", changesFile: string, requests: string[],
notes: string }`. Each lane: TDD, three gates, `changes/<lane>.md`, no push, no merge. The
integrator merges as reports land (`bin/lane-merge <lane>`, gates on main each time).

### sync-category (opus), `docs/lanes/sync-category.md`
- `walk.ts`: `RunKind` adds `"category"`; `RunRow.category1`; `insertRunStatement` (38 inserts in
  one batch); `fetchPage` sends `category1` and, for a category run, calls
  `tagProducts(db, runId, category1, ids, now)` instead of `upsertProducts` (no product write, so a
  later full load cannot retire anything by mistake); `finishRun` for a category run runs
  `untagOthersStatement` (delete rows of that category whose `run_id` differs) plus the complete
  update in one batch and never moves the watermark.
- `src/sync/tags.ts`: `tagStatement` (`INSERT ... SELECT ?1,?2,?3,?4 WHERE EXISTS (SELECT 1 FROM
  products WHERE id = ?1) ON CONFLICT DO UPDATE SET run_id, tagged_at`), `tagProducts` (one batch
  per page), `untagOthersStatement`.
- `src/sync/category.ts`: `CATEGORY1_VALUES` (the guide's 38, things-to-do first), `CycleParams
  { cycle: true; runIds }`, `categoryRunId`, `runCategoryCycle(deps, runIds, stepsFor)`: walks each
  run with `runWalk`; a failed run or a crash is recorded on its row and the cycle continues.
- `index.ts` `startCategoryWalk: Job`: refuses while a full load or a category cycle younger than
  6 h runs (older running rows marked STALE); inserts 38 running rows in one batch;
  `env.SYNC_WORKFLOW.create({ id: cycleId, params })`; on failure marks every run WORKFLOW_CREATE.
- `workflow.ts`: accepts `SyncParams | CycleParams`; a cycle runs `runCategoryCycle` with step
  names `${runId}:${name}`.
- Tests (facts): sends the category1 filter on every page and tags every product seen; untags a
  product that left the category once the walk is complete; keeps yesterday's tags when the walk
  fails; never upserts, retires or moves the watermark on a category walk; skips a product the
  catalogue does not hold yet; keeps a product's other tag when one category is re-walked; starts
  one Workflow instance for 38 runs with things-to-do first; refuses while a category walk younger
  than 6 hours runs and replaces a stale one; refuses while a full load is running; marks every run
  failed when the Workflow cannot be created; walks every run of a cycle in order and goes on after
  a failed category; records a crash and continues; leaves category walks out of the sync status.

### top-deals (sonnet), `docs/lanes/top-deals.md`
- `cities.ts`: `TOP_CITY_COUNT = 50`, `runTopCitiesRefresh: Job` ("top-cities"): `SELECT l.city,
  l.state, COUNT(DISTINCT l.product_id) ... WHERE city and state not empty AND l.product_id IN
  (SELECT id FROM products WHERE listable = 1) GROUP BY l.state, l.city ORDER BY n DESC, state,
  city LIMIT ?1`; at least one row: one batch `DELETE FROM top_cities` plus inserts with rank; an
  empty catalogue keeps yesterday's list (`ok: false`). Summary names the first city.
- `read-model.ts`: `TOP_DEALS_LIMIT = 20`, `LABEL_LIMIT = 100`, `buildTopDealsSql(query, limit):
  BoundSql` (exported for the query-plan test), `createTopDealsReadModel(db)`. Sort keys from a
  fixed map, never from input. The statement:

```sql
WITH candidates AS (
  SELECT p.id AS product_id, p.title, p.image_url
  FROM (SELECT DISTINCT lf.product_id FROM locations lf WHERE lf.state = ? AND lf.city = ?) hit
  JOIN products p ON p.id = hit.product_id
  WHERE p.listable = 1
    [AND p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category1 = ?)]
    [AND EXISTS (SELECT 1 FROM json_each(p.category_labels) jf WHERE lower(jf.value) = lower(?))]
), ranked AS (
  SELECT c.product_id, c.title, c.image_url, o.option_id, o.title AS option_title, o.currency,
         o.precision, o.original, o.retail, o.promo_amount, o.promo_code, o.promo_ends_at,
         o.original - o.retail AS discount_minor,
         CAST(o.original - o.retail AS REAL) / o.original AS discount_share,
         ROW_NUMBER() OVER (PARTITION BY c.product_id ORDER BY <key> DESC, o.retail ASC, o.option_id ASC) AS rn
  FROM candidates c JOIN options o ON o.product_id = c.product_id
  WHERE o.active IS NOT 0 AND o.original > 0 AND o.original > o.retail
), top AS (SELECT * FROM ranked WHERE rn = 1 ORDER BY <order> DESC, product_id ASC LIMIT ?)
SELECT t.*, loc.city, loc.state FROM top t
LEFT JOIN locations loc ON loc.product_id = t.product_id
  AND loc.idx = (SELECT MIN(l2.idx) FROM locations l2 WHERE l2.product_id = t.product_id AND l2.state = ? AND l2.city = ?)
ORDER BY t.<order> DESC, t.product_id ASC
```
  Exact city and state match (values come from the picker); never `lower()` on the city column.
  Picker queries drive from the same city (categories present in the city, things-to-do first then
  by size; leaf labels in the city and category, top 100), plus `MAX(finished_at)` of complete
  category runs and the `top_cities` list with `refreshed_at`. `report(query)`: cities first; empty
  city means `cities[0]`; no city at all means the empty report with `query: null`; else the four
  queries with `Promise.all`; rows with `rank = index + 1` and `promo` built like shopping's
  `promoOf` (null unless promo below retail; the same two sentences).
- Tests: `read-model.test.ts` on real SQLite (hand-calculated Chicago numbers: laser 40100 /
  80.2 %, bowling 5100 / 56.7 %, massage 90-minute 5100 / 42.5 %, oil 4500 / 50.0 %, pizza 2100 /
  42.0 %): ranks Chicago by money; by percent; one row per product with the option of the largest
  discount; skips original 0; skips original not above retail; skips inactive options and
  unlistable products; keeps Hollywood, FL apart from Hollywood, CA; filters by the category1 tag;
  lists a product under each of its categories; filters by a leaf label case-insensitive; caps at
  20 and numbers 1 to 20; answers the first city when none is named; lists the categories of the
  city with things-to-do first; lists the labels by size; shows the location in the chosen city;
  carries the promo as a footnote value with payMinor equal to retail; tag freshness null before
  the first walk; empty report with no city before the first refresh. `query-plan.test.ts`: seeks
  `locations_state_city` and never scans options or products. `cities.test.ts`: ranks by listable
  products keyed by city and state; counts a product with two locations in one city once; replaces
  yesterday's list in one write; keeps the old list on an empty catalogue; caps at 50; summary
  names the first city.

### ui-components (sonnet), `docs/lanes/ui-components-top-deals.md`
- `blocks.ts`: `selectField({ label, name, value, options: {value,label}[], width })` (formField
  look, `autocomplete="off"`, escaped, `selected` on the match) and `sortToggle({ options:
  {key,label}[], current, hrefFor })` rendering `<nav class="sort">` links with
  `aria-current="true"` on the current one.
- `app.css` (11.5 KB today, 20 KB cap): `.field select` (48 px, radius 10, own SVG chevron,
  `appearance:none`), `.sort` segmented control (active segment indigo, white text),
  `.results-head`, `.table td.rank`, `.table td.pay`, `.table s`, `.table-option`, `.fn`,
  `.footnotes`, `.freshness`; in the 480 px block: `.sort` full width, `.ranked` as a labelled list
  (`thead` hidden, `tr` a 36px + `minmax(0,1fr)` grid, `td[data-label]::before`, `td.city`
  hidden, `white-space:normal`).
- Tests: `shell.test.ts` lists Top deals second and marks it current; `app-css.test.ts` the select
  rule and the phone list rule; new `blocks-3.test.ts` for both components (renders, selects the
  value, escapes, marks current). `src/ui/components/README.md` updated.

### docs-showcase (sonnet), `docs/lanes/docs-showcase.md`
- `docs/ai-builder/README.md`: the story for a non-engineer builder, in this order (the CEO's own
  standards for a page: who it is for, what it does, where it lives, how success is measured, then
  the why): the ask; what was built with the catalogue facts; where it lives (URL, repo path);
  how success is measured (the acceptance list, the walkthrough result, the CEO review score);
  how long (from the brief commit to the second clean round); what it cost (Claude Max
  subscription, Cloudflare Workers Paid $5 a month, no per-run bill); the loop; what you need to
  do the same; the prompt index; honesty notes (prompts cleaned for names and grammar, same
  length and substance; canvas numbers are sample data). Placeholders `<fill>` for numbers that
  exist only after P3; the integrator fills them.
- `docs/ai-builder/prompts/README.md` index table `| # | When (UTC) | From, to | Prompt | Lives at
  | Cleaned |` listing 01 the ask, 02 the instruction, 03 the plan, 04 the design prompt, 05 to 10
  the six lane briefs (in `docs/lanes/`), 11 the acceptance list, 12 the the second model CEO review prompt.
- `docs/reference/README.md` (6 lines): what each file is, fetched from
  `https://www.groupon.com/hubs/partner-storefront-api` and
  `https://api.enc.groupon.com/octo-gateway/v1/openapi.json`, date, version, Groupon owns the text.
- `LICENSE`: MIT, `Copyright (c) 2026 Groupon, Inc.`, no file header.
- `README.md`: four products; "What is live" replaces the stale section; "Run it yourself" (bun
  install, wrangler login, `wrangler d1 create zorasocial` and paste the id over `PENDING_CREATE`,
  `.dev.vars` with the four secret names, `bun run dev`, `bin/publish`); "Built with AI" pointing
  to `docs/ai-builder/`; the personal login line at 39-41 removed. `docs/architecture.md`: gates,
  jobs, tables for product 4.

### export-public (sonnet), `docs/lanes/export-public.md`
- `bin/export-public` (bash wrapper) + `bin/export-public.ts` + `test/bin/export-public.test.ts`.
  `git archive HEAD` into `../zorasocial-public` (or `ZAL_EXPORT_DIR`); EXCLUDE
  `docs/ops/message-internal-tag.md`; REWRITES that must each hit at least once (drop the
  `account_id` line; `database_id` → `PENDING_CREATE`; `the contact email` →
  `partner-contact@example.com`; private canvas links → "(private Claude Design canvas, link not
  published)"; partner id → `<partner id>`; the `docs/plan.md`, `docs/lanes/*`, `design/README.md`,
  `test/fakes/d1.ts`, `bin/publish` personal lines: names → roles, `a sibling project path`, `the notes path`, `/tmp` paths →
  neutral phrases, memory note names dropped; the exact table is `plan-exportPlan.md` section 2);
  FORBIDDEN scan after the rewrites (`the home path`, `a sibling project path/`, `the notes path/`, `a scratch path`,
  `the owner's domain`, `the contact email`, the owner's address, the account and database ids, the partner id, `the team chat id`,
  `canvas links`, a real `grpn_` key shape, the three colleague names, the memory note
  names, an internal bet name, an internal metric name); unless `--no-gates`, symlink node_modules and run typecheck and
  tests in the snapshot; `git init`, one commit `Zora Agent Lab: public snapshot YYYY-MM-DD`
  (author from `ZAL_PUBLIC_AUTHOR` or the machine's git config); a second run onto an existing
  snapshot adds a second commit; prints the summary and the commands the builder runs:
  ```
  cd ../zorasocial-public
  gh repo create groupon/zora-agent-lab --public --source=. --remote=origin --push
  ```
- Tests: applies every rewrite and drops the account id line; keeps the all-zero fake key and flags
  a real key shape, a home path and a colleague name; exports HEAD into an empty directory as one
  commit with no excluded file and no forbidden string; adds a second commit onto an existing
  snapshot; refuses a non-empty target that holds no snapshot.

### Design boards (integrator, concurrently with P1)
1. Write `docs/ai-builder/prompts/04-design-prompt.md`, then `Artifact quickstart` with
   `intent: "design"`, follow the design skill, create one Design canvas "Zora Agent Lab: Top
   deals" with two artboards: **TopDeals** 1280 × 1500 and **TopDealsPhone** 390 × 1700.
2. Tokens verbatim from `public/static/app.css` `:root` (ivory `#FBF8F3`, ink `#1E1F4B`, muted
   `#54567A`, line `#E3DDD2`, panel `#F3EEE5`, indigo `#2B2D6E` for the active sort segment and
   the button, coral `#FF6B4A` only as nav underline and logo, never under white text; Sora
   headings, IBM Plex Sans body, IBM Plex Mono figures); header from
   `design/project/PriceTruth.dc.html:18-21` with a fourth nav link "Top deals" drawn active.
3. Desktop board: h1 "Top deals" + lead + "Sample data" pill; a white picker card with three
   selects (Category "Things To Do (9,812)", Within the category "All of Things To Do", City
   "New York, NY (1,603)") and an indigo "Show" button; a results section with h2 "Top 20 in New
   York, NY: Things To Do" and the segmented sort control on one row; the ranked table (`#`, Deal
   as indigo link with "promo" superscript on some rows and the option title beneath, City,
   Original struck mono, You pay mono 600, You save mono, Saved % mono), six sample rows; "Promo
   codes" `<ol>` footnotes; the freshness line; the empty panel "No discounted deals in Miami, FL
   for Escape Games. Try the whole of Things To Do." with the last sentence linked.
4. Phone board: stacked full-width pickers and button, full-width two-half sort control, the
   table as a labelled list (rank in a 36 px column, title, "Original: ~~$140.00~~", "You pay:
   $79.00", "You save: $61.00", "Saved: 43.6 %"), footnotes, freshness. Nothing wider than 390.
5. Export: read the artboards back (`Artifact read` with `path`), write
   `design/project/TopDeals.dc.html` and `TopDealsPhone.dc.html` in the `gen.py:13-42` skeleton,
   add `canvas.json` boards (x 4080, y 1800 and x 940, y 4120), `order`, `notes` widths; the row in
   `design/README.md`, the stale Login row dropped. Commit `integrator: Top deals design boards`.

## P2: the page lane and the wiring, at once

Merge top-deals, ui-components, sync-category (in that order, gates each). Then in parallel:

### ui-top-deals (sonnet), `docs/lanes/ui-top-deals.md`
- `renderTopDeals: PageRenderer<TopDealsPageProps>`, pure. `TOP_N = 20`, `WALK_TIME_TEXT =
  "00:30 UTC"`, the lead ("The 20 Groupon deals that save the most in one city and one category,
  by amount or by percent. Saving means the original price minus the price you pay at Groupon
  checkout. A promo code, where one exists, is a footnote."). `topDealsHref(query, patch)` builds
  `/top-deals?category=&label=&place=City%2C+ST&sort=`.
- Sections: title and lead; the picker form (GET, three `selectField`s with counts in the option
  labels, "All of <category>" first in the label select, hidden `sort`, "Show"; an asked value
  missing from a list is prepended as its own selected option); the results section with the
  heading ("Top 20 in New York, NY: Things To Do", or "All N discounted deals in ...", or the label
  in parentheses) and the sort toggle on the same row; the ranked table (`#`, Deal linked to
  `/deals/:id` with a "promo" superscript and the option title beneath, City, Original in `<s>`,
  You pay, You save, Saved %; numeric cells `.num` with `data-label`); footnotes
  `<ol class="footnotes">` with `<li id="promo-N" value="N">` holding `promo.instruction`; the
  freshness line naming 00:30 UTC, the last walk, and the next delta sync (`nextDeltaText(now)`).
- Empty cases, one sentence each with a time or a next step: no cities; no tags or query null
  ("Categories appear after the first category walk, tonight at 00:30 UTC."); no rows with a
  label (link to the whole category); no rows for the category (link to the next city); fewer
  than 20 rows (heading "All N").
- Tests (facts): the three pickers with the chosen values selected and a Show button; only the
  labels of the chosen category with the whole category first; the sort in a hidden field; ranks
  from 1 with the deal linked and the option beneath; the original struck and the price to pay
  and nothing else as a price in a row; the saving in money and percent as numeric cells; amount
  sort current by default and the percent link with the same pickers; each promo sentence in the
  footnotes with the row's rank; no footnotes when no row carries a promo; Top 20 vs All N; the
  label and the category in the heading; every price cell labelled for the phone layout; the four
  empty-case sentences; an asked city outside the top 50 kept as the selected option; when the
  tags refresh and the next delta runs; escapes a title, a label and a city; nav link current;
  never says "no data".

### Integrator wiring (concurrent with ui-top-deals)
- `src/ui/routes.ts`: `topDealsQueryOf(params)`: `place` "City, ST" split by
  `/^(.*\S)\s*,\s*([A-Za-z]{2})$/` (state upper-cased), `category` and `label` through `text()`,
  `sort` only `percent` or `amount`; with no query string at all the category defaults to
  `things-to-do`. `GET /top-deals` → `page(renderTopDeals({ report, now }))`;
  `GET /data/top-deals.json`.
- `test/app/pages.test.ts`: opens with real deals for the default pair (Chicago, bowling:
  `<s>$90.00</s>`, `$39.00`, `56.7 %`, kayak absent, noindex header); orders by percent when asked
  and marks that sort current, by amount otherwise (laser before a seeded spa deal by percent, the
  reverse by amount); only the labels of the chosen category, stale label dropped; a sentence, not
  a 500, for a city outside the list; categories appear after the first walk when nothing is
  tagged; nothing loaded on an empty catalogue; `/data/top-deals.json` payMinor equals retail.
- `bin/walkthrough.ts`, before the MCP block: opens with 20 real deals for the default pair, never
  empty; a chosen city and category returns 20 ranked rows or says why fewer; sort by percent puts
  the largest percent first and sort by amount the largest amount, and the lists differ; every row
  shows the original above the price to pay, You save equals the difference, every promo price
  appears only in a footnote whose row shows the retail price; a city outside the list answers a
  sentence, not a 500; the Top deals link is in the nav of every page.
- `docs/ops/loop4.md`: title "Loop 4: the Top deals page (from 2026-09-30)", the rule and the exit
  condition (two clean rounds, then the CEO review at 4 of 5), "What working means" rows for
  `/top-deals` and the category walk job, then `## Round N` sections
  (`| # | Miss | Cause | Fix | Who |`) and `## CEO review round N` sections.
- Merge docs-showcase and export-public as they report; fold `changes/*.md` into `CHANGELOG.md`.

## P3: publish, bootstrap, loop 4

1. Merge ui-top-deals. `bin/publish` (applies 0009, deploys, smoke including `/top-deals`).
2. `bin/zal job top-cities`, then `bin/zal job category-walk`. Things-to-do is the first run, so
   `/top-deals` works within minutes while the other 37 categories fill. Watch with
   `wrangler d1 execute zorasocial --remote --command "SELECT category1, status, pages, products, finished_at FROM sync_runs WHERE kind = 'category' ORDER BY started_at, rowid"`.
3. Round: `bin/walkthrough --no-carts`; Playwright MCP at 1280 × 900 and 390 × 844 on
   `/top-deals` and the empty-state URL: document scroll width at or under 390; screenshots to
   `docs/ops/loop4/top-deals-desktop.png` and `top-deals-phone.png`; record the round; every miss
   goes to its owning lane (round N appended to the brief), the lanes run in parallel, merge,
   publish, repeat until two clean rounds in a row. Numbers in the record come from `sync_runs`
   and the walkthrough output, never from memory.

## P4: the the second model CEO review loop (the final gate)

the second model reviews only the public snapshot: nothing private can reach it by construction (the
snapshot's forbidden scan passed). the builder's panel rule applies: never prime it with our
conclusions; paste its answer verbatim; a missing second opinion is reported, never faked.

1. Prepare the review folder inside the snapshot: `bin/export-public` (fresh snapshot), then
   `../zorasocial-public/review/` with `top-deals.html` (the live page, fetched), `walkthrough.txt`
   (the last run's output), the two screenshots copied from `docs/ops/loop4/`. The prompt file is
   `docs/ai-builder/prompts/12-ceo-review-prompt.md` (committed before the first run).
2. Run, from the integrator session:
   ```
   codex exec -C ../zorasocial-public -s read-only --skip-git-repo-check \
     -i review/top-deals-desktop.png -i review/top-deals-phone.png \
     "$(cat docs/ai-builder/prompts/12-ceo-review-prompt.md)" < /dev/null | tee docs/ops/loop4/ceo-review-N.txt
   ```
   The prompt: "You are the CEO who asked for this today: <the ask, roles only>. In your working
   directory is the public repository of what was built; `review/` holds the rendered page, the
   acceptance run and two screenshots. Review it as that CEO would, for showing it to people as an
   example of an AI Builder project. Score each lens 1 to 5 as a whole number, with a short quote
   from the repository as the citation: Impact obsessed (does it do exactly what was asked, and is
   it worth showing); Simplify to scale (one authoritative page says who it is for, what it does,
   where it lives, how success is measured; a builder can reproduce it from the prompts);
   Disciplined (every number and claim has a source, tests, acceptance criteria and run records);
   Speed over comfort (shipped and live, time from ask to live stated, nothing half-built);
   Extreme ownership (an owner, open items and honesty notes, next steps). Then: the single
   strongest reason you would reject this; what is asserted without evidence; what you would need
   to know that this does not tell you; overall stars 1 to 5; a two-sentence narrative; the three
   changes that would raise the score most. Answer as JSON with those fields." Nothing else is
   sent: no rulings, no profiles, no transcripts.
3. Pass when overall stars ≥ 4 and no lens below 3. Otherwise: the three changes become misses in
   `docs/ops/loop4.md` `## CEO review round N`, assigned to their owning lanes (docs-showcase for
   the story, ui lanes for the page, top-deals for data), run in parallel, merged, published,
   snapshot refreshed, the second model re-run. At most 3 rounds; after 3 the last score and the open items are
   reported to the builder as they are. Each round: the verbatim answer in `docs/ops/loop4/ceo-review-N.txt`,
   the scores in the record, a row in `docs/ops/llm-manual-runs.md` (the second model leg on the ChatGPT
   subscription, tokens as codex reports them, $0 billed). If codex fails twice: "SECOND OPINION
   UNAVAILABLE" in the record, the loop stops, the builder is told.
4. The final score appears in `docs/ai-builder/README.md` under "How success is measured", with
   the date and the round count.

## P5: hand-over

- Fill the `<fill>` numbers in `docs/ai-builder/README.md`; copy `03-plan.md` (this plan, cleaned)
  and `05-acceptance.md`; final `bin/export-public`; read the snapshot README once.
- Report to the builder: the live page, the walkthrough and CEO review results per round, the snapshot
  path and the two push commands, the run evidence, and the still-open `ZAL_AGENT_TOKEN` rotation
  (recommended before the push, since the public repo explains how the API is reached).
- The message to the CEO is composed only on the builder's go, with the zora-answer skill (ZORA BRIEF):
  the page URL, how to use it in his four terms, the repo link once pushed, the prompts folder,
  the catalogue facts, the review score; Czech; footer `human-approved`. No text before the go.

## Verification

- `bun run typecheck`, `bun test`, `bun bin/lane-check.ts <lane>` green in every worktree and on
  main after every merge.
- `bin/publish` smoke: `/top-deals` 200; `bin/walkthrough --no-carts` 0 missed, two rounds in a
  row; screenshots at 1280 and 390 with scroll width at or under 390.
- Production: 38 complete category runs in `sync_runs` with `category1` set;
  `product_categories` holds things-to-do tags; `top_cities` has 50 rows with New York first;
  `/data/top-deals.json` rows have `payMinor` equal to the option's retail and
  `originalMinor > payMinor`.
- `bin/export-public` exits 0 with typecheck and tests green inside the snapshot; the forbidden
  scan finds nothing; `git rev-list --count HEAD` in the snapshot is 1.
- the second model CEO review: overall ≥ 4 stars, no lens below 3, verbatim answer on disk.
- `bin/eval-search`, the probe and the finder are unchanged (the walk writes no product rows).

## Out of scope, noted for later

- Exposing top deals on `/api/v1` and as an MCP tool for agents.
- `ZAL_VAULT` override in `collector/run.ts` and `bin/zal.ts`.
- Rotating `ZAL_AGENT_TOKEN` (the builder's decision, open since loop 3).
