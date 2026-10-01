<!-- Module: docs/lanes/design-unified.md · Tested: n/a · Given verbatim to the design agents of loop 5, 2026-09-30 22:00 UTC; models: opus for the language step, the designers and the consistency critic, sonnet for the critics, judges and the publisher -->
# Design brief: one site, two looks (loop 5)

You design the five pages of Zora Agent Lab as Claude Design artboards, in rounds, so that the whole
site reads as one product at the quality of the Top deals page, and so that a switch on the logo
flips every page between the **lab look** (the current design) and the **Zora pixel look** (concept A
from the Top deals canvas). Every number on a board is sample data, and the board says so once, in a
pill near the title.

## Read first

1. `design/LANGUAGE.md` (written in the language step; designers follow it, critics score against it).
2. The lab look at reference quality: `design/project/TopDeals.dc.html` and `TopDealsPhone.dc.html`
   (the third pass after a three-lens critique). The other lab boards are a pass older:
   `Main.dc.html` (the finder), `FinderPhone.dc.html`, `PriceTruth.dc.html`, `Scorecard.dc.html`,
   `Deal.dc.html`.
3. The pixel look: `design/project/TopDealsPixel.dc.html` and `TopDealsPixelPhone.dc.html` (concept A,
   one pass).
4. The live pages, so you design for real content and real edge cases: `src/ui/pages/top-deals.tsx`,
   `finder.tsx`, `price-truth.tsx`, `scorecard.tsx`, `deal.tsx`. The data each page gets:
   `src/contracts/pages.ts`, `src/contracts/reports.ts` (`TopDealsReport`, `PriceTruthReport`,
   `ScorecardReport`, `SyncStatus`) and `src/contracts/ports.ts` (`DealCard`, `DealDetail`,
   `PromoNote`). The components that exist: `src/ui/components/README.md`; the stylesheet tokens: the
   top of `public/static/app.css`.
5. The rules that bind every board, from `AGENTS.md`: money only in its formatted form; the price a
   shopper pays is the retail price, the promo code is a footnote sentence, never a column and never
   the price; nothing on a board looks like a price except the original (struck) and the price to pay.

## The two looks

**Lab** (default): ivory `#FBF8F3` ground, ink `#1E1F4B`, muted `#54567A`, line `#E3DDD2`, panel
`#F3EEE5`, white surfaces, indigo `#2B2D6E` for actions and the active sort segment, coral `#FF6B4A`
only as the nav underline, the logo and the winner's rule (never under white text), blue `#1F4FBF`
with tint `#EAF0FF` for pass, orange `#F2A541` with ink `#B4500B` and tint `#FFF3E3` for fail. Sora
for headings, IBM Plex Sans for text, IBM Plex Mono for figures. Radius 16 on cards, 10 on fields,
1 px lines.

**Pixel** (Zora): ground `#14151C`, panels `#1B1D26` and `#0F1016`, lines `#3A3D4D` and `#2E3140`,
ink `#E8E4D8`, muted `#A8A5B8`, amber `#F2B33D` as the accent (shadow `#7A5A12`, highlight `#FFD97A`),
mint `#7FE0A6` for pass, lavender `#B9A6F2` as the second accent, a fail red you choose with 4.5:1
contrast on the panel. Silkscreen for labels, nav and section titles; Press Start 2P only for the h1
and the one biggest figure of a page; IBM Plex Mono for text and figures. Square corners, 2 px
borders, 4 px hard black shadows, `shape-rendering: crispEdges`, `image-rendering: pixelated` on
photos. The pixel skyline strip under the header is the signature: on the home page, and on the other
pages only if it stays quiet. Text contrast at least 4.5:1 in both looks.

Both looks share one structure: the same header (the logo lockup with the switch, four nav links in
this order: Top deals, Find a deal, Price truth, Scorecard), the same hero (eyebrow, h1, lead), the
same picker card, the same results head, the same tiles, the same sections, the same foot line. The
pixel look is a reskin of the same components, never a second layout.

## The switch on the logo

The logo lockup is the mark, the wordmark "Zora Agent Lab" (the home link) and, as part of the
lockup, the look switch: a two-state control "Lab | Pixel", 32 px tall inside a 44 px hit area, the
current look filled, drawn in the current look (rounded and indigo in lab, square and amber in pixel).
It flips the whole page at once, without a reload, and the choice is remembered. On the phone the
mark and the switch stay in the header; the wordmark may go. Both marks exist: the lab mark (three
coral bars over an indigo arch on a coral base, `src/ui/components/shell.ts`) and the pixel mark (the
same bars pixel-snapped over a stepped block, `TopDealsPixel.dc.html`). Draw the lockup once in
LANGUAGE.md and use it on every board.

## The pages and what each must show

### Top deals, the home page (`/`)

Keep the third-pass structure: hero, the sentence picker "Top 20 deals in [City] for [Category] [any
label]" with its note, four tiles, the podium of three, ranks 4 to 20 with the saving bar, the promo
footnotes, the foot line. The eyebrow stays "Product 4 · an AI Builder showcase", the h1 "Top deals".
Improve what the third-pass critique left open, and make the pixel version. Data: `TopDealsReport`.

### Find a deal (`/find`)

Today: a four-field form (what, city, state, highest price) and a grid of nine cards. Target: the same
sentence picker card as Top deals: "Find [what, a text field] in [City, ST | anywhere] for
[Category | anything] under [$ | any price]" with a Search button; the city list and the category
list are the same lists as on Top deals (the 50 cities with the most deals; Groupon's top categories).
A results head ("9 deals for "massage" in Chicago, IL", or "Today's picks: massage") with a note on
the order (by relevance). Tiles over the results, from `DealCard` fields only (`listPriceMinor`,
`payMinor`, `promo`): the cheapest, the biggest saving, how many carry a promo code, or what serves
the shopper better. The cards: photo, title, option, city, the original struck, the price to pay,
"You save $X (Y %)", the promo sentence as a footnote marker, the whole card a link to the deal. Empty
cases: nothing loaded yet (with the schedule); no deals found (with a next step: fewer words,
anywhere, any price). Data: `FinderPageProps` (`query`, `searched`, `cards`, `listableDeals`,
`featuredTheme`) plus, new in this loop, `cities: TopCity[]` and `categories: TopCategory[]`.

### Price truth (`/price-truth`)

Today: four sections of tiles and tables. Target: a hero (eyebrow "Product 1 · Price truth monitor",
h1 "Price truth", a lead that states today's verdict in one sentence with its numbers: "Today the
price the API quotes is the price the cart charges: 20 of 20 carts. groupon.com showed the same price
on 59 of 59 listing pages."); a verdict banner in the pass tone, or the fail tone when any cart or
page disagreed; the tiles; then four sections in this order: Catalogue against cart (a 30-day strip,
one square per day, matched or mismatched, and the latest day's rows), API against groupon.com (the
same strip and the latest day's numbers), Promo gap (the tiles, the histogram of gap bands, the
largest gaps as ranked rows in the Top deals style: rank, deal, you pay, with code, gap, code),
Freshness (price changes per day as bars, the next delta sync). Every section says when it refreshes.
Data: `PriceTruthReport`.

### Scorecard (`/scorecard`)

Today: seven sections. Target: a hero (eyebrow "Product 2 · Partner experience daily probe", h1
"Scorecard", the lead is the age line: "Last probe run 3 hours ago (2026-09-30T04:00:12Z): pass, 14
passed, 0 failed, 1 skipped."); a verdict banner (PASS or FAIL, big, with the 7-day and 30-day pass
rates); the 30-day run strip (one square per run, pass or fail, with the date); then the sections:
Failing steps (check rows), Latency per endpoint (bars, p50 and p95 as figures), Catalogue copy
(tiles: listable products, last refresh, the last full and delta runs), Contract drift (rows),
Findings (cards with severity, area, expected, observed, status). Data: `ScorecardReport`,
`SyncStatus`.

### Deal (`/deals/:id`, a shopper page)

Keep the structure (breadcrumb, title, photo, the price block with the promo sentence, the option rows
each with its checkout button, locations, terms, price history) and bring it to the language: the hero
pattern, the section rules, tiles where they help (options, the cheapest, the largest saving). Both
looks, desktop and phone. Data: `DealDetail`, `PriceChangeRow[]`.

## Phone

Every page at 390 px: nothing wider than 390, the picker stacked full width, the tiles two per row,
the podium one card per row, ranked rows and tables as labelled lists, the switch still in the header.
Draw the phone boards for every page in both looks.

## Boards, files and how they are made

- Boards are generated. `design/gen/common.py` holds the shared parts for both looks: the page
  wrapper, the header with the lockup and the switch, the hero, the picker card, the tiles, the
  section, the podium card, the rank rows, the footnotes, the foot line, badges, buttons, selects,
  inputs, histogram bars, the day strip, the verdict banner, check rows, the finding card, the data
  table, the deal card, the sample pill. One `design/gen/<page>.py` per page (`top_deals`, `finder`,
  `price_truth`, `scorecard`, `deal`) returns its four boards. `design/gen/build.py [page]` writes
  `design/project/<Name>.dc.html`, updates `design/project/canvas.json`, writes
  `design/preview/<Name>.html` (the same board with `{{accent}}` filled in, for screenshots) and, with
  `--archive r<N>`, copies the boards under `design/rounds/r<N>/`. `design/gen/shots.js` screenshots
  the previews to `design/preview/shots/<Name>.png` (the chromium binary from `ZAL_CHROME`, playwright
  from `NODE_PATH`; no machine path in the file).
- Names: `TopDeals`, `Finder`, `PriceTruth`, `Scorecard`, `Deal`, each with the `Pixel`, `Phone` and
  `PixelPhone` variants: `Finder.dc.html`, `FinderPixel.dc.html`, `FinderPhone.dc.html`,
  `FinderPixelPhone.dc.html`. Desktop boards are 1280 wide, phone boards 390; the height is what the
  content needs, stated in the board's `$preview`.
- The artboard format is that of `design/project/TopDeals.dc.html`: `<x-dc>`, a `<helmet>` with the
  Google Fonts link and a small style, a fixed-width root div, inline styles on every element,
  `{{accent}}` where the accent goes, and the `data-props` script with the accent editor. No external
  stylesheet, no JavaScript in a board.
- Every board carries the header with the lockup and the switch, the sample-data pill and the foot
  line; realistic sample content (Groupon-like deal titles, cities from the top 50, plausible prices
  with the original above the price to pay); and the page's empty state drawn once, small, under the
  main content, so the builders see it.
- A designer never edits `common.py` in a round. A shared part it needs goes into its own module and
  into `design/gen/requests/<page>.md` (one line per part: the part, why); the language step folds
  those requests into `common.py` between rounds. `build.py <page>` writes only that page's boards
  and previews; only the full `build.py` and `build.py --archive` rewrite `canvas.json`.

## Rounds

Round 1: the language step writes `LANGUAGE.md`, `common.py`, `build.py` and `shots.js` and proves
them with one board. Then five designers, one per page, write their module and build their four
boards. Then three critics per page (the CEO who will show this; a shopper on a phone; the design
craft against LANGUAGE.md) and one consistency critic across the ten desktop boards. A judge per page
merges them into at most eight ranked changes with a score from 1 to 5, in
`docs/ops/loop5/design/r1-<page>.md`.

Rounds 2 and 3: the language step folds the consistency items and the requests into `common.py` and
`LANGUAGE.md`; each designer reads its judge's file, makes every change it agrees with, says in the
file which it did not make and why, and rebuilds; then the critics and the judges again. The loop ends
after round 3, or earlier when every page scores 5. Every round's boards are archived under
`design/rounds/r<N>/` and published to the canvas as one row per round, so the rounds can be compared.

## What the critics look for

- CEO lens: is this one product I would show; does every page say what it is, for whom, and what
  today's numbers are; does anything decorative hide the numbers; is the pixel look a real second look
  or a costume.
- Phone lens: at 390 px does every page read top to bottom without sideways scroll; is the picker
  usable with a thumb; is the switch reachable; is the price to pay the biggest figure in every card.
- Craft lens: LANGUAGE.md followed (tokens, type scale, spacing, the lockup, the switch); contrast;
  hierarchy; nothing wider than the board; one accent; no two components for one job; both looks share
  the structure.
- Consistency lens, across the ten desktop boards: the same header, hero, picker, tiles, section and
  foot; the same words for the same things; the same style of figures.

Scores: 5, nothing to change; 4, polish only; 3, one structural change; 2, two or more; 1, the board
does not match the brief.
