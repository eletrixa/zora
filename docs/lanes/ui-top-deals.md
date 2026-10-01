<!-- Module: docs/lanes/ui-top-deals.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 19:48 UTC, model sonnet -->
# Lane ui-top-deals

**You build:** `src/ui/pages/top-deals.tsx`, the Top deals page: a pure renderer from `TopDealsPageProps` to a full HTML document, cut from the design boards. It never reads the database or the request.
**Keep these exports:** `renderTopDeals: PageRenderer<TopDealsPageProps>` (the stub is there; `src/ui/routes.ts` imports it by name). Add `TOP_N`, `WALK_15:43_TEXT`, `placeText`, `topDealsHref`.
**Read first:** `design/project/TopDeals.dc.html` and `design/project/TopDealsPhone.dc.html` (the design: match its structure, wording and order; the stylesheet already carries its look), `src/contracts/pages.ts` (`TopDealsPageProps`), `src/contracts/reports.ts` (the top deals section), `src/contracts/ports.ts` (`PromoNote`), `src/ui/components/blocks.ts` (`sentenceSelect`, `statTiles` with `{ panel, lead }`, `podiumCard`, `savingBar`, `sortToggle`, `button`, `emptyState`; the ui-components lane builds the first four in parallel with you: build against the signatures in `docs/lanes/ui-components-top-deals.md` round 2, and if a name is missing in your worktree when you start, write the call anyway and keep the test file waiting on it; the integrator merges the components first), `src/ui/components/shell.ts`, `src/ui/components/README.md` (the `.picker-card`, `.picker-sentence`, `.sentence-word`, `.picker-note`, `.tiles--panel`, `.podium`, `.rank-list`, `.rank-head`, `.rank-row`, `.rank-no`, `.rank-deal`, `.rank-pay`, `.rank-save`, `.section-title--rule`, `.sort-wrap`, `.fn`, `.footnotes`, `.page-foot`, `.freshness` classes), `src/ui/pages/price-truth.tsx` (`largestGapsTable`: the precedent for a hand-built table with links; `nextDeltaText`), `src/lib/money.ts`, `src/lib/html.ts`, `test/ui/pages/price-truth.test.tsx` (the test style).
**Test with:** literal props; string assertions on the HTML.

## Behaviour

1. **Constants.** `TOP_N = 20`. `WALK_TIME_TEXT = "00:30 UTC"` (the category walk and the city refresh run daily at 00:30 UTC; keep in step with `src/cron.ts`). The lead: "The 20 Groupon deals that save the most in one city and one category, by amount or by percent. Saving means the original price minus the price you pay at Groupon checkout. A promo code, where one exists, is a footnote." The two sorts: `amount` "By amount saved", `percent` "By percent saved". `categoryName(slug)` turns a category1 slug into its name with a map for the 38 known slugs ("things-to-do" is "Things To Do", "beauty-and-spas" is "Beauty & Spas", "food-and-drink" is "Food & Drink", "health-and-fitness" is "Health & Fitness", "auto-and-home-improvement" is "Auto & Home Improvement", "baby-kids-and-toys" is "Baby, Kids & Toys", "mens-clothing-shoes-and-accessories" is "Men's Clothing, Shoes & Accessories", "womens-clothing-shoes-and-accessories" is "Women's Clothing, Shoes & Accessories", "v1-personalized-items" is "Personalized Items"; the rest is Title Case with "and" as "&").
2. **Addresses.** `placeText(city, state)` is `"City, ST"`. `topDealsHref(query, patch = {})` builds `/top-deals?category=<category1>&label=<label>&place=City%2C+ST&sort=<sort>` with `URLSearchParams` (label and category left out when absent), the patch applied over the query. The route reads exactly these four names.
3. **Document**, `shell({ title: "Top deals", active: "top-deals", body })`, cut from `design/project/TopDeals.dc.html` (desktop) and `TopDealsPhone.dc.html` (phone). Body in order: the hero (`<p class="eyebrow">Product 4 · an AI Builder showcase</p>`, `<h1>Top deals</h1>`, the lead as `<p class="lead">`); then by case:
   - `report.cities` empty (nothing loaded): `emptyState("No deals are loaded yet. The full catalogue load runs every Monday 05:00 UTC and a delta sync every 3 hours; the city list follows at 00:30 UTC.")`, then the footer line.
   - `report.query` null or `report.categories` empty (no tags yet): `emptyState("Categories appear after the first category walk, tonight at 00:30 UTC.")`, then the footer line.
   - otherwise: the picker card, the results section, the footer line.
4. **Picker card**: `<form class="picker-card" method="get" action="/top-deals" autocomplete="off">` with `<div class="picker-sentence">`: `<span class="sentence-word">Top 20 deals in</span>`, `sentenceSelect` `place` (label "City"; options `placeText(city, state)` as `City, ST`), `<span class="sentence-word">for</span>`, `sentenceSelect` `category` (label "Category"; options from `report.categories` as names), `sentenceSelect` `label` (label "Within it"; first option `value=""` "any label", then `report.labels`), a hidden `sort` input carrying `query.sort`, the `button({ label: "Show", type: "submit" })`. When the asked category, label or city is not in its list, it is prepended as its own selected option so the URL and the select never disagree. Under the sentence a `<p class="picker-note">`: "<City, ST> holds <n> listable deals, <m> of them in <Category>. The lists offer the <cities.length> biggest cities and Groupon's top categories." (`n` from `report.cities`, `m` from `report.categories`; leave a part out when its number is unknown; numbers through `toLocaleString("en-US")`).
5. **Tiles** (`tilesOf(rows)`; rendered only when rows exist, with `statTiles(tiles, { panel: true, lead: true })`): "Biggest saving" = the largest `discountMinor` formatted, hint the deal's title; "Typical saving" = the median `discountShare` as a whole percent, hint "median of the top N"; "Saved across the top N" = the sum of `discountMinor`, hint "one of each, at the price you pay"; "Promo codes" = "<k> of <N>", hint "footnotes, typed at Groupon checkout". Desktop: the tiles sit between the picker and the results. Phone order (the same markup, CSS does the rest): the tiles come after the podium, so put them inside the results section after the podium and before the ranked rows; on desktop that is also acceptable, so do exactly that on both.
6. **Results section**: `<section class="section">` with `.results-head` holding `<h2 class="section-title section-title--rule">` and `<div class="sort-wrap"><span>Sort</span>${sortToggle(...)}</div>` (`hrefFor: (key) => topDealsHref(query, { sort: key })`, current `query.sort`). Heading text: `what` is the label with the category name in parentheses when a label is chosen, else the category name; `where` is `placeText`; `n = rows.length`; n ≥ 20: `Top 20 in <where>: <what>`; 0 < n < 20: `All <n> discounted deal(s) in <where>: <what>`; n = 0: `<what> in <where>`.
   With rows: the podium `<div class="podium">` of `podiumCard` for ranks 1 to 3 (rank 1 `winner: true`; `promoRank` set when the row has a promo; `sharePct = discountShare * 100`), then the tiles, then, when there are more than three rows, `<div class="rank-list">` with `<h3>Ranks 4 to N</h3>`, the `.rank-head` (`#`, `Deal`, `Original`, `You pay`, `You save`, `Saved`) and one `<div class="rank-row" data-rank="N">` per row: `<span class="rank-no">N</span>`, `<span class="rank-deal"><a href="/deals/<productId>">title</a><sup class="fn"><a href="#promo-N">promo</a></sup>?<span class="table-option">optionTitle</span></span>`, `<s data-label="Original">$…</s>`, `<span class="rank-pay" data-label="You pay">$…</span>`, `<span class="rank-save" data-label="You save">$…</span>`, `<span data-label="Saved">${savingBar(sharePct)}</span>`. Money only through `formatMoney(minor, currency, precision)`; percent as `(discountShare * 100).toFixed(1) + " %"`. Nothing else that looks like a price appears in a row or a card: the promo price lives only in the footnote.
   Footnotes: when any row has a promo, `<h3>Promo codes</h3><ol class="footnotes">` with `<li id="promo-<rank>" value="<rank>"><promo.instruction></li>` per such row; nothing when none.
   Without rows, one sentence with a next step, hand-built `<div class="empty">`: with a label, `No discounted deals in <where> for <label>. <a href="<topDealsHref(query, { label: undefined })>">Try the whole of <category name>.</a>`; without a label, `No discounted deals in <where> for <category name>. <a href="<topDealsHref to the first other city of report.cities>">Try <other place>.</a>` (no link when there is no other city).
7. **Footer line**: `<div class="page-foot"><p class="freshness">Category tags and the city list refresh daily at 00:30 UTC (last walk <taggedAt> | first walk pending). Prices refresh every 3 hours; the next delta sync runs at <nextDeltaText(now)>.</p></div>`.
8. Every value from the props goes through `esc`. Plain words. Never the words "no data". The page is a pure function: no `Date.now()`, no database.

## Tests you must have

`test/ui/pages/top-deals.test.tsx`, with a `row()` factory and a `REPORT` fixture (categories things-to-do 9,812 and beauty-and-spas 14,310; labels Escape Games 652 and Museums & Attractions 471; cities New York NY 1,603 and Los Angeles CA 1,152; four rows: a helicopter tour 34900/19900 without promo, an escape room 14000/7900 with promo `{ priceMinor: 6320, priceText: "$63.20", code: "ESCAPE20", endsAt: null, instruction: "Type code ESCAPE20 at Groupon checkout to pay $63.20. Without it you pay $79.00." }`, a comedy night 6000/2400 without promo, a kayak rental 9000/5500 without promo; `taggedAt` set; `query` things-to-do, New York NY, amount):

- `topDealsHref` carries category, label, place and sort, and leaves out an absent label
- `categoryName` names the known slugs and title-cases an unknown one
- shows the sentence picker with the chosen city, category and label selected, and a Show button
- offers only the labels of the chosen category, with "any label" first
- keeps the sort in a hidden field so a new pick keeps the current sort
- names the city's deal count and the category's count in the picker note
- draws ranks 1 to 3 as podium cards with rank 1 as the winner, and rank 4 on as ranked rows
- shows the original struck and the price to pay, and nothing else as a price in a row or card (`$63.20` appears only inside the footnote)
- shows the saving in money and in percent, with the bar, on every ranked row
- computes the four tiles from the rows (biggest saving, typical saving, saved across the top N, promo codes)
- marks the amount sort current by default and links the percent sort with the same pickers
- marks the percent sort current when asked
- puts each promo sentence in the footnotes with the row's rank, marked on the card or row; a row without a promo has no marker
- renders no footnotes when no row carries a promo
- says Top 20 when twenty rows came back, All N when fewer
- names the label and the category in the heading when a label is chosen
- labels every price cell for the phone layout
- says no deals are loaded yet, with the schedule, when there is no city
- says categories appear after the first category walk, with its time, when nothing is tagged
- suggests the whole category, linked, when a label has no discounted deal
- suggests the next city, linked, when the whole category has no discounted deal here
- keeps an asked city outside the top 50 as the selected option
- names when the tags refresh and when the next delta sync runs (and "first walk pending" when `taggedAt` is null)
- escapes a deal title, a label and a city that carry HTML
- marks the Top deals nav link current
- never says "no data"

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-top-deals`, on branch `lane/ui-top-deals`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-top-deals` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-top-deals.md` (what, why, the exact change) and you build against what exists. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-top-deals
```

Your changelog lines go in `changes/ui-top-deals.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-top-deals.md`: `| 2026-09-30 hh:mm | what you built | ui-top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-top-deals: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.

## Round 2, loop 5 (2026-09-30, wave B, model sonnet)

Top deals is the home page now: `GET /` renders it, `/top-deals` answers a 301, `topDealsHref` builds `/?…` and the picker form posts to `/` (the integrator changed both in wave 0; keep them). The design went through three more rounds: read `design/project/TopDeals.dc.html`, `TopDealsPhone.dc.html` (the lab look) and `docs/ops/loop5/design/r1-top_deals.md`, `r2-top_deals.md`, `r3-top_deals.md` (what each round asked for and what the designer did), then `design/LANGUAGE.md` and the rewritten `src/ui/components/README.md` (the contract: every block and class you may use; nothing else; the `Pixel` boards are the same page in the other look, carried by the stylesheets).

Re-cut the page from the round-3 boards: the hero through the shared `hero` block (the eyebrow stays "Product 4 · an AI Builder showcase"), the picker through `pickerCard` (the same sentence, `sentenceSelect`s and hidden sort), the results head through `resultsHead`, the ranked rows through `rankList` and `rankRow` where the README offers them, the footnotes through `footnotes`, the foot line through `pageFoot`; keep `podiumCard`, `savingBar` and `statTiles` as they are. Every behaviour of round 1 holds (the empty cases with a time or a next step, the promo only in a footnote, the labelled price cells, the counts in the note, "the 50 cities with the most deals"). What the round-3 judge settled and the designer accepted is what you build; what the designer declined stays out. Update every test the change touches; the test list of round 1 stays complete. A block or class the README does not list is not yours to add: build the part inside your page file as a local function and write it into `requests/ui-top-deals.md` for the components lane.

In loop 5 commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (it replaces the line named above).

## Round 2, loop 5 fixes

From the round 1 check of 2026-10-01 01:00 UTC (`docs/ops/loop5.md`, Round 1). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The results sit inside a box, with the ranks in a second box inside it.** Where: `/`, both looks, both widths: the title "Top 20 in New York, NY: Things To Do", the sort, the podium and the ranks are wrapped in one bordered `section`, the ranks in a `box` inside it; at 390 the double frame narrows the podium cards and the rank rows. Expected: `TopDeals.png` and `TopDealsPhone.png`: the results head, the sort and the podium flush on the page, only the ranks list (and its promo codes) in one box. See: `docs/ops/loop5/home-lab-1280.png`, `home-lab-390.png`.

## Round 4, loop 5 fixes

From the round 3 check of 2026-10-01 02:14 UTC (`docs/ops/loop5.md`, Round 3). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **"Typical saving" drops its decimal.** Where: `/`, both looks, both widths: the tile reads "42 %" while every other percent on the page has one decimal ("60.0 %", "24.7 %"). Expected: `TopDeals.png` and `TopDealsPixel.png`: "42.4 %"; the tile is built with `Math.round(median * 100)`. See: `docs/ops/loop5/home-lab-1280.png`, `docs/ops/loop5/home-pixel-1280.png`.

## Review round 3, loop 5 fixes

From the CEO review round 3 of 2026-10-01 04:19 to 04:26 UTC (`docs/ops/loop5.md`, CEO review round 3; the answer verbatim in `docs/ops/loop5/ceo-review-3.txt`, the pages as reviewed in the public snapshot's `review/`, the same nine screenshots now in `docs/ops/loop5/`). 3 stars again; the reject reason: "The product promises price confidence while its catalogue refresh is broken and its monitoring misdescribes the failure." Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green (23 passed, 0 missed at 04:29 UTC, `docs/ops/loop5/walkthrough-review-3.txt`); a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The picker note promises "Groupon's top categories" while the list holds only the ones with deals in the city.** Where: `src/ui/pages/top-deals.tsx`, the note "The lists offer the 50 cities with the most deals and Groupon's top categories."; for New York, NY the category list holds 9 (the categories with deals there), while `/data/pickers.json` and the finder hold 32. The reviewer: "The acceptance claim that both pages offer the same categories exceeds its checks. Top deals has nine city-scoped categories in the capture; Finder has 32 global categories. That distinction can be valid, but it is unexplained". Done looks like: the note says the rule with the counts: "The lists offer the 50 cities with the most deals and the 9 categories with deals in New York, NY." (from `report.cities.length`, `report.categories.length` and the chosen city); a test with two categories in the city. The walkthrough on main checks the sets (same 50 cities, Top deals' categories a subset of the pickers, things-to-do first) and keeps passing.
