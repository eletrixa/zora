<!-- Module: docs/ops/loop5.md · Tested: n/a -->
# Loop 5: one site, two looks (from 2026-09-30)

The owner asked, after the Top deals hand-over (`docs/ai-builder/prompts/13-the-second-ask.md`): build
the second design too, with the switch between the two looks on the logo; make it great through several
rounds of design in Claude Design; develop it in parallel with spawned agents; unify the site so that
Find a deal reaches the quality of Top deals, with unified filters; make Top deals the home page; make
Price truth and the Scorecard better; run the CEO review on the whole site.

Rule as in loops 3 and 4: every page shows today's numbers or says, with a time, when they arrive.
Each round: run `bin/walkthrough`, look at every page at 1280 and 390 px in both looks, fix every miss
through the owning lane, publish. The loop ends after two clean rounds in a row; then the CEO review by
a second model over the whole site, looped until 4 of 5 stars with no lens below 3, at most 3 rounds.

## Phases

| Phase | What | Who | Record |
|---|---|---|---|
| Design | Three rounds of boards for five pages in two looks, critiqued by three lenses per page and one consistency lens, judged per page | Workflow run (opus designers, sonnet critics and judges) on branch `lane/design` | `docs/ops/loop5/design/r<N>-<page>.md`, `design/rounds/r<N>/`, the canvas |
| Wave 0 | Contracts, routes (`/` is Top deals, `/find` is the finder, `/top-deals` redirects, `POST /theme`), the search `category1` filter, the pickers read model, tests, the walkthrough | integrator | this file, `CHANGELOG.md` |
| Lanes | ui-components (the lockup and the switch, the shared blocks, `app.css`), ui-pixel (`pixel.css`), ui-top-deals, ui-finder, ui-price-truth, ui-scorecard, ui-deal, docs-showcase | Workflow run, one worktree per lane | `docs/lanes/<lane>.md` round sections, `changes/<lane>.md` |
| Loop rounds | Publish, walkthrough, screenshots in both looks, misses to the owning lanes, until two clean rounds | integrator agent | `## Round N` below, `docs/ops/loop5/` |
| CEO review | The public snapshot with every page rendered and screenshotted, reviewed by the second model, at most 3 rounds | integrator agent | `## CEO review round N` below, `docs/ops/loop5/ceo-review-N.txt` |

## What working means

| Surface | Working means |
|---|---|
| `/` | Opens with Top deals (20 real deals for Things To Do in the city with the most listable products); everything loop 4 asked of `/top-deals` holds here. `/top-deals` answers a 301 to `/` with the query string kept. |
| `/find` | Opens with today's picks, never empty. The sentence picker offers the same 50 cities as Top deals and every category of `/data/pickers.json`, while Top deals lists only the categories with deals in its chosen city (CEO review round 3); a search with a city and a category returns cards in that city and category; every card shows the original struck, the price to pay and the saving; the promo sentence is a footnote; an empty search answers a sentence with a next step. |
| The switch | Every page carries the look switch in the logo lockup; `POST /theme` with `theme=pixel` sets the `zal_theme` cookie and the next page renders `data-theme="pixel"`; the switch flips the page without a reload when scripts run. |
| `/price-truth`, `/scorecard` | Today's numbers in every section, in the new layout: the hero with the verdict sentence, the verdict banner, the day strips, the sections from the boards. |
| Every page | At 390 px the document scroll width is at or under 390 in both looks; at 1280 px nothing overflows; the nav lists Top deals, Find a deal, Price truth, Scorecard. |

## Design rounds

| Page | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| Top deals | 2 | 4 | 4 |
| Find a deal | 2 | 2 | 3 |
| Price truth | 3 | 4 | 4 |
| Scorecard | 2 | 3 | 4 |
| Deal | 3 | 4 | 4 |

**Round 1.** Judges found two or more structural breaks on every page: parts had drifted from the shared
`common.py` code into page-local copies (Top deals' own footnotes and podium order, Find a deal's one-off
ribbon), the switch and the pickers fell short of a 44 px hit area, a saving figure sometimes outsized the
price to pay, and pages disagreed on the sample clock. Designers folded the drifted parts back into
`common.py` (the switch, the picker, `save_pill`, `footnotes`, `rank_rows`), gave Find a deal the shared
save pill in place of its ribbon, showed Price truth's full eight gap rows on phone, reordered Scorecard's
five sections onto the shared runs strip and tiles row, and fixed Deal's long title h1 and its duplicate
option and checkout button. Consistency scored the whole board set 3.

**Round 2.** With round 1's structural breaks closed, judges caught narrower repeats of the same two
rules: Find a deal's card had no real cover link and its lead tile could outsize a price with no podium to
cap it, and both Price truth and Scorecard still drew a second tiles block inside one section, against
LANGUAGE.md's one tiles row rule. Designers gave `deal_card` a true cover link, capped Find a deal's lead
tile at the card price, replaced both pages' second tiles blocks with a shared figure row or sync card,
fixed the save pill's wrap point, and quieted the non home skyline strip so Top deals keeps the only true
skyline. Find a deal held at 2 because its cover link and lead tile cap were the page's own written rules
not yet built, and consistency scored the set 4.

**Round 3.** Judges found only wording, spacing and value fixes left, with one repeated shared part bug: a
two line save pill turned into a full width slab and knocked a card's price out of line with its row, on
Find a deal, the Top deals podium and Deal's option rows alike. Designers fixed the pill in `common.py` so
it stays a stacked chip, capped Scorecard's lead tile at the verdict word's own size, added a sticky look
switch to the shared header, and closed out the remaining consistency drifts (a stray period on Top deals,
tile hint casing, table padding, footnote wording) across all five pages. Every page reached 4 except Find
a deal, held at 3 by the pill fix alone, and consistency scored the set 4 again.

Rounds 1 and 2 were published to the Top deals canvas as rows R1 and R2. The round 3 publish was refused
("artifact not found"): the design run was resumed from a session signed in to another Claude account, which cannot
open that canvas. All three rounds were then published to a new canvas in that account, round 3 on top, the two
lockup boards first (links in `design/README.md`). The boards themselves are the files in `design/rounds/r1` to `r3`.

## Rounds

## Round 1, 2026-10-01 01:00 UTC

Published 00:54 UTC (Worker version `5fdf3cc8`): gates green (985 tests passed, 0 failed), no migrations to
apply, smoke 11 of 11. Walkthrough: 22 passed, 0 missed, carts skipped (`docs/ops/loop5/walkthrough-round-1.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 475 (miss) |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page is dark with amber, square tiles, Silkscreen titles and the pixel mark. The walkthrough is
clean; the misses are layout and board fidelity.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The deal page at 390 px scrolls sideways in the pixel look (475 px); in the lab look the section note sits beside its heading | The phone rule turns `.results-head` into a column but keeps `flex-wrap:wrap`, and `.results-note{flex-basis:100%}` wraps the note into a second column | Phone block: `.results-head{flex-wrap:nowrap}`, `.results-note{flex-basis:auto}` | ui-components |
| 2 | Top deals rank rows at 390 px are four labelled lines each ("Original:" struck with its label, "You pay:", "You save:", "Saved:") | The phone rule renders every rank cell as its own labelled line | Two lines as `TopDealsPhone`: "You pay $X $orig", then "You save $Y", the bar and the percent | ui-components |
| 3 | The sentence pickers break onto two lines at 1280 px ("within any tag" wraps on Top deals) | A select is as wide as its longest option | Size each select to its chosen value (the board draws one line) | ui-components |
| 4 | Footnote markers say "promo" with no number while the footnotes are numbered | `promoMarker(n)` prints the word only | "promo N" as every board draws it | ui-components (the walkthrough already accepts both, integrator) |
| 5 | No skyline on the pixel home page; every pixel page carries an amber dashed strip | `pixel.css` drew one signature strip for all pages | Home: the 56 px skyline over a 4 px amber rule; other pages: the quiet 24 px band with a 2 px line (LANGUAGE.md section 5) | ui-pixel |
| 6 | The pixel look switch reads "Lab", "Pixel" in the body font, and a stray line runs through it above and below the track | Labels not set in Silkscreen capitals; the divider is drawn taller than the track | Silkscreen capitals, the 2 px divider inside the 32 px track | ui-pixel |
| 7 | Round corners and lab type left in the pixel look: the verdict banner, the eyebrow in Plex Mono, the lead tile's top rule grey | Rules not reskinned | Square banner, Silkscreen eyebrow, amber lead rule (`PriceTruthPixel`) | ui-pixel |
| 8 | Top deals results sit in a boxed section, with the ranks in a second box inside it | The page wraps the results in `section` and the ranks in `box` | The results flush on the page, only the ranks in one box, as the board | ui-top-deals |
| 9 | The finder's "What" placeholder is clipped ("massage, oil chan" at 1280, "massage, oil change, b" at 390) | The placeholder is longer than the field | A placeholder that fits, as the board | ui-finder |
| 10 | Find a deal shows three tiles (Cheapest first) and no card highlights | The page builds its own tile set | Four tiles as the board (Biggest saving lead, Typical saving, Cheapest, Promo codes), the "Biggest saving" and "Cheapest" pills on those cards, "Refreshes every 3 hours" in the results head | ui-finder |
| 11 | Price truth: the hero lead and the banner repeat one sentence; the banner has no 30 day figures | `verdictOf` text used twice | Banner as the board: what disagreed today and in 30 days, with Carts, 30 days and Pages, 30 days | ui-price-truth |
| 12 | Price truth tiles are the promo gap figures, and "$4,851,787.96" breaks over two lines | The page put the promo gap in the tiles row | Tiles as the board (Carts matched, Pages matched, Since a mismatch, Changes today); the promo gap figures as the figure row inside Promo gap | ui-price-truth |
| 13 | Price truth strips: one square with two stacked dates, "Latest day" as a bare heading with loose numbers | The strip and the latest day are not in their cards | The strip card ("Last 30 days: N of M matched", legend, last mismatch sentence) beside the "Latest day" card | ui-price-truth |
| 14 | Price truth prints the raw stamp `2026-09-30T12:21:36.918Z` and counts without separators (5139, 95401, 154038) | Values escaped as stored | `YYYY-MM-DD hh:mm UTC`; counts with thousands separators | ui-price-truth |
| 15 | Price truth lists 50 gaps with the promo price in a "With code" price column | The brief asked for the column; the board puts promo prices only in footnotes | The 8 largest gaps, You pay and Gap, codes and promo prices in the numbered "Promo codes" footnotes | ui-price-truth |
| 16 | Price truth Freshness is horizontal bars and a sentence, with a History table the board does not have | Built from the old page | The 30 day column chart with its peak and the "Next sync" card | ui-price-truth |
| 17 | Scorecard prints raw stamps (`2026-09-30T12:23:45.124Z` in the lead, `2026-10-01T00:01:27.366Z` in the sync table, wrapping) | Values escaped as stored | `YYYY-MM-DD hh:mm UTC` | ui-scorecard |
| 18 | Scorecard misses the board's tiles row and Runs section: the strip floats under the banner, "Latest run" is a second tiles block, the banner states pass rates | Built from the old sections | Banner with the failing step sentence and the 7 and 30 day figures; tiles Steps passed, Days with a run, Slowest p95, Open findings; Runs section with the strip card beside the Latest run card; refresh times in every section head; "Catalogue sync" with the "Next sync" card | ui-scorecard |
| 19 | The deal page has no buy box: no checkout button above the fold, no saving, a short photo strip | The page shows the price beside the photo | "The cheapest option" card beside a full photo: option, price, save pill, promo note, "Get checkout link", "See all N options" | ui-deal |
| 20 | Locations is a raw bulleted list | A plain `<ul>` | Pin rows with name and address, as the board | ui-deal |
| 21 | Deal options repeat the promo sentence in a box under every option and show no saving | Inline `promoNote` per option | "You save" per option, "promo N" markers and one "Promo codes" list, the cheapest marked "In the box above"; four tiles; the eyebrow is City, ST | ui-deal |

Not clean: 1 width miss and 20 visual misses. Shared file change this round: `bin/walkthrough.ts` accepts a
numbered promo marker, so miss 4's fix keeps the footnote check live.

## Round 2, 2026-10-01 01:32 UTC

Merged the seven fix lanes (ui-components, ui-pixel, ui-top-deals, ui-finder, ui-price-truth, ui-scorecard,
ui-deal) and answered their requests: the deal page's new parts styled in `app.css`, `histogram()` counts with
commas, `hero()` takes a bold lead, `dealGrid` takes a card label, and `bin/walkthrough.ts` accepts the
Scorecard's "Steps, N days" figures. Published 01:26 UTC (Worker version `20f87e7f`): gates green (1,019 tests
passed, 0 failed), smoke 11 of 11. Walkthrough: 22 passed, 0 missed, carts skipped
(`docs/ops/loop5/walkthrough-round-2.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 390 |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page is dark with amber, square corners, Silkscreen and Press Start 2P, the pixel mark and now the
skyline over the amber rule. Round 1's width miss is closed, and so are the Top deals box, the finder tiles
and placeholder, the switch labels, the pill sizing and the raw stamps. The misses left are layout and board
fidelity.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Pixel look: the header strip (the home skyline, the quiet band elsewhere) stops 112 px short of the right edge at 1280 px, and a second grey rule runs under it | `.shell-header::after` has `flex-basis:100%` of the padded header (1168 px); the `-56px` margins move it left but do not widen it; the header keeps its own `border-bottom` under the strip | `flex-basis:calc(100% + 112px)` (0 bleed at 390 as now), no header border under the strip | ui-pixel |
| 2 | The "promo N" marker breaks between the word and its number ("promo" / "5") on Top deals, Price truth and the phone podium, both looks | `.fn a` may wrap | `white-space:nowrap` on `.fn a` | ui-components |
| 3 | A labelled save pill breaks inside its figure: "Biggest saving · You save $351.00 ·" / "63.8 %" (finder 1280), "Cheapest · You save" / "$240.01 · 92.3 %" (finder 390), "· 60.0 %" alone (home 390) | The pill is one run of text | Two runs: the label, then "You save $X · Y %" kept whole, so it stacks as the board's chip | ui-components |
| 4 | Top deals rank rows at 390 px are still four lines: "You pay:" over the figure, "You save:" over the figure | Phone rule `.rank-row>*{display:block}` with the ": " label, and the third column (`auto`) takes the bar's width, so column two is narrow | As `TopDealsPhone`: "You pay $648.00 $1,080.00" on one line, "You save $432.00", the bar and the percent on the next; small muted labels, no colon | ui-components |
| 5 | A day strip with one day prints the same date at both ends ("2026-09-30 ... 2026-09-30") | `dayStrip` always labels the first and the last day | One label when the first and last day are the same | ui-components |
| 6 | No block draws the board's 30 day column chart (Price truth Freshness) | Not built | A `columnChart` block (peak line, columns, "1 Sep" and "30 Sep, so far" axis), styled in both looks | ui-components |
| 7 | Price truth's "Since a mismatch" tile prints "No mismatch yet" at figure size over three lines (its hint cut in pixel); "1 delta syncs so far" | A sentence used as the tile value; plural not chosen | A figure with its unit ("1 day") and a hint ("no mismatch since the first sample on 2026-09-30"); "1 delta sync" | ui-price-truth |
| 8 | Price truth's Latest day cards float their count line between empty bands, and a per-day table sits under each pair of cards | Card layout; the old table kept | As the board: the bold count line ("20 carts sampled") right under the heading, the rows under it; no table under the cards | ui-price-truth |
| 9 | Price truth still lists 50 largest gaps with 50 footnotes; the gap summary sentence sits outside the Options by gap box | Round 1 miss 15 half done | "The 8 largest gaps", 8 footnotes; the summary as the box's note | ui-price-truth |
| 10 | Price truth Freshness draws horizontal day bars, not the column chart; the hero lead counts are not bold | Built on `histogram`; `hero` took plain text | The column chart (miss 6) in the Price changes card, the Next sync card as the board ("Delta sync every 3 hours" over its rows); `hero` lead `{ text, strong: ["20 of 20", "59 of 59"] }` | ui-price-truth |
| 11 | Scorecard Runs contradicts itself: "Days with a run 2 of 30" and "One square per day, the day's last run", but the strip shows 8 squares over 29 and 30 Sep, titled "2 of 8 runs passed" | The strip takes every run, not the day's last | One square per day (the day's last run), "No run" squares for missing days, title and note in days | ui-scorecard |
| 12 | The deal page's photo is a 150 px strip beside a 440 px buy box, a blank area under it; the buy box has no "The cheapest option" heading, its button is not full width; Options has no lead | Photo kept at strip height; buy box parts missing | As `Deal.png`: the photo fills the column to the buy box height, "The cheapest option" heading, the full width button, the Options lead "Ordered by the price you pay; the cheapest is in the box above." | ui-deal |

Not clean: 0 walkthrough misses, 0 width misses, 12 visual misses. Shared file change this round:
`bin/walkthrough.ts` accepts "Steps, N days" as the Scorecard's pass rate.

## Round 3, 2026-10-01 02:14 UTC

Merged the five fix lanes (ui-components, ui-deal, ui-pixel, ui-price-truth, ui-scorecard) and answered their
requests: `test/ui/pages/finder.test.tsx` checks the save pill's two runs (the ui-components merge failed its gates
on that one stale assertion, so it was merged by hand with the test fixed in the merge commit), `.deal-photo` and
`.buy-box .btn` styled in `app.css` and `pixel.css`, and `bin/walkthrough.ts` finds "The 8 largest gaps"
(`/largest gaps/i`). Published 02:11 UTC (Worker version `c7b9ef42`): gates green (1,041 tests passed, 0 failed),
no migrations to apply (the first attempt stopped on a Cloudflare API error, code 7403; the retry passed), smoke
11 of 11. Walkthrough: 22 passed, 0 missed, carts skipped (`docs/ops/loop5/walkthrough-round-3.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 390 |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page matches `TopDealsPixel.png` (dark with amber, square corners, Silkscreen and Press Start 2P, the
pixel mark, the skyline now to the right edge). Round 2's header strip, promo marker, save pill, phone rank rows,
one-date strip, Scorecard runs strip and deal buy box are closed. The misses left are on Price truth and the
Scorecard, plus one shared spacing rule and one figure format.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Price truth's Latest day cards still carry the per-day table, cut at the card's right edge ("Price matched", "Pi", "Shows retai"), which stretches the strip card beside it into a tall empty box | The table kept inside the card (round 2 miss 8 half done) | As the board: the bold count line and the four rows, no table; the strip card as tall as its content | ui-price-truth |
| 2 | Price truth's "Last 30 days" strips draw one square | The strip takes only the sampled days | 30 squares, "No sample" for a day without one, "1 Sep" and "30 Sep" under them (as Scorecard's strip now) | ui-price-truth |
| 3 | Price truth Freshness still draws horizontal day bars | `histogram`, not the new `columnChart` block | `columnChart` with the peak line and the "1 Sep" and "30 Sep, so far" axis | ui-price-truth |
| 4 | Price truth's "Since a mismatch" hint is cut in the pixel look ("no mismatch since the first sample on 2026...") | The hint is longer than the tile's clamp | A short hint as the board ("no mismatch since 30 Sep") | ui-price-truth |
| 5 | A paragraph inside a card keeps the browser's 16 px margins: "20 carts sampled" sits about 60 px under its card title, "In 48 minutes." floats under Next sync, the deal buy box opens loose | No margin rule for `p` in `.box`, and `.box` already spaces its children with `gap` | `.box p{margin:0}` (the gap does the spacing), both looks | ui-components |
| 6 | Scorecard's Runs note lists 28 days one by one ("No run on 2 Sep, 3 Sep, 4 Sep, ...") and says the job did not run on 1 Oct, before today's 04:00 UTC run is due | The note names every empty day; today counts as missed | Ranges ("No run from 2 to 28 Sep"); today's square and sentence say the run is due at 04:00 UTC | ui-scorecard |
| 7 | Scorecard's Failing steps card is one row with the observed text only | Card parts missing | As the board: "1 of 39 steps failed" title, Expected and Observed lines, "The other 38 steps: 37 passed, 1 skipped." | ui-scorecard |
| 8 | Scorecard's banner rates read "91%", the only percent on the site without its space and decimal | `pct()` rounds to a whole number | "91.0 %", as the board's "97.0 %" | ui-scorecard |
| 9 | Top deals' "Typical saving" tile reads "42 %" while every other percent on the page has one decimal ("60.0 %") | `Math.round(median * 100)` | One decimal, as the board's "42.4 %" | ui-top-deals |

Not clean: 0 walkthrough misses, 0 width misses, 9 visual misses. Shared file changes this round:
`bin/walkthrough.ts` accepts "The 8 largest gaps"; `test/ui/pages/finder.test.tsx` checks the save pill's two runs.

## Round 4, 2026-10-01 02:35 UTC

Merged the four fix lanes (ui-components, ui-top-deals, ui-price-truth, ui-scorecard) and answered their one
request: `CheckRow` in `blocks.ts` takes optional `expected` and `observed` and `checkRows()` draws them as the
labelled Expected and Observed lines, so the Scorecard's Failing steps card goes back through `checkRows()`.
Published 02:32 UTC (Worker version `d4a4583b`): gates green (1,047 tests passed, 0 failed), smoke 11 of 11.
Walkthrough: 22 passed, 0 missed, carts skipped (`docs/ops/loop5/walkthrough-round-4.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 390 |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page matches `TopDealsPixel.png` (dark with amber, square corners, Silkscreen and Press Start 2P, the
pixel mark, the skyline over the amber rule). Round 3's card paragraph spacing, the Top deals "42.4 %", the
Price truth 30 square strips, the short "Since a mismatch" hint, the Scorecard run ranges, today's due run, the
Failing steps card and the "91.1 %" rates are closed. The misses left are on Price truth and one Scorecard line.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Price truth still prints a per-day table (Day, Sampled, Price matched, ...) under each strip and Latest day pair, which no board draws; the Latest day titles read "2026-09-30" where the board writes "30 Sep" | The lane kept the table for the walkthrough and the app test, which looked for the ISO day or a table row | Drop both tables; titles "Latest day: 30 Sep". The walkthrough now accepts "Latest day: 30 Sep" and the app test reads the Latest day card (done on main this round) | ui-price-truth |
| 2 | Price truth's "Price changes per day, last 30 days" draws two columns as wide as the card, with "30 Sep" and "1 Oct, so far" under them, both looks | The chart takes only the days that have a count | 30 day slots ending today, a zero column for a day without one, the axis "2 Sep" and "1 Oct, so far", as `PriceTruth.png` | ui-price-truth |
| 3 | Scorecard's failing step reads "Observed: observed HTTP 400 with no products array" and "Expected: guide: a state abbreviation ..." | `splitFailDetail()` keeps the check's own "observed" and "guide:" words after the labels | Drop the leading "observed " and write "guide: X" as "Guide: X", so the lines read as the board ("Observed: HTTP 400 ...") | ui-scorecard |

Not clean: 0 walkthrough misses, 0 width misses, 3 visual misses. Shared file changes this round: `CheckRow`
carries Expected and Observed (`blocks.ts`, `app.css`); `bin/walkthrough.ts` accepts Price truth's
"Latest day: 30 Sep"; `test/app/pages.test.ts` reads the public Latest day card instead of the per-day table.

## Round 5, 2026-10-01 02:44 UTC

Merged the two fix lanes (ui-price-truth, ui-scorecard); neither filed a request. Published 02:43 UTC (Worker
version `21ee44f0`): gates green (1,050 tests passed, 0 failed), smoke 11 of 11. Walkthrough: 22 passed, 0 missed,
carts skipped (`docs/ops/loop5/walkthrough-round-5.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 390 |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page matches `TopDealsPixel.png` (dark with amber, square corners, Silkscreen and Press Start 2P, the
pixel mark, the skyline over the amber rule). Round 4's Price truth per-day tables, the "Latest day: 30 Sep"
titles, the 30 slot column chart ("2 Sep" to "1 Oct, so far") and the Scorecard's clean Expected and Observed
lines are closed. Top deals, Find a deal, Price truth and the deal page now match their boards. The misses left
are two Scorecard lines that still differ from `Scorecard.png`.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The Scorecard's FAIL banner pastes the check's raw detail: "1 of 39 steps failed: guide: a state abbreviation with no state scope answers HTTP 200 with zero products; observed HTTP 400 with no products array", both looks | `verdictOf()` appends `worst.detail` as stored; round 4's fix cleaned only the Failing steps card | One plain sentence as the board ("1 of 39 steps failed: a state code answers HTTP 400 where the guide promises an empty page"), built from the step name and `splitFailDetail()`, with no "guide:" or "observed" words | ui-scorecard |
| 2 | The Scorecard's hero lead is one plain line; the board bolds the verdict counts and says what the probe does | `ageLine()` returns plain text to `hero()` | `hero` lead `{ text, strong: ["fail, 37 passed, 1 failed, 1 skipped"] }` and the second sentence "Every day at 04:00 UTC the probe walks the partner journey on production, as an outside builder would.", as `Scorecard.png` | ui-scorecard |

Not clean: 0 walkthrough misses, 0 width misses, 2 visual misses. No shared file change this round.

## Round 6, 2026-10-01 02:53 UTC

Merged the one fix lane (ui-scorecard); it filed no request. Published 02:52 UTC (Worker version `48c8c1e9`):
gates green (1,053 tests passed, 0 failed), smoke 11 of 11. Walkthrough: 22 passed, 0 missed, carts skipped
(`docs/ops/loop5/walkthrough-round-6.txt`).

Document scroll width, lab look then pixel look:

| Page | Lab 1280 | Lab 390 | Pixel 1280 | Pixel 390 |
|---|---|---|---|---|
| `/` | 1280 | 390 | 1280 | 390 |
| `/find` | 1280 | 390 | 1280 | 390 |
| `/price-truth` | 1280 | 390 | 1280 | 390 |
| `/scorecard` | 1280 | 390 | 1280 | 390 |
| `/deals/<id>` (the first card on `/find`) | 1280 | 390 | 1280 | 390 |

Screenshots in `docs/ops/loop5/`: `home-lab-1280.png`, `find-lab-1280.png`, `price-truth-lab-1280.png`,
`scorecard-lab-1280.png`, `deal-lab-1280.png`, `home-lab-390.png`, `find-lab-390.png`, `home-pixel-1280.png`,
`price-truth-pixel-1280.png`. Compared with the boards in `design/preview/shots/`. The look switch flips: the
pixel home page matches `TopDealsPixel.png` (dark with amber, square corners, Silkscreen and Press Start 2P, the
pixel mark, the skyline over the amber rule). Round 5's two Scorecard misses are closed: the FAIL banner reads one
plain sentence ("1 of 39 steps failed: HTTP 400 with no products array where the guide promises a state
abbreviation with no state scope answers HTTP 200 with zero products."), with no "guide:" or "observed" words,
and the hero lead bolds "fail, 37 passed, 1 failed, 1 skipped" and adds the daily 04:00 UTC sentence, as
`Scorecard.png`. Every page matches its board in both looks.

Clean. 0 walkthrough misses, 0 width misses, 0 visual misses. No shared file change this round. First clean
round; one more clean round ends the loop.

## Round 7, 2026-10-01 03:01 UTC

Same deploy as round 6 (Worker version `48c8c1e9`), run again. Walkthrough: 22 passed, 0 missed, carts skipped
(`docs/ops/loop5/walkthrough-round-7.txt`). Document scroll width at or under the viewport on all twenty
combinations (five pages, lab and pixel, 1280 and 390). The nine screenshots in `docs/ops/loop5/` were retaken, and
all twenty were looked at: every page matches its round 3 board in both looks; the pixel look carries the skyline
on the home page and the quiet band elsewhere, Silkscreen and Press Start 2P, square panels and the pixel mark.
Clean. Second clean round in a row.

## Loop status

Closed on 2026-10-01 at 03:01 UTC after two clean rounds in a row (rounds 6 and 7). Seven rounds in all; the
misses per round were 21, 12, 9, 3, 2, 0 and 0. Wave A (ui-components on opus, docs-showcase) and wave B (ui-pixel,
ui-top-deals, ui-finder, ui-price-truth, ui-scorecard, ui-deal, sonnet) built the site as Workflow run
`wf_4f47fdb5-7ff`, the integrator steps on opus; rounds 1 to 6 ran inside it, round 7 from the integrator session.
Next: the CEO review of the whole site by the second model on the public snapshot.

## CEO review rounds

## CEO review round 1, 2026-10-01 03:04 to 03:08 UTC

Second model: GPT (`gpt-6-astra`, reasoning ultra) through the codex CLI, read-only sandbox, working
directory the public snapshot (commit fc9f61f, exported 03:02 UTC from source revision b7ec5c4), the nine
round 7 screenshots attached (the five pages in the lab look at 1280 px, the home page and the finder at
390 px, the home page and Price truth in the pixel look), every page as served in both looks and the
walkthrough in `review/`, the prompt `docs/ai-builder/prompts/16-ceo-review-site.md`. Verbatim answer:
`docs/ops/loop5/ceo-review-1.txt` (81,422 tokens).

Scores: impact obsessed 4, simplify to scale 3, disciplined 3, speed over comfort 4, extreme ownership 3;
overall 3 stars. Below the bar (4 stars, no lens below 3). The reject reason: Price truth states sync
history computed from the clock and the cron schedule (last delta sync 03:00 UTC, two syncs today, a full
load on 28 Sep) while the Scorecard, from the recorded runs, says 00:01 UTC, one and 30 Sep.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Price truth and the Scorecard contradict each other on the last delta sync, the syncs today and the last full load | `PriceTruthPageProps` carried no sync records, so the page computed them from the clock and the cron schedule (`syncsToday`, `lastDeltaSyncText`, `lastFullLoadDay`) | `PriceTruthPageProps.sync` and `/price-truth` pass the recorded runs, the value the Scorecard reads (`35163bc`) | integrator |
| 2 | Price truth's Next sync card and Changes today hint state scheduled syncs as runs that happened | The same cron arithmetic | Read `sync.runs`: the last complete delta sync, complete delta syncs started today, the last complete full load; a running, failed or late sync and "none yet" said as such; the next sync labelled as scheduled | ui-price-truth |
| 3 | The Scorecard's Next sync card does not tell a complete sync from a running one, and says nothing when a sync is late | `lastRunOfKind` takes the newest run of any status, `finishedAt ?? startedAt` | The same states and words as Price truth (complete, running since, failed, late, none yet; next sync scheduled) | ui-scorecard |
| 4 | No test holds the two pages to the same sync facts | Each page has only its own tests | `test/app/pages.test.ts`: one recorded sync history, both pages print the same last delta sync, syncs today and last full load; lands with the merge of rows 2 and 3 | integrator |
| 5 | "No cart and no page disagreed with the API today" over samples dated 30 Sep, read on 1 Oct before that day's 04:30 UTC sample; "100.0 %" for 30 days from one sampled day | The verdict calls the newest sample "today"; the 30 day rates name no coverage or selection | Name the sample's day; before today's sample say when it runs; the 30 day figures say how many of the 30 days were sampled and how the carts and pages are chosen | ui-price-truth |
| 6 | The Options by gap bands sum to 144,602; the caption under them says 144,772 | `gapBands()` counts live options at render time, the caption is the 30 Sep 12:21 UTC snapshot | The promo-gap job writes its bands to `promo_gap_bands` (migration 0010, on main) in the same run as the snapshot; the read model returns the latest snapshot's bands; a test that they sum to `optionsWithPromo` | monitor |
| 7 | The Promo gap section does not say when its figures were taken | The snapshot time is not printed | The section names the snapshot's day and time and the next snapshot at 04:30 UTC | ui-price-truth |
| 8 | No current release page: `evidence.md` describes the Top deals release, `docs/ai-builder/README.md` still holds three `<fill>` | Written in loop 4; loop 5's numbers not folded in | `evidence.md` for this release: Worker version, source revision, snapshot, both ask-to-live timelines from the commit log, the acceptance runs including the checkout run, the CEO results of loops 4 and 5, open items with owner and status; the three fills from this record | docs-showcase |
| 9 | README's "A second builder reproduced these steps" claims more than the reproduction did | Wording | Say what the clean clone proved (install, local database, gates, local pages) and what it did not (registration, deploy, inventory) | docs-showcase |
| 10 | Setup not portable across domains: `bin/publish` smoke tested the owner's host | A literal host | `bin/publish` reads `ZAL_PUBLIC_HOST` (`35163bc`) | integrator |
| 11 | "Run it yourself" does not say what a fork changes | Not written | The list a fork sets: the `routes` pattern in `wrangler.jsonc`, `ZAL_PUBLIC_HOST` for `bin/publish`, the host argument of `bin/walkthrough`, `ZAL_HOST` for `bin/zal`, its own Cloudflare login, D1 and partner registration | docs-showcase |
| 12 | The acceptance run skips both checkouts | The loop rounds ran `--no-carts` | Run with both checkouts on the live site at 03:15 UTC: 24 passed, 0 missed (`docs/ops/loop5/walkthrough-checkout.txt`) | integrator |
| 13 | No measurable outcome beyond test passes and model scores; no owners for the open API findings | Not written | The release page names its measure with today's number and the query, and lists each open Scorecard finding with its owner and status | docs-showcase |
| 14 | Public repository not pushed, `ZAL_AGENT_TOKEN` not rotated, target dates for the open items; no populated deployment of this snapshot by another builder, through search to checkout link on phone and desktop | The owner's decisions and another builder's accounts | Reported to the owner as open | the owner |

Fixes merged on main: lanes monitor, ui-price-truth, ui-scorecard and docs-showcase (each through
`bin/lane-merge`, gates green in the lane and on main). Row 4's test showed the two pages still told
different stories after rows 2 and 3 (a late window, a stamp from another day, punctuation), so both now
call one `syncFacts()` in `src/lib/sync-facts.ts` and `test/app/pages.test.ts` holds their three figures
equal (1090 tests). The live figure on both pages at 03:46 UTC: "30 Sep, 21:01 UTC. Running since 00:01
UTC. Late: the 03:00 UTC sync has not started" (`/data/sync.json`: the 00:01 UTC delta run is still
`running` with one page read, and no 03:00 UTC run started). The docs-showcase request (today's price
truth match rate) stays open: the newest cart sample and public comparison are from 2026-09-30 (20 of 20
carts, 59 of 59 pages); today's sample runs at 04:30 UTC.

Shipped: 03:46 UTC, Worker version eb0f2294-8fe1-48fd-98b2-3783c8ee6108, walkthrough 22 passed and 0
missed (`docs/ops/loop5/walkthrough-review-1.txt`, `--no-carts`), widths within the viewport on /, /find,
/scorecard and the first deal of /find in both looks at 1280 and 390 px and on /price-truth in the lab
look; not within it: /price-truth in the pixel look, 1418 px at 1280 and 394 px at 390 (the verdict
banner's `.figure-row`: "Pages, 30 days" with the value "100.0 % · 1 of 30 days sampled" in a `nowrap`
`.figure-value`).

## CEO review round 2, 2026-10-01 03:49 to 03:54 UTC

Same set-up as round 1: GPT (`gpt-6-astra`, reasoning ultra) through the codex CLI, read-only sandbox, working
directory the public snapshot (commit 7ddbf7e, exported 03:47 UTC from source revision efb1548, the 03:46 UTC
release, Worker version `eb0f2294`), the nine screenshots retaken on that release at 03:48 UTC (the five pages in
the lab look at 1280 px, the home page and the finder at 390 px, the home page and Price truth in the pixel look),
every page as served in both looks and the walkthrough in `review/`, the prompt
`docs/ai-builder/prompts/16-ceo-review-site.md`. Verbatim answer: `docs/ops/loop5/ceo-review-2.txt` (68,545 tokens).

Scores: impact obsessed 3, simplify to scale 3, disciplined 3, speed over comfort 4, extreme ownership 3;
overall 3 stars. Below the bar (4 stars, no lens below 3). The reject reason: Price truth prints nine gap bands
of 0 beside "144,772 of 154,038 sellable options carry a promo code", because the read model turns a missing
histogram into measured zeros.

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | Options by gap shows nine bands of 0 under a caption of 144,772 options with a code | `gapBandsAt` in `src/monitor/read-model.ts` fills nine zero bands when `promo_gap_bands` has no row for the snapshot; the live snapshot (30 Sep, 12:21 UTC) was taken before migration 0010 stored bands | No stored bands for the snapshot: return no bands, never zeros; a test that the read model returns either no bands or bands that sum to `optionsWithPromo` | monitor |
| 2 | The page draws whatever bands it gets, beside a caption they do not add up to | `gapBandBars` draws any non-empty list | Draw the histogram only when the bands sum to the caption's count; otherwise the empty state naming the snapshot and the 04:30 UTC run that brings the distribution | ui-price-truth |
| 3 | The verdict banner's sentence stacks one word per line in both desktop looks; the pixel page is 1418 px wide at 1280 | Each 30 day figure is one `nowrap` value, "100.0 % · 1 of 30 days sampled" | The value is the rate alone; the coverage moves to the label or the sentence | ui-price-truth |
| 4 | The banner lets its figures take the width the sentence needs | `app.css`: `.verdict .figure-row{flex-shrink:0}` with `.figure-value{white-space:nowrap}` and no minimum width on `.verdict-text` | The sentence keeps a readable width; figures that do not fit wrap under it, in both looks | ui-components |
| 5 | The Last delta sync card puts a whole sentence ("30 Sep, 21:01 UTC. Running since 00:01 UTC. Late: ...") in a narrow value column on Price truth and the Scorecard | `syncFacts` gave one joined string | `syncFacts` also gives `lastDeltaAt` (the stamp) and `lastDeltaNote` (the state sentences) (`4a349fe`) | integrator |
| 6 | The same, on the page | The card prints `lastDelta` as its value | Print `lastDeltaAt` as the value and `lastDeltaNote` under the card | ui-price-truth, ui-scorecard |
| 7 | The catalogue sync has stalled since 00:01 UTC (the reviewer's "stalled catalogue sync" and missed run): the 00:01 and 03:01 UTC delta calls both crashed with `D1_ERROR: variable number must be between ?1 and ?100` (`job_runs`) | `src/catalogue/index.ts` deletes stale options with `option_id NOT IN (?2, ...)`, one bind per kept option; a product with 100 or more options binds past D1's limit of 100 | The delete never binds more than 100 values; a test with a 150 option product | catalogue-store |
| 8 | Both pages say "Running since 00:01 UTC. Late: the 03:00 UTC sync has not started" while the 03:00 UTC sync did start and crashed | `runDeltaSync` in `src/sync/index.ts` walks inline and records a crash only in `job_runs`; the run stays `running` | Catch the crash, mark the run failed with the code and message (as `workflow.ts` does), so the figures say "Failed at hh:mm UTC" | sync-category |
| 9 | The release under review came after the two clean rounds and did not pass one: the pixel overflow was recorded, not fixed, and the snapshot was exported without a look at the new screenshots | The loop closed at 03:01 UTC; the 03:46 UTC fixes were deployed and reviewed with a walkthrough and widths only | Rule from now on: every deploy that goes to a review first passes a full round (walkthrough, the twenty widths, the twenty screenshots looked at), and the snapshot is exported only from a clean round. The walkthrough checks the bands against the caption (`4a349fe`; 03:59 UTC: 22 passed, 1 missed, that check, `docs/ops/loop5/walkthrough-review-2.txt`) | integrator |
| 10 | No one authoritative release page: `evidence.md` names Worker `48c8c1e9` (02:52 UTC), source `b7ec5c4` and snapshot `fc9f61f`, while `eb0f2294` (03:46 UTC) was live and the snapshot was `7ddbf7e` from `efb1548`; round 1 findings still "open" or "in progress" after they merged; every target date "not set" | `evidence.md` written before the round 1 fixes | The current release names the deploy, the source revision and the snapshot under review; each finding's status from this file; open items with owner, status and target date | docs-showcase |
| 11 | The snapshot does not carry the deploy it describes | The exporter writes the source revision only | `docs/ops/snapshot-gates.txt` also names the Worker version live at export and its deploy time, the one place the release page points to | export-public |
| 12 | The second ask's timeline contradicts itself: committed at 20:53 UTC, spoken at 21:50 UTC by its own header | The header's time was written by hand | The header's time corrected from the session record (the ask follows loop 4's last review at 20:45 UTC and precedes its commit); the second round's ask to live stated from the ask | docs-showcase |
| 13 | No outcome measure with today's number (`<fill>` in `evidence.md`) | `requests/docs-showcase.md` waits on today's cart sample, which runs at 04:30 UTC | Answer the request with the 1 Oct counts after 04:30 UTC | integrator |
| 14 | "Fully final" is not stated as retail before tax with a promo code typed separately; the three open API findings have no owner or plan on the release page | Not written | The release page and the story state the definition with the guide's sentence; the three findings listed with owner, status and next step | docs-showcase |
| 15 | `ZAL_AGENT_TOKEN` not rotated, the source not pushed, no independent builder has reproduced a populated deployment through search to checkout link | The owner's decisions and another builder's accounts | Reported to the owner as open (`evidence.md`, open items) | the owner |
| 16 | No agreed success target beyond checks and reviews; no acceptance that "fully final" means retail before tax; no target dates; the three API findings not taken to the Partner API team | Only the owner can agree, date and raise them | Reported to the owner as open (`evidence.md`, open items) | the owner |

Fix lanes: monitor, ui-price-truth, ui-components, ui-scorecard, catalogue-store, sync-category, export-public,
docs-showcase (`docs/lanes/<lane>.md`, "Review round 2, loop 5 fixes"). After their merges the integrator runs
the full round of row 9 on the deploy before the next snapshot.

Merged: monitor, ui-components, ui-price-truth, ui-scorecard, export-public, docs-showcase (rows 1 to 4, 6, 10
to 12 and 14). `test/app/pages.test.ts` now holds the bare "Last delta sync" stamp and the state line under the
card's rows equal on Price truth and the Scorecard (the requests of ui-price-truth and ui-scorecard); 1099 tests
green on main. Not in this release: catalogue-store (row 7) and sync-category (row 8) had no commit yet.
`docs/ops/loop5/walkthrough-review-2.txt` now holds the run on this release.

Shipped: 04:17 UTC, Worker version 8cdb2d3e-04e0-475b-818e-9994bd0a7a01, walkthrough 23 passed and 0 missed
(`docs/ops/loop5/walkthrough-review-2.txt`, `--no-carts`), widths all within the viewport: /, /find,
/price-truth, /scorecard and the first deal of /find, in the lab and the pixel look, at 1280 and 390 px (each
document exactly 1280 or 390 px wide).

## CEO review round 3, 2026-10-01 04:19 to 04:26 UTC

Same set-up as rounds 1 and 2: GPT (`gpt-6-astra`, reasoning ultra) through the codex CLI, read-only sandbox,
working directory the public snapshot (commit 7a6e629, exported 04:18 UTC from source revision b89c25c, the
04:17 UTC release, Worker version `8cdb2d3e`), the nine screenshots taken on that release at 04:19 UTC (the
five pages in the lab look at 1280 px, the home page and the finder at 390 px, the home page and Price truth in
the pixel look), every page as served in both looks and the walkthrough in `review/`, the prompt
`docs/ai-builder/prompts/16-ceo-review-site.md`. Verbatim answer: `docs/ops/loop5/ceo-review-3.txt` (85,670 tokens).

Scores: impact obsessed 3, simplify to scale 3, disciplined 3, speed over comfort 4, extreme ownership 3;
overall 3 stars. Below the bar (4 stars, no lens below 3); the third and last round the plan allowed. The
reject reason: the catalogue refresh is broken (two crashed delta calls, their fixes not in the release) while
both dashboards say "Running since 00:01 UTC. Late: the 03:00 UTC sync has not started".

| # | Miss | Cause | Fix | Who |
|---|---|---|---|---|
| 1 | The catalogue's delta sync still crashes on every call: `D1_ERROR: variable number must be between ?1 and ?100` | Round 2 row 7 had no commit: `src/catalogue/index.ts` still deletes stale options with one bind per kept option | The delete never binds more than 100 values; a test with a 150 option product, which the fake D1 now fails as D1 does (`c208bd2`, integrator) | catalogue-store |
| 2 | A crashed call leaves its run `running`, so the pages describe a crash as a run in progress | Round 2 row 8 had no commit: `runDeltaSync` records a crash only in `job_runs` | Catch the crash, mark the run failed with code `CRASH` and the message; the next call opens a fresh run; tests for both | sync-category |
| 3 | Both pages say "Late: the 03:00 UTC sync has not started" though the 03:01 UTC call ran | `syncFacts` called the window late whenever no run started in it, but `runDeltaSync` continues an open run instead of starting one | No late window while a delta run is open; `test/lib/sync-facts.test.ts` and `test/app/pages.test.ts` hold the three states (failed, late, open) to their exact line on both pages (`6fb2cf4`) | integrator |
| 4 | No production evidence that the sync recovered and that the pages show it | Rows 1 and 2 not merged | After rows 1 and 2 merge and deploy: run the delta sync, record its run id, status, pages and products, and the line both pages print, here | integrator, after rows 1 and 2 merge |
| 5 | The release record is not current: `evidence.md` names the 03:46 UTC deploy `eb0f2294` while `8cdb2d3e` (04:17 UTC) was live; round 2 rows 1 to 4, 6 and 11 still read "in progress" after they merged | `evidence.md` written before the round 2 merges | The current release names the deploy under review, its source revision, snapshot, walkthrough and screenshots; each finding's status from this file; round 3's rows added | docs-showcase |
| 6 | The snapshot says "Worker version: not given" | The integrator exported without `--worker-version` and `--deployed-at` | Rule from now on: every export passes both (`bin/export-public --worker-version <id> --deployed-at "<yyyy-mm-dd hh:mm> UTC"`, both read from `wrangler deployments list`) | integrator |
| 7 | The exporter lets a snapshot leave without its deploy | The flags are optional and their absence only prints "not given" | The exporter refuses to export without both flags unless `--no-worker-version` says why | export-public |
| 8 | `docs/ops/loop5/` held round 7's screenshots (03:01 UTC, Worker `48c8c1e9`), not the release under review | The review kit's 04:19 UTC shots were not copied back | The nine 04:19 UTC screenshots of `8cdb2d3e` are in `docs/ops/loop5/` (`6fb2cf4`) | integrator |
| 9 | Price truth says "Mondays run higher" with no observed Monday | The Freshness note reads the cron schedule (`0 5 * * 1`, the weekly full load) as a pattern | Say when the weekly full load runs; claim a Monday pattern only from recorded days | ui-price-truth |
| 10 | "No mismatch in the last 30 days" over one sampled day (20 carts, 59 pages on 30 Sep) | `cartMismatchNote` and `publicMismatchNote` speak for the window, not for the days sampled | Name the sampled days: "No mismatch on the 1 sampled day of the last 30" | ui-price-truth |
| 11 | The acceptance claim "the finder offers the same categories as Top deals" was checked on one category; Top deals lists 9, the finder 32 | The walkthrough compared the first city and the first category only; this file's "What working means" said "the same categories" | The walkthrough checks the whole sets (the finder every pickers city and category, Top deals the same 50 cities and a subset of the categories, things-to-do first): 23 passed, 0 missed (`docs/ops/loop5/walkthrough-review-3.txt`); "What working means" states the rule (`6fb2cf4`) | integrator |
| 12 | Top deals' note says the lists offer "Groupon's top categories" while it lists only the 9 with deals in the city | The sentence is shared wording, not the page's rule | The note says the category list holds the N categories with deals in the chosen city | ui-top-deals |
| 13 | The finder's note says the same sentence while it lists all 32 categories | The same shared wording | The note says the list holds all N categories; a category with no deal in the chosen city answers the empty sentence | ui-finder |
| 14 | `ZAL_AGENT_TOKEN` not rotated; the source and prompts not pushed, no public repository URL | The owner's decisions | Reported to the owner as open (`evidence.md`, open items) | the owner |
| 15 | No independent builder has deployed this release with inventory and completed search to checkout link | Another builder's accounts | Reported to the owner as open (`evidence.md`, open items) | the owner |
| 16 | No agreed user outcome and target; no agreement that "fully final" means retail before tax with the promo separate; no agreed shared filter rule (row 11) | Only the owner can agree them | Reported to the owner as open; the shared filter rule added to `evidence.md`, open items (`6fb2cf4`) | the owner |
| 17 | No dated owners for the open items; no Partner API contacts for F-001 to F-003 | Only the owner can date them and raise them | Reported to the owner as open (`evidence.md`, open items) | the owner |

Fix lanes: catalogue-store, sync-category, docs-showcase, export-public, ui-price-truth, ui-top-deals, ui-finder
(`docs/lanes/<lane>.md`, "Review round 3, loop 5 fixes"). Integrator rows 3, 8 and 11 are on main (`6fb2cf4`;
the fake D1's bind limit `c208bd2`; 1101 tests green; not yet deployed); row 6 applies at the next export; row 4 follows the merges of rows 1 and 2.

## Review status

Three rounds run, 3 stars each, the lenses moving from 4, 3, 3, 4, 3 (round 1) to 3, 3, 3, 4, 3 (rounds 2 and 3).
Not passed; the plan allowed three rounds. The fix lanes above and the recovery run of row 4 are done and
deployed ("After the review" below); open: the owner's items (rows 14 to 17).

## After the review, 2026-10-01 04:53 UTC

**Merged** (`bin/lane-merge`, gates green in each lane and on main, no retry needed): catalogue-store
(`daf0075`), sync-category (`acfc1d0`), ui-price-truth (`1216cd9`), ui-top-deals (`690c33b`), ui-finder
(`bd6df54`), docs-showcase (`bb3f787`), export-public (`cdccae6`). No lane wrote a request. Their changelog
lines folded into `CHANGELOG.md` (`4234175`). `bun test` on main after the last merge: 1114 pass, 0 fail.

**Deployed.** Worker version 805badde-20a4-49d5-988b-db72e44cd1ea at 04:50 UTC (source `4234175`), then
e3388aad-6cf8-4560-9258-2beeef478e6c at 04:52 UTC (source `e77089a`, the fix below); smoke checks ok.

**The delta sync recovered.** Before (`/data/sync.json`, 04:49 UTC): the newest delta run
`delta-d27abe41-15a7-4d22-8405-5b5d0e5955ee` `running`, started 00:01:27 UTC, 1 page, 50 products, finished
null; the last complete delta `delta-8bbcf25a-...` (30 Sep 21:00 to 21:01 UTC, 3 pages, 131 products);
`lastRefreshAt` 2026-09-30T20:49:54.534Z; 61,485 products, 55,792 listable. One hand call
(`bin/zal job sync-delta`, 04:50:40 UTC) resumed the open run from its page. `job_runs`: `sync-delta`, ok 1,
"Delta delta-d27abe41-15a7-4d22-8405-5b5d0e5955ee complete: 4 pages, 187 products, next refresh from
2026-10-01T04:39:45.768Z." After (`/data/sync.json`): the same run `complete`, finished 04:50:47 UTC, 4
pages, 187 products, errors 0; `lastRefreshAt` 2026-10-01T04:39:45.768Z; 61,504 products, 55,811 listable.
No call crashed, so the `CRASH` path did not fire; one call was enough (the summary names no page left).

**One more fix on main.** On the 04:50 UTC release both pages still printed "Late: the 03:00 UTC sync has not
started" under "Last delta sync 04:50 UTC": `syncFacts` took a window's sync to be a run started in it, and
the recovered run started at 00:01 UTC. A run that finishes in the window now counts as its sync, complete
or failed (`e77089a`, two tests in `test/lib/sync-facts.test.ts`; 1116 pass). On e3388aad both Price truth
and the Scorecard say "Last delta sync 04:50 UTC", "Delta syncs today 1", "Next sync: 06:00 UTC, scheduled",
and no Late line (`docs/ops/loop5/price-truth-lab-1280.png`, `scorecard-lab-1280.png`, 04:53 UTC).

**Acceptance on e3388aad.** Walkthrough without carts: 23 passed, 0 missed
(`docs/ops/loop5/walkthrough-post-review.txt`; checkout skipped by `--no-carts`). Widths: all twenty
combinations (five pages, two looks, 1280 and 390 px) have a scrollWidth equal to the viewport; the nine
screenshots in `docs/ops/loop5/` retaken.

## After the hand-over: the promo line, 2026-10-01 13:37 UTC

The owner, on the live Top deals page: "this is stupid", pointing at the Promo codes list, twenty numbered
sentences with the same code FALL under the ranked rows. Fix (`d176ca2`, Worker version
de936880-d457-4632-9b1f-56fa9f419afa, deployed 13:37 UTC): the promo is one muted line under the deal it
belongs to ("Type code FALL at Groupon checkout to pay $376.20."), on Top deals (podium and rows), Find a
deal (cards), Price truth (the largest gaps) and the deal page (options). The footnote list, the "promo N"
markers and the "Numbers match the list above" line are gone from the site, the design generator, the
boards and LANGUAGE.md. The promo price still appears only inside that sentence (rule 2); the second
sentence ("Without it you pay $X.") is the row's own "You pay" and is not repeated. Walkthrough on the new
version: 23 passed, 0 missed; `/` 1280 and 390 wide, both looks, the promo line counted 20 of 20 on the
home page and 0 footnotes (`docs/ops/loop5/home-lab-1280.png`, `home-lab-390.png`, `home-pixel-1280.png`).
The canvas boards were not republished; the regenerated boards are in `design/project/` and `design/preview/`.

## Status

Loop 5 closed on 2026-10-01 with the review bar not reached. The promo line change above (13:37 UTC) is the
live version now, `de936880`, on top of the release described below.

**Live.** `https://zorasocial.asajj.cz`, Worker version e3388aad-6cf8-4560-9258-2beeef478e6c, deployed 04:52 UTC
from source revision e77089a (`wrangler deployments list`): Top deals at `/`, the finder at `/find`, Price truth,
the Scorecard and the deal page, each in the lab and the pixel look, the switch on the logo. It carries the
seven round 3 fix lanes and the integrator's round 3 rows; its acceptance run: walkthrough 23 passed and 0
missed without carts, widths within the viewport on all twenty combinations
(`docs/ops/loop5/walkthrough-post-review.txt`, "After the review" above). The CEO review read 8cdb2d3e (04:17 UTC).

**Scores.** Design, three rounds, out of 5: Top deals 2, 4, 4; Find a deal 2, 2, 3; Price truth 3, 4, 4;
Scorecard 2, 3, 4; Deal 3, 4, 4. Walkthrough loop: seven rounds, misses 21, 12, 9, 3, 2, 0, 0, closed 03:01 UTC.
CEO review, three rounds, 3 stars each, lenses (impact, simplify, disciplined, speed, ownership) 4, 3, 3, 4, 3
then 3, 3, 3, 4, 3 twice; 14, 16 and 17 findings. The bar is 4 stars with no lens below 3.

**Open, and whose it is.**

| Item | Owner | State at 04:53 UTC |
|---|---|---|
| The delta sync crashes on D1's bind limit (round 2 row 7, round 3 row 1) | catalogue-store | Done: `daf0075`, deployed 04:50 UTC; the 00:01 UTC run completed at 04:50 UTC with 0 errors |
| A crashed delta call leaves its run `running` (round 2 row 8, round 3 row 2) | sync-category | Done: `acfc1d0`, deployed 04:50 UTC |
| Proof the sync recovered and both pages say so (round 3 row 4) | integrator | Done: "After the review" above; `delta-d27abe41-...` complete at 04:50:47 UTC, 4 pages, 187 products, 0 errors; both pages print 04:50 UTC with no Late line after `e77089a` |
| The release record current, round 3 rows added (round 3 row 5) | docs-showcase | Done: `bb3f787` (it names 8cdb2d3e, the release under review; the post-review deploy e3388aad is recorded here) |
| The exporter refuses an export without the deploy (round 3 row 7) | export-public | Done: `cdccae6` |
| The weekly full load named without a Monday claim; the sampled days named (round 3 rows 9 and 10) | ui-price-truth | Done: `1216cd9`, live on e3388aad |
| The category notes say which categories each list holds (round 3 rows 12 and 13) | ui-top-deals, ui-finder | Done: `690c33b`, `bd6df54`, live on e3388aad |
| Deploy main, then a full round before the next snapshot (round 2 row 9) | integrator | Done: e3388aad from `e77089a`, walkthrough 23 passed, 0 missed (no carts), widths within the viewport on all twenty combinations |
| Push the source and prompts to a public repository and give its URL | the owner | Not done |
| Rotate `ZAL_AGENT_TOKEN` | the owner | Not done |
| An independent builder deploys this release with inventory, search to checkout link | the owner, with that builder | Not done |
| Agree the user outcome and its target, "fully final" as retail before tax with the promo separate, the shared filter rule; date the open items; raise F-001 to F-003 with the Partner API team | the owner | Not done |
