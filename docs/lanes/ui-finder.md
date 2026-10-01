<!-- Module: docs/lanes/ui-finder.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 (loop 5, wave B), model sonnet -->
# Lane ui-finder, loop 5: Find a deal at the quality of Top deals

**You build:** `src/ui/pages/finder.tsx`, the finder page at `/find`: a pure renderer from `FinderPageProps` to a full HTML document, cut from the boards, built from the shared blocks. It never reads the database or the request.
**Keep these exports:** `renderFinder: PageRenderer<FinderPageProps>` (`src/ui/routes.ts` imports it by name). Add `finderHref(query, patch)`.
**Read first:** `design/project/Finder.dc.html` and `FinderPhone.dc.html` (the structure, wording and order; `FinderPixel` and `FinderPixelPhone` are the same page in the other look, which the stylesheets carry), `docs/ops/loop5/design/r3-finder.md` (what the last critique settled), `design/LANGUAGE.md`, `src/ui/components/README.md` (the contract: every block and class you may use; nothing else), `src/contracts/pages.ts` (`FinderPageProps`, now with `cities` and `categories`), `src/contracts/ports.ts` (`SearchQuery` with `category1`, `DealCard`, `PromoNote`), `src/contracts/reports.ts` (`TopCity`, `TopCategory`), `src/ui/pages/top-deals.tsx` (`categoryName`, `placeText`, the precedent for the sentence picker and the empty cases; import `categoryName` and `placeText` from it), `src/ui/routes.ts` (`queryOf`: the form field names), `test/ui/pages/top-deals.test.tsx` (the test style), `docs/ops/loop5.md` "What working means", `AGENTS.md`.
**Test with:** literal props; string assertions on the HTML.

## Facts from wave 0

The route is `GET /find`. The form fields the route reads: `q` (the words), `place` (`City, ST`, the same value as on Top deals; empty means anywhere), `category` (a category1 slug such as `things-to-do`; empty means any category), `maxPrice` (whole dollars; empty means any price). `props.cities` and `props.categories` are the same lists Top deals offers (the 50 cities with the most listable products; the tagged categories, things-to-do first), empty before the first refresh or walk. `props.query` carries what was asked (`text`, `city`, `state`, `category1`, `maxPriceMinor`). The look switch, the nav and the fonts are the shell's; you render nothing for them.

## Behaviour

1. **Document**: `shell({ title: "Find a deal", active: "finder", body })`. Body in order: the hero (the eyebrow, h1 and lead as the board words them; the finder is product 3, the agent shopping tool, for people); the picker card; the results section; the foot line.
2. **The picker card**: `pickerCard` with `action="/find"`, the sentence "Find [what] in [City, ST | anywhere] for [Category | anything] under [$ | any price]" built from `sentenceInput` for `q` (placeholder from the board, such as "massage, oil change, bowling") and three `sentenceSelect`s: `place` (first option `value=""` "anywhere", then `placeText(city, state)` per `props.cities`), `category` (first option `value=""` "anything", then `props.categories` as `categoryName(slug)`), `maxPrice` (first option `value=""` "any price", then 25, 50, 100, 200, 500 as "$25" and so on; the asked `maxPriceMinor / 100` selected when it is one of them, else prepended as its own selected option). An asked place or category outside its list is prepended as its own selected option, so the address and the selects never disagree. The submit button reads "Search". Under the sentence, the note the board has (the counts of the chosen city and category, from `props.cities` and `props.categories`, left out when unknown).
3. **`finderHref(query, patch = {})`**: `/find?q=…&place=City%2C+ST&category=…&maxPrice=…` through `URLSearchParams`, a field left out when empty, the patch applied over the query (`patch.place: ""` drops the place).
4. **The results section**, by case:
   - `listableDeals === 0`: `emptyState` with the existing sentence "No deals are loaded yet. The full catalogue load runs on registration and again every Monday 05:00 UTC, and a delta sync runs every 3 hours."
   - `searched` and no cards: one sentence with next steps as links, hand-built `<div class="empty">`: `No deals found for "<q>"<in City, ST><for Category><under $X>.` followed by the steps that apply: "Try anywhere." (`finderHref` without the place, when a place was asked), "Try any category.", "Try any price.", and, when the words are more than one, the plain sentence "Try fewer words."
   - cards: `resultsHead` with the heading (`<N> deals for "<q>"` plus ` in City, ST`, ` for <Category>`, ` under $X` as asked; or `Today's picks: <theme>` when nothing was searched) and the aside the board has (the order note: by relevance, the price shown is the price you pay); the tiles (`statTiles(…, { panel: true, lead: true })`) computed from the cards only: the cheapest (`min payMinor`, hint the deal's title), the biggest saving (`max listPriceMinor - payMinor`, hint the title; left out when no card saves anything), promo codes (`k of N`, hint "footnotes, typed at Groupon checkout"); then `dealGrid(cards)` (the cards numbered from 1, each with its saving line and, when it carries a promo, the footnote marker); then `footnotes` with one `promo.instruction` per card that carries a promo, keyed by the card's number; nothing when none does.
5. **Foot line**: `pageFoot` with the freshness sentence the board has (prices refresh every 3 hours, the next delta sync at `nextDeltaText(now)`; `now` is not in the props, so say "every 3 hours" without the next time, or add `now` to the props through `requests/ui-finder.md` and keep building).
6. The empty sentence starts with the words "No deals found" (the acceptance script and the app tests read them). The form keeps `autocomplete="off"` and `data-1p-ignore` (the shared `pickerCard` and `sentenceInput` render them). Every value from the props goes through `esc`. Money only through `formatMoney`. The promo price appears only inside a footnote sentence. Plain words. Never the words "no data". No `Date.now()`.

## Tests you must have

`test/ui/pages/finder.test.tsx`, rewritten around a `baseProps` with two cities (New York NY 1,603; Chicago IL 809), two categories (things-to-do 9,812; beauty-and-spas 14,310) and a card factory (a massage in Chicago 9000/4900 with promo SAVE20 at 3920; an oil change 8999/4499 without promo):
- shows the sentence picker with "anywhere", "anything" and "any price" first, the chosen place, category and price selected, and a Search button
- offers the same cities and categories as the props, as `City, ST` values and category1 slugs with their names
- keeps an asked place, category or price outside the lists as the selected option
- `finderHref` carries q, place, category and maxPrice, leaves out an empty field and applies a patch
- opens with "Today's picks: <theme>" and the cards when nothing was searched
- heads the results with the count, the words, the place, the category and the price asked
- computes the tiles from the cards (cheapest, biggest saving, promo codes)
- numbers the cards, marks the promo card with a footnote and puts the promo sentence only in the footnotes
- renders no footnotes when no card carries a promo
- says no deals are loaded yet, with the schedule, on an empty catalogue, and does not say "No deals found"
- says no deals were found with the next steps as links (anywhere, any category, any price) and "fewer words" only for more than one word
- escapes the words, a title and a city that carry HTML
- marks the Find a deal nav link current
- never says "no data"

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-finder`, on branch `lane/ui-finder`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-finder` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-finder.md` (what, why, the exact change) and you build against what exists. A block or class the README does not list is not yours to add: build the part inside your page file as a local function and write it into `requests/ui-finder.md` for the components lane. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-finder
```

Your changelog lines go in `changes/ui-finder.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-finder.md`: `| 2026-09-30 hh:mm | what you built | ui-finder | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-finder: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.

## Round 2, loop 5 fixes

From the round 1 check of 2026-10-01 01:00 UTC (`docs/ops/loop5.md`, Round 1). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The "What" placeholder is clipped.** Where: `/find`, lab look, 1280 ("massage, oil chan") and 390 ("massage, oil change, b"). Expected: a placeholder that fits the field, as `Finder.png` (one or two words). See: `docs/ops/loop5/find-lab-1280.png`, `find-lab-390.png`.
2. **Three tiles and no card highlights.** Where: `/find`, both looks, both widths: tiles Cheapest (lead), Biggest saving, Promo codes; every card has the same coral save pill; the results head has no refresh time. Expected: `Finder.png`: four tiles, Biggest saving (lead), Typical saving, Cheapest, Promo codes; the card with the biggest saving carries the dark "Biggest saving · You save …" pill and the cheapest the "Cheapest · You save …" pill; "Refreshes every 3 hours" at the right of the results head. See: `docs/ops/loop5/find-lab-1280.png`.

## Review round 3, loop 5 fixes

From the CEO review round 3 of 2026-10-01 04:19 to 04:26 UTC (`docs/ops/loop5.md`, CEO review round 3; the answer verbatim in `docs/ops/loop5/ceo-review-3.txt`, the pages as reviewed in the public snapshot's `review/`, the same nine screenshots now in `docs/ops/loop5/`). 3 stars again; the reject reason: "The product promises price confidence while its catalogue refresh is broken and its monitoring misdescribes the failure." Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green (23 passed, 0 missed at 04:29 UTC, `docs/ops/loop5/walkthrough-review-3.txt`); a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The picker note says the same sentence as Top deals while the finder lists every category.** Where: `src/ui/pages/finder.tsx`, the note "The lists offer the 50 cities with the most deals and Groupon's top categories."; the finder's list holds all 32 categories of `/data/pickers.json`, Top deals only those with deals in its city (9 in New York, NY). The reviewer: "Top deals has nine city-scoped categories in the capture; Finder has 32 global categories. That distinction can be valid, but it is unexplained". Done looks like: the note says the finder's rule with the count: "The lists offer the 50 cities with the most deals and all 32 of Groupon's top categories; a category with no deal in the chosen city answers that it has none." (counts from the pickers); a search with a category that has no deal in the chosen city answers the empty sentence with a next step (hold it with a test). The walkthrough on main checks that the finder offers every pickers city and category and keeps passing.
