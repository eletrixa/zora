<!-- Module: docs/ai-builder/README.md · Tested: n/a -->
# How Zora Agent Lab was built with AI

Zora Agent Lab is four products on the Groupon Partner Storefront API, live at
`https://zorasocial.asajj.cz`. This folder shows two rounds of building it with AI end to end, with
the prompts that built each: the first built the Top deals page from nothing in a day; the second
made Top deals the home page, brought the rest of the site to its quality, and gave the whole site a
second look with a switch on the logo.

## Who it is for

A CEO who wants to show what one builder and a coding agent can ship in a day. A builder who wants
to do the same.

## The ask

[Prompt 01](prompts/01-the-ask.md) asked for four things: a category picker, limited to Things To
Do; a city picker, the top 50 cities; a page listing the top 20 Groupon deals in the chosen city
and category, sortable by the amount saved and by the percent saved; and, for the price, only the
original price and the fully final price after the discount.

## What it does

`/top-deals`: a category picker (Groupon's 38 top categories, tagged by a daily walk of the API
with the `category1` filter, things-to-do first, at 00:30 UTC), a second picker with the leaf
labels inside the chosen category, a city picker with the 50 cities that hold the most listable
products (refreshed daily at 00:30 UTC), the 20 deals with the largest discount in the chosen city
and category, sortable by amount saved and by percent saved. Each row shows the original price
struck through and the price the shopper pays: the retail price the Partner API quotes, which is what
Groupon's cart charges (on 2026-09-30 the lab's daily sample created 20 real carts and all 20 quoted the
catalogue's retail price; 59 of 59 public listing pages read that day showed the same price; see
`/price-truth`). A promo code, where one exists, lowers it only if the shopper types it at checkout, so it
is a footnote sentence, never a column and never the price; sales tax, where a state charges it, appears
on Groupon's final page (the API guide's "Using the cart response" section: "grandTotal in totals
excludes tax and any promo code. The final amount is shown on Groupon's checkout page."). Fully final,
here, means the retail price before any sales tax, with a promo code typed in separately at checkout:
that is what this showcase means by the phrase, and what it does not claim. The JSON twin is
`/data/top-deals.json`. The page is public and tells crawlers to stay out.

Catalogue on 2026-09-30 at 20:10 UTC (from the D1 database behind the page): 55,822 listable products;
153,949 sellable options on them; 149,453 of those have an original price above the retail price;
543 distinct leaf labels. The first category walk tagged 8,803 listable products as Things To Do. Top
cities by listable products (`top_cities`, refreshed 19:44 UTC): New York, NY 1,599; Los Angeles, CA
1,150; Houston, TX 1,131; Las Vegas, NV 1,029; Miami, FL 889; Chicago, IL 809; rank 50 has 172.

## Where it lives

`https://zorasocial.asajj.cz/top-deals`. In the repo: `src/top-deals/`, `src/sync/category.ts`,
`src/ui/pages/top-deals.tsx`, `migrations/0009_top_deals.sql`. The JSON twin is
`/data/top-deals.json`. The release evidence (which revision is deployed, the timestamped queries
behind every number, the timeline, the acceptance runs, the open items with owners) is
[`evidence.md`](evidence.md).

## How success is measured

The acceptance list in `docs/ops/loop4.md`, checked by `bin/walkthrough`: 18 checks passed, 0 missed,
in rounds 3 and 4 (two clean rounds in a row, 2026-09-30 20:12 and 20:13 UTC; rounds 1 and 2 each
found one phone-width miss, fixed the same hour). Then a CEO-style review by a second model on the
public snapshot, scored in stars, pass at 4 of 5 with no lens below 3; the score and the round count
Result after the three rounds the plan allowed (2026-09-30 20:17 to 20:45 UTC): 3 stars in every round;
the lenses moved from 4, 3, 3, 4, 3 (impact, simplify, disciplined, speed, ownership) to 4, 3, 4, 4, 4. The bar
(4 stars) was not reached. What each round asked for and what was done: `docs/ops/loop4.md`, "CEO review
round N"; the verbatim answers: `docs/ops/loop4/ceo-review-1.txt` to `-3.txt`. The blockers the third round
named are outside this repository: the public source is not pushed yet and the exposed token is not rotated
(the owner's steps, listed with their status in `evidence.md`), and no second builder has reproduced a
populated deployment, which needs that builder's own Cloudflare account and partner registration
(`reproduction.md` records what a clean clone proves without them). The reviewer's own line: "I would
demonstrate the product, but would hold the completed AI Builder showcase announcement until its source is
publicly accessible and another builder can reproduce a populated result."

## The second round: one site, two looks

[Prompt 13](prompts/13-the-second-ask.md) asked for five things: a switch between two looks on the
logo, developed through several rounds of design and built in parallel by spawned agents; the finder
unified with Top deals until it reaches the same quality, with one set of filters; Top deals as the
home page; a better Price truth and Scorecard; and a CEO review of the whole site.

Top deals moved to `/`, the home page; `/top-deals` now answers a redirect that keeps the query
string. The finder moved to `/find`, with the same city and category pickers as Top deals and a
`category1` filter that reads the daily category walk. Every page carries the look switch in its
logo lockup: a `POST /theme` call sets the `zal_theme` cookie, and the next page renders in that
look, lab (the original) or Zora pixel (a dark, square second stylesheet,
`public/static/pixel.css`), without a reload once scripts run. Price truth and the Scorecard open
with a one-sentence verdict instead of starting straight into tables.

The design ran as a loop of its own, before any page lane started. A language step wrote the shared
design language (`design/LANGUAGE.md`) and the shared board parts (`design/gen/common.py`) once, so
every page draws from the same header, hero, picker, tiles and section. Five designers then drew the
five pages, each in both looks. Each round, three lenses reviewed every page (a CEO lens, a phone
lens at 390 px, and a design craft lens against the language) and one consistency lens reviewed the
ten desktop boards together; a judge per page turned the critiques into a scored, ranked list of
changes. Three rounds ran. The scores per page and round, out of 5, from `docs/ops/loop5.md`: Top
deals 2, 4, 4; Find a deal 2, 2, 3; Price truth 3, 4, 4; Scorecard 2, 3, 4; Deal 3, 4, 4.

The build was split the same way as round 1, into lane briefs committed before the agent that worked
them was spawned, in two waves this time. Wave A built what every other page needed first: the
lockup with the switch and the shared blocks (lane `ui-components`, one model tier up because every
other page lane builds on it) and this showcase (lane `docs-showcase`). Wave B built on wave A's
blocks: the pixel stylesheet (`ui-pixel`), the finder (`ui-finder`), Price truth
(`ui-price-truth`), the Scorecard (`ui-scorecard`), the deal page (`ui-deal`), and Top deals' own
round 2 pass (`ui-top-deals`). The integrator wrote the routes, the look cookie and the shared
pickers directly, before any lane started.

Success is measured the same way as round 1, against a new acceptance list: `docs/ops/loop5.md`
("What working means"), checked by `bin/walkthrough` at 1280 and 390 px in both looks, every page
showing today's numbers or saying when they arrive. The loop ends after two clean rounds in a row:
rounds 6 and 7, closed 2026-10-01 03:01 UTC, seven rounds in all, misses per round 21, 12, 9, 3, 2, 0
and 0 (`docs/ops/loop5.md`, "Loop status"). Then a CEO-style review by a second model, this time over
the whole site (`prompts/16-ceo-review-site.md`), pass at 4 of 5 stars with no lens below 3, looped up
to 3 rounds. Each round reviewed a fresh public snapshot of the release the previous round's findings
were fixed into. Lens scores in the order impact, simplify, disciplined, speed, ownership:

| Review round | When (2026-10-01, UTC) | Stars | Lenses | Findings |
|---|---|---|---|---|
| 1 | 03:04 to 03:08 | 3 | 4, 3, 3, 4, 3 | 14 |
| 2 | 03:49 to 03:54 | 3 | 3, 3, 3, 4, 3 | 16 |
| 3 | 04:19 to 04:26 | 3 | 3, 3, 3, 4, 3 | 17 |

The bar was not reached. Three rounds ran, the most the plan allowed, and each scored 3 stars. Round 1
rejected Price truth for stating sync history computed from the clock; round 2 for drawing missing gap
bands as measured zeros; round 3 for the broken catalogue refresh: the delta sync crashed on D1's limit
of 100 bound values, and both dashboards described the crash as a late run. The fixes for that crash
were briefed to their lanes but not in the release the third round read. The reviewer's own last
sentence: "I would show it as a promising lab demo, but withhold the completed AI Builder showcase until
catalogue freshness is trustworthy and the public, reproducible handover is finished." Each finding,
its fix and its owner: `docs/ops/loop5.md`, "CEO review round N"; the verbatim answers:
`docs/ops/loop5/ceo-review-1.txt` to `-3.txt`; what is open and whose it is: `docs/ops/loop5.md`,
"Status". The release page for the deploy, the source revision and every open item is `evidence.md`.

How long this round took, from the commit log. The second ask was given between 20:45 UTC (loop 4's
last review ended) and 20:53 UTC on 2026-09-30, when it was committed (`24bf8c1`). From that commit:
to the lane briefs (`e27fcbe`, 21:10 UTC), 17 minutes; to the unified site in two looks going live
(round 1's publish, 2026-10-01 00:54 UTC, Worker version `5fdf3cc8`), 4 hours 1 minute; to the second
clean round (03:01 UTC), 6 hours 8 minutes; to the close of the review loop (round 3's answer
committed, `5d21080`, 04:26 UTC), 7 hours 33 minutes.

## How long

4 hours 29 minutes from the brief commit (15:44 UTC) to the second clean round (20:13 UTC), and
5 hours 58 minutes from the moment the ask was pasted into the coding session (14:15 UTC) to that
round; the page was live at 20:06 UTC. Timestamps from `git log` and `docs/ops/loop4.md`. Inside that:
24 minutes for the five parallel lanes (the Workflow's own duration), 13 minutes for the two page lanes, and the rest the
integrator's own work, the design passes and waiting for the builder's answers.

## What it cost

The Claude Max subscription (Claude Code and Claude Design), no per-run bill for this feature.
Cloudflare Workers Paid, $5 a month, the hosting under everything in the lab. Two earlier one-off
list-price runs on this lab, unrelated to this feature: $0.12 for logo drafts and $0.16 for an
agent experiment. The second model's CEO-style review of this feature runs on a ChatGPT
subscription, also no per-run bill.

## The loop

Plan, contracts and fakes first. One brief file per lane, committed to the repo before the agent
that works it is spawned. Agents work in their own worktrees, each with three gates:
`bun run typecheck`, `bun test`, `bun bin/lane-check.ts <lane>`. Merge, publish,
`bin/walkthrough` (the acceptance script). Fix every miss through the lane that owns the file, then
repeat, until two clean rounds in a row. Then a CEO-style review by a second model, scored in
stars, looped until 4 of 5. Model rule: the cheapest model with at least 90% confidence per lane
(haiku, sonnet or opus), one tier up after two failed gates.

## What you need to do the same

Claude Code on a Max plan. Claude Design. Bun and wrangler 4. A Cloudflare account on Workers Paid.
A partner registration through `bin/register`, one call, never twice. The four Worker secrets by
name: `GROUPON_PARTNER_API_KEY`, `ZAL_AGENT_TOKEN`, `ZAL_INGEST_TOKEN`, `ZAL_ADMIN_TOKEN`. One
worktree per lane, made with `bin/lane-worktrees`. An acceptance script like `bin/walkthrough`. The
habit of writing the brief as a file before an agent sees it.

## Prompts, in order

See [`prompts/README.md`](prompts/README.md) for the full list, in order, with when each one was
given and where it lives.

## Honesty notes

The prompts are published without names and with the grammar tidied, kept to the same length and
substance as what was actually said. Every number on the design canvas was sample data, tagged as
such on the canvas itself. Every number in this file carries its source next to it. Two spots where
the integrator fixed a lane's file directly instead of sending the miss back to the lane are named in
`docs/ops/loop4.md` (a one-line stylesheet rule and a time format), for speed; the loop rule says the
owning lane fixes its misses. The category walk of the first day was still running when the loop
closed (it completed ten minutes later, 38 of 38 categories, none failed); the page showed Things To Do,
the category the ask named, from its first minute.
