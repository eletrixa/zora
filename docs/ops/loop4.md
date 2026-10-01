<!-- Module: docs/ops/loop4.md · Tested: n/a -->
# Loop 4: the Top deals page (from 2026-09-30)

The CEO asked for a page that shows the top 20 Groupon deals in a chosen city and category, sortable
by the amount saved and by the percent saved, with only the original price and the final price
shown, presented as an example AI Builder project. Rule as in loop 3: every page shows today's
numbers or says, with a time, when they arrive. Each round: run the data jobs, run `bin/walkthrough`,
look at the page at 1280 and 390 px, fix every miss through the owning lane, publish. The loop ends
after two clean rounds in a row; then the CEO review by a second model, looped until 4 of 5 stars
with no lens below 3.

## What working means

| Surface | Working means |
|---|---|
| `/top-deals` | Opens with real deals for Things To Do in the city with the most listable products, sorted by amount, 20 ranked rows. The category picker lists Groupon's top categories tagged by the daily walk, things-to-do first, then the leaf labels inside the chosen one; the city picker lists the 50 cities with the most listable products as "City, ST". A chosen pair shows 20 deals (the top three as cards, the rest as ranked rows) or a heading that says "All N"; each deal shows the original price struck through, the price to pay, the saving in money and in percent, and a link to the deal; four tiles sum the list up (biggest saving, typical saving, saved across the top 20, promo codes); "By percent saved" puts the largest percent first; the promo code and promo price appear only in the footnotes, never in a price cell; a city outside the list answers a sentence with a next step, not a 500; before the first category walk the page names when it runs; the page fits 390 px (document scroll width at or under 390). Public, noindex. |
| `category-walk` job | One Workflow instance, 38 `category1` values, things-to-do first, one request per second; one `sync_runs` row per category with counts; a failed category is recorded and skipped, never retried in the same cycle; a walk never writes a product row or moves the watermark. |
| `top-cities` job | 50 rows in `top_cities`, New York, NY first, keyed by city and state, replaced in one write; an empty catalogue keeps yesterday's list. |

`bin/walkthrough [host] [--no-carts]` checks the page lines above. It prints every miss and exits
1 on any miss.

## Round 1, 2026-09-30 20:06 to 20:09 UTC

Published 20:06 UTC (Worker version ab5e73a5). Data jobs run by hand at 19:44 UTC: `top-cities` (50 rows,
New York, NY first with 1,599 listable products), `category-walk` (things-to-do complete at 19:50 UTC with
8,816 products tagged; 15 of 38 categories complete by 20:05 UTC, 49,110 products tagged so far).

Walkthrough: 18 passed, 0 missed (the six top deals checks among them).

Screenshots `docs/ops/loop4/top-deals-desktop.png` (1280 × 3542) and `top-deals-phone.png` (390). Document
scroll width at 390 px: 430 on `/top-deals` (miss), 390 on the label empty state.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The phone page scrolls sideways (430 px) | The stat tiles keep five columns at 390 px: the `.tiles:has(.tile--lead)` rule outranks the phone rule for `.tiles--panel` | The phone block names both selectors | integrator (one line in `public/static/app.css`) |
| 2 | The freshness line prints the raw stamp `2026-09-30T20:05:35.228Z` | The page escaped `taggedAt` as stored | `utcText`: `2026-09-30 20:05 UTC` | integrator (in `src/ui/pages/top-deals.tsx`) |
| 3 | Twenty promo footnotes as one long column on desktop (polish, not a miss) | Nineteen of twenty New York deals carry a promo code, as the catalogue does | Two columns above 900 px | integrator (`public/static/app.css`) |

## Round 2, 2026-09-30 20:10 to 20:11 UTC

Published 20:10 UTC with the three round 1 fixes. Walkthrough: 18 passed, 0 missed. Scroll width at 390 px:
397 on `/top-deals` (miss), 390 on the label empty state.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The phone page is 7 px too wide | The tile figure `$6,838.73` at 34 px does not fit a half-width tile, and a long title word plus the promo marker's negative margin push one ranked row 4 px out | Phone tile figures at 24 px (the lead at 30 px), `overflow-wrap:anywhere` on titles, no negative right margin on the marker | integrator (`public/static/app.css`) |

## Round 3, 2026-09-30 20:12 UTC

Published 20:12 UTC. Walkthrough: 18 passed, 0 missed (`docs/ops/loop4/walkthrough-round-4.txt` holds the
identical round 4 output). Scroll width at 390 px: 390 on `/top-deals` and on the label empty state; 1280 on
the desktop pages, by amount and by percent. Screenshots refreshed. Clean.

## Round 4, 2026-09-30 20:13 UTC

Same deploy, run again: walkthrough 18 passed, 0 missed; 390 and 1280 px; 20 deals on every ranked page.
Clean. Second clean round in a row.

## Loop status

Closed on 2026-09-30 20:13 UTC after two clean rounds in a row (rounds 3 and 4). Times from the commit
log: the ask reached the coding session at 14:15 UTC, the briefs were committed at 15:44 UTC, the backend
went live at 19:43 UTC, the page at 20:06 UTC, the loop closed at 20:13 UTC: 4 h 29 min from the briefs to
the second clean round, 5 h 58 min from the ask. Next: the public snapshot and the CEO review by a second model.

## CEO review round 1, 2026-09-30 20:17 to 20:24 UTC

Second model: GPT (`gpt-6-astra`, reasoning ultra) through the codex CLI, read-only sandbox, working
directory the public snapshot (commit f1e42e3, exported 20:15 UTC), the two screenshots attached, the prompt
`docs/ai-builder/prompts/12-ceo-review-prompt.md`. Verbatim answer: `docs/ops/loop4/ceo-review-1.txt`
(47,701 tokens).

Scores: impact obsessed 4, simplify to scale 3, disciplined 3, speed over comfort 4, extreme ownership 3;
overall 3 stars. Below the bar (4 stars). The reject reason: the prompt trail claimed completeness while
`03-plan.md` and `05-acceptance.md` were still missing from the snapshot, and no clean-checkout reproduction
was demonstrated.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Prompt archive incomplete; originals not distinguished from renderings | Prompts 03 and 05 were committed at 20:16, one minute after the export; the index still said "not yet written" | Index rows 03, 11, 12 filled; the "Cleaned" column explained; the timeline shows every prompt commit precedes its work | integrator |
| 2 | "Fully final price" not evidenced; tax not mentioned | The page said "the price you pay at Groupon checkout" without the cart sample or the guide's tax sentence | The lead says "before any sales tax"; the story and the evidence page cite the day's cart sample (20 of 20 matched), the public comparison (59 of 59) and the guide | integrator |
| 3 | No single release evidence page | The facts sat across the loop record, the run log and the git log, which the snapshot does not carry | `docs/ai-builder/evidence.md`: revision and deployment, timeline, queries with results, acceptance runs, checkout evidence, reproduction check (`snapshot-gates.txt`), open items with owners | integrator |

## Round 5, 2026-09-30 20:29 UTC (after the CEO review's first round)

The page's lead gained "before any sales tax" (Worker version `259ef9c8`, deployed 20:26 UTC). Walkthrough:
18 passed, 0 missed (`docs/ops/loop4/walkthrough-round-5.txt`); 390 and 1280 px; screenshots refreshed.
Clean.

## CEO review round 2, 2026-09-30 20:25 to 20:34 UTC

Same set-up on the fresh snapshot (commit 409293e, one commit). Verbatim answer:
`docs/ops/loop4/ceo-review-2.txt` (51,827 tokens). Scores: impact 4, simplify 3, disciplined 3, speed 4,
ownership 4; overall 3 stars. Below the bar. The reject reason: the public repository is not pushed and the
token rotation is open (the owner's steps), and the reproduction path is unproven.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The price sentence was in the source, not on the served page or the screenshots | The deploy came after the snapshot | Deployed 20:26; round 5 run and screenshots at 20:29; the review kit rebuilt | integrator |
| 2 | The evidence page claimed the snapshot commit names the source revision; it did not | The exporter wrote only a subject line | The exporter writes `Source revision: <sha>` into the commit body and `docs/ops/snapshot-gates.txt` (the gate output for that tree) into the snapshot | integrator (`bin/export-public.ts`) |
| 3 | "Every prompt commit precedes its work" was too strong for 03 and 05 | Both are copies made at 20:16 of earlier texts | The index and the evidence page say exactly what each file is and when its text existed | integrator |
| 4 | No reproduction by another builder | Nobody had tried a clean checkout | A second agent reproduced from a fresh clone of the snapshot (install, local database, gates, `wrangler dev`, the page answering locally); its report is `docs/ai-builder/reproduction.md` with the limits stated (no partner key, no Cloudflare account) | integrator, a fresh agent |
| 5 | Public repository not pushed; `ZAL_AGENT_TOKEN` rotation open | The owner's decisions | Reported to the owner with the push commands; not done by the session | the owner |

## CEO review round 3, 2026-09-30 20:32 to 20:45 UTC

Same set-up on the fresh snapshot (commit 476c84c, one commit, `Source revision` in its message and
`docs/ops/snapshot-gates.txt` inside it). Verbatim answer: `docs/ops/loop4/ceo-review-3.txt` (32,665 tokens).
Scores: impact 4, simplify 3, disciplined 4, speed 4, ownership 4; overall 3 stars. Below the bar; the third
and last round the plan allowed. The reject reason: the public source release is unfinished (the owner's push
and token rotation) and no other builder has reproduced a populated deployment.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | "The 50 biggest cities" on the page reads as population | The picker note's wording | "the 50 cities with the most deals" | integrator (`src/ui/pages/top-deals.tsx`) |
| 2 | The prompt index's opening sentence overstated provenance | Written before 03 and 11 were copies | The sentence names which files were in the repo before use and which are copies | integrator |
| 3 | "543 distinct leaf labels" had no query on the evidence page; "about 35 minutes" for the lanes vs 24 in the timeline | Omission; a rounded guess | The query and its result added; 24 minutes everywhere | integrator |
| 4 | Public source not pushed; token not rotated; no populated reproduction by another builder | The owner's steps and another person's accounts | Reported to the owner as open, with the recommendation to rotate and push on the same day | the owner |

## Round 6, 2026-09-30 20:37 UTC (after the CEO review's third round)

The picker note now says "the 50 cities with the most deals" (Worker version `d08e601b`, deployed 20:36 UTC).
Walkthrough: 18 passed, 0 missed (`docs/ops/loop4/walkthrough-round-6.txt`). Clean.

## Review status

Three rounds run, 3 stars each, the lenses rising from 4, 3, 3, 4, 3 to 4, 3, 4, 4, 4. Not passed. Open for the
owner: the push, the rotation, and whether to ask a colleague for a populated reproduction.

## Open after loop 4

- The category walk of 2026-09-30 was still running when the loop closed (things-to-do complete at
  19:50 UTC; 15 of 38 categories by 20:05 UTC); it completed at 20:23 UTC, 38 of 38, 0 failed, 72,707
  tags; the cron repeats it daily at 00:30 UTC.
- Rotating `ZAL_AGENT_TOKEN` before the public push (open since loop 3).
