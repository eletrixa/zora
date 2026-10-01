<!-- Module: docs/ai-builder/evidence.md · Tested: n/a -->
# Release evidence

One page that ties every claim in the AI Builder story to something a reader can check, across both
rounds of the build: the Top deals page (loop 4) and the unified, two-look site (loop 5). Times are
UTC. Every number below names its file or its command; none comes from memory.

## Current release

This names the release that CEO review round 3 read (`docs/ops/loop5.md`, "CEO review round 3"), the
one authoritative set of numbers for this page; every other section below points back to it instead of
repeating its own copy.

| What | Value |
|---|---|
| Live site | `https://zorasocial.asajj.cz` (`/`, `/find`, `/price-truth`, `/scorecard`, `/deals/:id`; `/top-deals` answers a 301 that keeps the query string) |
| Deployed Worker version | `de936880-d457-4632-9b1f-56fa9f419afa`, published 2026-10-01 13:37 UTC from `d176ca2`: the promo as one line under its deal in place of the footnote list (`docs/ops/loop5.md`, "After the hand-over"). Before it `e3388aad-6cf8-4560-9258-2beeef478e6c`, published 04:52 UTC, after the CEO review: the seven round 3 lanes merged and the delta sync recovered on production (`docs/ops/loop5.md`, "After the review"). The release the CEO review read was `8cdb2d3e-04e0-475b-818e-9994bd0a7a01`, published 04:17 UTC from `b89c25c` |
| Source revision | `e77089a`, "integrator: a delta run resumed and finished in the current window is that window's sync, never late" (the public snapshot's commit message names its own source revision and this Worker version) |
| Public snapshot | commit `7a6e629`, exported 04:18 UTC from source revision `b89c25c` (the copy CEO review round 3 read) |
| Private repository revision | `docs/ops/snapshot-gates.txt`, written by the exporter inside the tree before the commit, is the one place meant to name the Worker version live at export and its deploy time beside the source revision and the `typecheck`/`test` gate output; this export ran without the `--worker-version`/`--deployed-at` flags, so it still reads "Worker version: not given" (CEO review round 3, findings 6 and 7; the exporter does not yet refuse an export missing them, open, fix lane export-public) |
| Acceptance run on this release | `bin/walkthrough --no-carts`, 23 passed, 0 missed, `docs/ops/loop5/walkthrough-review-3.txt`; the nine screenshots of this release, taken 04:19 UTC, are in `docs/ops/loop5/` |
| Public repository | https://github.com/eletrixa/zora, pushed 2026-10-01 on the owner's go (the owner chose the builder's own GitHub account, not the company organisation) |

## Both ask-to-outcome timelines

From the commit log of the private repository: `TZ=UTC git log --format='%h %ad %s' --date=format-local:'%Y-%m-%d %H:%M'`.

**Round 1, the Top deals page: the first ask to the page live.**

| Milestone | When (UTC) | Source |
|---|---|---|
| The first ask reaches the coding session | 2026-09-30 14:15 | `prompts/01-the-ask.md`; `docs/ops/loop4.md` |
| The lane briefs committed | 2026-09-30 15:44 | commit `c7aa463` |
| The page live | 2026-09-30 20:06 | `docs/ops/loop4.md`, "Round 1" (Worker version `ab5e73a5`) |
| The second clean round, loop closed | 2026-09-30 20:13 | `docs/ops/loop4.md`; commit `7fd18fc` |

Ask to live: 5 hours 51 minutes. Briefs to the second clean round: 4 hours 29 minutes.

**Round 2, the unified site: the second ask to the second clean round, and to the release under review.**

| Milestone | When (UTC) | Source |
|---|---|---|
| The second ask | 2026-09-30, between 20:45 (loop 4's last CEO review ended) and 20:53 (the commit below) | `prompts/13-the-second-ask.md`'s header states the same window; the ask follows loop 4's last review (`docs/ai-builder/evidence.md`, "CEO review rounds", round 3 of loop 4, ended 20:45) and precedes its own commit |
| The second ask committed | 2026-09-30 20:53 | commit `24bf8c1` (carries `prompts/13-the-second-ask.md`) |
| The lane briefs committed | 2026-09-30 21:10 | commit `e27fcbe` |
| The second clean round, loop closed | 2026-10-01 03:01 | `docs/ops/loop5.md`, "Loop status"; recorded in commit `b7ec5c4` |
| The release under review, live | 2026-10-01 04:17 | Worker `8cdb2d3e-04e0-475b-818e-9994bd0a7a01`, source `b89c25c` (`docs/ops/loop5.md`, "CEO review round 3") |
| The post-review fixes, live | 2026-10-01 04:52 | Worker `e3388aad-6cf8-4560-9258-2beeef478e6c`, source `e77089a`; the delta run opened at 00:01 UTC resumed and completed at 04:50 UTC, 4 pages, 187 products, 0 errors (`docs/ops/loop5.md`, "After the review") |
| The promo line, live | 2026-10-01 13:37 | Worker `de936880-d457-4632-9b1f-56fa9f419afa`, source `d176ca2`; the promo footnote list replaced by one line under each deal, at the owner's word (`docs/ops/loop5.md`, "After the hand-over") |

Second ask committed to the second clean round: 6 hours 8 minutes. Lane briefs to the second clean
round: 5 hours 51 minutes (the figure in `docs/ai-builder/README.md`, "The second round"). Second ask
committed to the release under review, live: 7 hours 24 minutes.

## Catalogue numbers at the Top deals release, the queries and their results

Run against the production D1 database at 2026-09-30 20:10 UTC with `wrangler d1 execute zorasocial --remote`:

```sql
SELECT (SELECT COUNT(*) FROM products WHERE listable = 1) AS listable,
       (SELECT COUNT(*) FROM options o JOIN products p ON p.id = o.product_id WHERE p.listable = 1 AND o.active IS NOT 0) AS sellable,
       (SELECT COUNT(*) FROM options o JOIN products p ON p.id = o.product_id WHERE p.listable = 1 AND o.active IS NOT 0 AND o.original > o.retail) AS discounted,
       (SELECT listable_products FROM top_cities WHERE rank = 50) AS rank50,
       (SELECT COUNT(*) FROM product_categories WHERE category1 = 'things-to-do') AS ttd;
-- listable 55822 | sellable 153949 | discounted 149453 | rank50 172 | ttd 8803
SELECT COUNT(DISTINCT jf.value) AS labels FROM products p, json_each(p.category_labels) jf WHERE p.listable = 1;
-- labels 543 (run again at 20:35 UTC: 543)
SELECT city, state, listable_products FROM top_cities ORDER BY rank LIMIT 6;
-- New York NY 1599 | Los Angeles CA 1150 | Houston TX 1131 | Las Vegas NV 1029 | Miami FL 889 | Chicago IL 809
```

The delta sync every three hours moves these counts by a few dozen; the unified site (loop 5) serves
the same catalogue and has not been re-queried for this page. The category walk: `things-to-do`
complete at 19:50 UTC (177 pages, 8,816 products seen, 8,803 listable and tagged); all 38 categories
complete at 20:23:41 UTC, 72,707 tags in total; the cron repeats the walk daily at 00:30 UTC.

## Acceptance runs

Loop 4 (Top deals): `bin/walkthrough --no-carts`, rounds 1 to 4 at 20:06, 20:10, 20:12 and 20:13 UTC
on version `8b41fbca`, and round 5 at 20:29 on version `259ef9c8`, each 18 passed, 0 missed
(`docs/ops/loop4/walkthrough-round-4.txt`, `-round-5.txt`); phone and desktop widths 1280 and 390 px
by round 3. The misses and their fixes: `docs/ops/loop4.md`.

Loop 5 (the unified site), `bin/walkthrough --no-carts` against the live host, all five pages at 1280
and 390 px in both looks:

| Round | When (UTC) | Worker version | Walkthrough | Scroll width | Visual misses | Record |
|---|---|---|---|---|---|---|
| 1 | 01:00 | `5fdf3cc8` | 22 passed, 0 missed | 1 width miss | 20 | `docs/ops/loop5/walkthrough-round-1.txt` |
| 2 | 01:32 | `20f87e7f` | 22 passed, 0 missed | clean | 12 | `docs/ops/loop5/walkthrough-round-2.txt` |
| 3 | 02:14 | `c7b9ef42` | 22 passed, 0 missed | clean | 9 | `docs/ops/loop5/walkthrough-round-3.txt` |
| 4 | 02:35 | `d4a4583b` | 22 passed, 0 missed | clean | 3 | `docs/ops/loop5/walkthrough-round-4.txt` |
| 5 | 02:44 | `21ee44f0` | 22 passed, 0 missed | clean | 2 | `docs/ops/loop5/walkthrough-round-5.txt` |
| 6 | 02:53 | `48c8c1e9` | 22 passed, 0 missed | clean | 0 (first clean round) | `docs/ops/loop5/walkthrough-round-6.txt` |
| 7 | 03:01 | `48c8c1e9` (same deploy, re-run) | 22 passed, 0 missed | clean | 0 (second clean round, loop closed) | `docs/ops/loop5/walkthrough-round-7.txt` |

Both loop rounds skip the two cart checks on purpose (`--no-carts`); they were run with both
checkouts on the live site at 2026-10-01 03:15 UTC: 24 passed, 0 missed
(`docs/ops/loop5/walkthrough-checkout.txt`).

## Outcome measure

Beyond test passes and model scores, the release names one shopper-facing outcome: the share of
today's sampled carts and public listing pages where the price shown matches the price the shopper
pays (`/price-truth`, the price truth monitor). `/data/price-truth.json` at 04:33 UTC: `cartSamples`
for 2026-10-01, 20 sampled, 20 matched, 0 price mismatch, 0 unavailable, 0 errors; `publicComparison`
for 2026-10-01 has no row yet, the newest is 2026-09-30, 59 matched deals, 59 show retail, 0 show the
promo price, 0 show another price (the integrator's answer to `requests/docs-showcase.md`, open since
CEO review round 1, answered after round 3). What this still lacks is a target: CEO review round 3,
finding 16, asks for one beyond tests and model scores; it is the owner's to agree, in "Open items,
owners, status" below.

## Checkout evidence for the price shown

**What "fully final" means.** Fully final, here, means the retail price before any sales tax; a promo
code is a separate saving the shopper types in at checkout, never part of the price shown. The guide
states the cart excludes both: "grandTotal in totals excludes tax and any promo code. The final amount
is shown on Groupon's checkout page." (`docs/reference/partner-guide-v7.txt`, "Using the cart
response").

The page shows the retail price the Partner API quotes. The price truth monitor (product 1) checks
that price against Groupon's own cart every day: on 2026-09-30 it created 20 real carts from the
catalogue and all 20 quoted the catalogue's retail price (`/data/price-truth.json`, `cartSamples`:
sampled 20, matched 20, mismatch 0). The collector read 59 public Groupon listing pages that day and
all 59 showed the retail price (`publicComparison`: matchedDeals 59, showsRetail 59). What the page
does not claim: sales tax, which the final amount on Groupon's own checkout page carries, not this
one; and a promo price, which applies only when the shopper types the code, so it stays a footnote.

## Open API findings

Three findings the daily probe (product 2, the Scorecard) has recorded against the guide text, not
yet raised with the Partner API team. Detail and first record: `docs/ops/loop3.md`; F-003 was refined
there from "the quantity change is silently ignored" to the `maxUnits` clamp below. The Scorecard's
daily run still shows all three as open.

| Finding | What | Owner | Status | Next step |
|---|---|---|---|---|
| F-001 | `GET /products` pages carry no `timestamp` field, though the guide says to take `lastRefreshAt` from it | the owner | open | raise with the Partner API team, with a contact and a date |
| F-002 | `GET /products?state=<code>` with no matching listable product answers HTTP 400 `invalid_argument` instead of HTTP 200 with zero products | the owner | open | raise with the Partner API team, with a contact and a date |
| F-003 | A cart quantity above an option's `restrictions.maxUnits` is silently clamped to the limit: HTTP 200, success, nothing in the body says so | the owner | open | raise with the Partner API team, with a contact and a date |

The catalogue's own delta sync has separately stalled since 00:01 UTC on 1 October: two runs in a row
crashed inside the Worker rather than failing cleanly. Cause and the fix lanes: CEO review round 3,
findings 1 and 2, below (first raised as CEO review round 2, findings 7 and 8).

## Reproduction check

`docs/ops/snapshot-gates.txt` is written by the exporter inside every snapshot before its commit: the
source revision and the tail of `bun run typecheck` and `bun test` run in that exact tree. A
clean-clone reproduction by a second builder (no Cloudflare account, no partner key: install, the
local database, both gates, every page answering locally in its empty state) is recorded in
`reproduction.md` beside this page; it did not attempt registration, a deployment or a populated
catalogue. A fresh deployment of this snapshot, with inventory and a completed search-to-checkout
journey, by an independent builder with their own accounts, has not been done; see "Open items"
below.

## CEO review rounds

| Loop | Round | When (UTC) | Stars | Impact | Simplify | Disciplined | Speed | Ownership | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 4, Top deals | 1 | 20:17 to 20:24 | 3 | 4 | 3 | 3 | 4 | 3 | the prompt archive completed, the price claim stated with checkout evidence, this page |
| 4, Top deals | 2 | 20:25 to 20:34 | 3 | 4 | 3 | 3 | 4 | 4 | the price sentence deployed and re-checked; the snapshot names its source revision and gate output; a second builder's clean-clone reproduction |
| 4, Top deals | 3 | 20:32 to 20:45 | 3 | 4 | 3 | 4 | 4 | 4 | the last round the plan allowed; the push and the token rotation left to the owner |
| 5, unified site | 1 | 2026-10-01 03:04 to 03:08 | 3 | 4 | 3 | 3 | 4 | 3 | below the 4-star bar; fourteen findings, closed below |
| 5, unified site | 2 | 2026-10-01 03:49 to 03:54 | 3 | 3 | 3 | 3 | 4 | 3 | below the 4-star bar again; sixteen findings, closed below |
| 5, unified site | 3 | 2026-10-01 04:19 to 04:26 | 3 | 3 | 3 | 3 | 4 | 3 | below the 4-star bar a third time, the last round the plan allowed; seventeen findings: the catalogue sync crash was briefed but not in the release this round read, closed below |

Verbatim answers: `docs/ops/loop4/ceo-review-1.txt` to `-3.txt`; `docs/ops/loop5/ceo-review-1.txt` to `-3.txt`.

## Open findings from the CEO review (loop 5, round 1)

Findings that needed a code change, not a documentation one, with who owned the fix and where it
stands now that CEO review round 2 has read the result. Full detail: `docs/ops/loop5.md`, "CEO review
round 1" and "CEO review round 2" (whose own finding 10 records that these were still marked "open"
or "in progress" here after they had in fact merged; this table now reads from `docs/ops/loop5.md`
instead).

| # | Finding | Owner | Status | Target date |
|---|---|---|---|---|
| 1 | Price truth and the Scorecard disagree on the last delta sync, syncs today and the last full load | integrator, then ui-price-truth | done: one `syncFacts()` in `src/lib/sync-facts.ts`; both pages read it, `test/app/pages.test.ts` holds their figures equal (1,090 tests) | done |
| 2 | Price truth's Next sync and Changes today cards state scheduled syncs as runs that already happened | ui-price-truth | done, merged with row 1 | done |
| 3 | The Scorecard's Next sync card does not tell a complete sync from a running or late one | ui-scorecard | done, merged with row 1 | done |
| 4 | No test holds both pages to the same sync facts | integrator | done: `test/app/pages.test.ts` | done |
| 5 | Price truth calls a sample dated 30 Sep "today" when read on 1 Oct, and states 30-day rates with no coverage or selection note | ui-price-truth | done: the verdict names the sample's day, states when today's sample runs, and gives the coverage and selection note (confirmed live in the CEO review round 2 snapshot) | done |
| 6 | The promo gap histogram (144,602) and its caption (144,772) disagree, read at different times | monitor | in progress: migration 0010 (`promo_gap_bands`) and the read model's "latest snapshot" logic landed, but the live snapshot (30 Sep, 12:21 UTC) predates it and has no stored bands, so the page drew nine bands of zero instead of none; carried forward as CEO review round 2, finding 1 | the owner to set |
| 7 | The Promo gap section does not say when its figures were taken | ui-price-truth | done: "Snapshot of 30 Sep, 12:21 UTC; the next at 04:30 UTC." (confirmed live) | done |

Findings 8, 9, 11 and 13 of that round were this lane's own (this page, the README wording, the fork
list and the outcome measure's framing); 10 and 12 are done (`35163bc`,
`docs/ops/loop5/walkthrough-checkout.txt`).

## Open findings from the CEO review (loop 5, round 2)

The sixteen findings of CEO review round 2, with who owns the fix and where it stands while the fix
lanes run. Full detail: `docs/ops/loop5.md`, "CEO review round 2".

| # | Finding | Owner | Status | Target date |
|---|---|---|---|---|
| 1 | Options by gap shows nine bands of 0 under a caption of 144,772 options with a code: `gapBandsAt` fills zero bands when `promo_gap_bands` has no row for the snapshot | monitor | merged: `gapBandsAt` returns no bands rather than zeros when none are stored | done |
| 2 | The page draws whatever bands it gets, beside a caption they do not add up to | ui-price-truth | merged: the histogram draws only when the bands sum to the caption, else the empty state | done |
| 3 | The verdict banner's sentence stacks one word per line in both desktop looks; pixel Price truth is 1,418 px wide at 1280 | ui-price-truth | merged: the 30-day figure is the rate alone, the coverage moved to the label | done |
| 4 | The banner lets its figures take the width the sentence needs | ui-components | merged: the sentence keeps a readable width, figures that do not fit wrap under it | done |
| 5 | The Last delta sync card puts a whole sentence in a narrow value column on Price truth and the Scorecard | integrator | done: `syncFacts` now gives `lastDeltaAt` (the stamp) and `lastDeltaNote` (the state) apart (`4a349fe`) | done |
| 6 | The same, on the page | ui-price-truth, ui-scorecard | merged: `lastDeltaAt` prints as the value, `lastDeltaNote` under the card | done |
| 7 | The catalogue's delta sync has stalled since 00:01 UTC on 1 October: the 00:01 and 03:01 UTC delta calls both crashed on a D1 bind-count error (`job_runs`) because a product with 100 or more options binds past D1's limit of 100 | catalogue-store | open, fix lane in progress: the delete never binds more than 100 values, with a test on a 150-option product; had no commit before this release shipped, carried into CEO review round 3 as finding 1 | the owner to set |
| 8 | Both pages said "the 03:00 UTC sync has not started" although it had started and crashed, because a crashed run stays recorded as `running` | sync-category | open, fix lane in progress: catch the crash and mark the run failed with its code and message; had no commit before this release shipped, carried into CEO review round 3 as finding 2 | the owner to set |
| 9 | The release under review passed the loop's two clean rounds but not one of its own before it shipped; the pixel overflow was recorded, not fixed | integrator | done: the rule (every deploy that goes to review passes a full round first) held for this release (`8cdb2d3e`): `bin/walkthrough` ran before export, 23 passed, 0 missed, `docs/ops/loop5/walkthrough-review-3.txt` | done |
| 10 | No one authoritative release page: mismatched deploy, source and snapshot; round 1 findings still read "open" or "in progress" after they had merged; every target date "not set" | docs-showcase | done: this page | done |
| 11 | The snapshot does not carry the deploy it describes | export-public | merged: `docs/ops/snapshot-gates.txt` also names the Worker version live at export and its deploy time, when the exporter is given both flags; this export ran without them (CEO review round 3, findings 6 and 7) | done |
| 12 | The second ask's timeline contradicts itself: committed at 20:53 UTC, the header read 21:50 UTC | docs-showcase | done: the header now states the window the ask fell in (`prompts/13-the-second-ask.md`); both timelines above agree | done |
| 13 | No outcome measure with today's number | integrator | done: the integrator's answer filled "Outcome measure" above with the 1 Oct counts | done |
| 14 | "Fully final" not stated as retail before tax with a promo code typed separately; the three open API findings have no owner or plan on the release page | docs-showcase | done: "Checkout evidence for the price shown" and "Open API findings", above, and the story (`docs/ai-builder/README.md`) | done |
| 15 | `ZAL_AGENT_TOKEN` not rotated, the source not pushed, no independent builder has reproduced a populated deployment | the owner | open | the owner to set |
| 16 | No agreed success target beyond checks and reviews, no acceptance that "fully final" means retail before tax, no target dates, the three API findings not taken to the Partner API team | the owner | open | the owner to set |

## Open findings from the CEO review (loop 5, round 3)

3 stars again, the third and last round the plan allowed; reject reason: "The product promises price
confidence while its catalogue refresh is broken and its monitoring misdescribes the failure." The
seventeen findings, who owns each fix and where it stands. Full detail: `docs/ops/loop5.md`, "CEO
review round 3".

| # | Finding | Owner | Status | Target date |
|---|---|---|---|---|
| 1 | The catalogue's delta sync still crashes on every call: `D1_ERROR: variable number must be between ?1 and ?100` | catalogue-store | open, fix lane in progress: the delete never binds more than 100 values, with a test on a 150-option product (the fake D1 now fails that bind the way D1 does, `c208bd2`) | the owner to set |
| 2 | A crashed call leaves its run `running`, so the pages describe a crash as a run in progress | sync-category | open, fix lane in progress: catch the crash, mark the run failed with code `CRASH` and the message | the owner to set |
| 3 | Both pages say "Late: the 03:00 UTC sync has not started" though the 03:01 UTC call ran | integrator | done: no late window while a delta run is open (`6fb2cf4`); `test/lib/sync-facts.test.ts` and `test/app/pages.test.ts` hold the three states (failed, late, open) to their exact line on both pages | done |
| 4 | No production evidence that the sync recovered and that the pages show it | integrator | open, after findings 1 and 2 above merge and deploy: run the delta sync, record its run id, status, pages and products, and the line both pages print | the owner to set |
| 5 | The release record is not current: this page named the 03:46 UTC deploy while `8cdb2d3e` (04:17 UTC) was live; round 2 findings still read "in progress" after they merged | docs-showcase | done: this page | done |
| 6 | The snapshot says "Worker version: not given" | integrator | open: the export ran without `--worker-version` and `--deployed-at`; the rule (every export passes both) is set and applies at the next export, not yet run | the owner to set |
| 7 | The exporter lets a snapshot leave without its deploy | export-public | open, fix lane in progress: the exporter refuses to export without both flags unless `--no-worker-version` says why | the owner to set |
| 8 | `docs/ops/loop5/` held round 7's screenshots, not the release under review | integrator | done: the nine 04:19 UTC screenshots of `8cdb2d3e` are in `docs/ops/loop5/` (`6fb2cf4`) | done |
| 9 | Price truth says "Mondays run higher" with no observed Monday | ui-price-truth | open, fix lane in progress: say when the weekly full load runs; claim a Monday pattern only from recorded days | the owner to set |
| 10 | "No mismatch in the last 30 days" over one sampled day | ui-price-truth | open, fix lane in progress: name the sampled days, "No mismatch on the 1 sampled day of the last 30" | the owner to set |
| 11 | The acceptance claim that the finder offers the same categories as Top deals was checked on one category only | integrator | done: the walkthrough now checks the whole sets, 23 passed, 0 missed (`docs/ops/loop5/walkthrough-review-3.txt`); "What working means" in `docs/ops/loop5.md` states the rule (`6fb2cf4`) | done |
| 12 | Top deals' note says the lists offer "Groupon's top categories" while it lists only the categories with deals in the city | ui-top-deals | open, fix lane in progress: the note says the category list holds the N categories with deals in the chosen city | the owner to set |
| 13 | The finder's note says the same sentence while it lists all 32 categories | ui-finder | open, fix lane in progress: the note says the list holds all N categories; a category with no deal in the chosen city answers the empty sentence | the owner to set |
| 14 | `ZAL_AGENT_TOKEN` not rotated; the source and prompts not pushed, no public repository URL | the owner | open | the owner to set |
| 15 | No independent builder has deployed this release with inventory and completed search to checkout link | the owner | open | the owner to set |
| 16 | No agreed user outcome and target; no agreement that "fully final" means retail before tax with the promo separate; no agreed shared filter rule | the owner | open: the 1 Oct outcome numbers are in "Outcome measure" above; the shared filter rule is in "Open items, owners, status" below | the owner to set |
| 17 | No dated owners for the open items; no Partner API contacts for F-001 to F-003 | the owner | open | the owner to set |

Fix lanes: catalogue-store, sync-category, docs-showcase, export-public, ui-price-truth, ui-top-deals
and ui-finder (`docs/lanes/<lane>.md`, "Review round 3, loop 5 fixes"). Findings 3, 8 and 11 are on
main (`6fb2cf4`; the fake D1's bind limit, `c208bd2`; 1,101 tests green) but not yet deployed; finding
6 applies at the next export; finding 4 follows the merges of findings 1 and 2. Loop 5 closed on
2026-10-01 with the review bar not reached, three rounds run, the most the plan allowed
(`docs/ops/loop5.md`, "Status").

## Open items, owners, status

| Item | Owner | Status | Target date |
|---|---|---|---|
| Rotate `ZAL_AGENT_TOKEN` before the public push (the token was printed into an agent transcript in loop 3) | the owner | open, a release prerequisite | the owner to set |
| Push the snapshot and add the URL here | the owner | done 2026-10-01: https://github.com/eletrixa/zora; the token rotation stays open | done |
| An independent builder deploys this exact snapshot with inventory, through their own Cloudflare account and partner registration | the owner, to find and brief that builder | open | the owner to set |
| That builder completes the search-to-checkout-link journey on phone and desktop | the same independent builder | open | the owner to set |
| Ship the exporter itself (move its private strings into a file outside the repo) | the owner, optional | open, not a release prerequisite | the owner to set |
| The message to the CEO with the page and the repo link | the owner, on the builder's go | not started | the owner to set |
| Agree the success target beyond checks and reviews (CEO review round 2, loop 5) | the owner | open | the owner to set |
| Accept in writing that "fully final" means the retail price before any sales tax, with a promo code typed separately at checkout (CEO review round 2, loop 5) | the owner | open | the owner to set |
| Agree the shared filter rule: Top deals lists only the categories with deals in the chosen city (9 in New York, NY on 2026-10-01), the finder lists all of them (32), both the same 50 cities (CEO review round 3, loop 5) | the owner | open | the owner to set |
| Set a target date for every open item on this page (CEO review round 2, loop 5) | the owner | open | the owner to set |
| Take the three open Scorecard findings (F-001, F-002, F-003 above) to the Partner API team, with a contact and a date | the owner | open | the owner to set |
| The first day's category walk finishing | the cron and the Workflow, no hand needed | done: 38 of 38 complete at 20:23 UTC, 0 failed (`sync_runs`) | done |
