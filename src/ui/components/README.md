<!--
The contract the page lanes build against: the two looks, the lockup, every block with its signature and classes, and the page-level classes.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  src/ui/components/README.md
Deps:    design/LANGUAGE.md, design/gen/common.py, public/static/app.css
Tested:  test/ui/components/*.test.ts
-->
# UI components: the contract

Plain functions that return HTML strings. No framework. Every value a caller passes is escaped with
`esc` from `src/lib/html.ts`, except parameters documented as HTML (`body`, `aside`, `parts`,
`rows`, `notes`, `left`, `right`), which take the output of these functions. Money is formatted only
with `formatMoney`. Read this file before you write a line of a page; build the page from these
blocks and the page-level classes at the end, and from nothing else. A class not listed here has no
style in either look. Need something missing? Write it in `requests/<lane>.md`.

## The two looks

- **Lab** is the default: no attribute. **Pixel** is `<html lang="en" data-theme="pixel">`, which the
  server writes (`withTheme` in `src/ui/routes.ts`) when the `zal_theme` cookie says `pixel`. A page
  never writes `data-theme`, and the default document never contains the word `data-theme`
  (`test/app/pages.test.ts` checks it).
- `POST /theme` with `theme` (`lab` or `pixel`) and `next` (a path) sets the cookie for a year and
  returns to `next`. With scripts, the switch script flips the look at once, with no reload.
- Two stylesheets, in this order: `/static/app.css` (the lab look, every layout) and
  `/static/pixel.css` (every rule under `[data-theme="pixel"]`, built by the ui-pixel lane from the
  class names here). Classes name what a thing is, never how it looks.
- Every colour in `app.css` is one of the LANGUAGE.md tokens on `:root`: `--ground --surface --panel
  --bar --field --track --line --row-line --field-line --empty-line --ink --muted --action
  --on-action --link-hover --accent --figure --eyebrow --save --save-tint --save-line --promo
  --promo-tint --promo-line --pass --pass-tint --pass-line --fail --fail-ink --fail-tint --fail-line
  --fail-hatch --neutral --monogram --panel-stripe`, plus `--chevron` (the select's arrow, a `url()`)
  and the fonts `--font-head --font-body --font-mono`. The pixel look retints by redefining them.
- Both marks are always in the markup: `.mark--lab` shows and `.mark--pixel{display:none}` in
  `app.css`; `pixel.css` swaps them.
- The fonts link loads both looks: Sora, IBM Plex Sans, IBM Plex Mono 400 to 700, Press Start 2P,
  Silkscreen 400 and 700.
- Phone rules live in one `@media (max-width:480px)` block, tested at 390 px.

## `shell.ts`: the document and the lockup

- `shell({ title, active, body, head? })`: the full document. `active` is
  `"top-deals" | "finder" | "price-truth" | "scorecard" | null`; the nav marks it with
  `aria-current="page"`. Nav order: Top deals `/`, Find a deal `/find`, Price truth, Scorecard.
- `publicShell({ title, body, head? })`: the same document without the nav.
- The header, exactly (the walkthrough and the tests read it):

  ```html
  <header class="shell-header"><div class="shell-lockup"><a class="shell-brand" href="/"><svg class="mark mark--lab" …>…</svg><svg class="mark mark--pixel" …>…</svg><span class="shell-brand-name"><span class="shell-wordmark-zora">Zora</span> Agent Lab</span></a><form class="theme-switch" method="post" action="/theme" aria-label="Look"><input type="hidden" name="next" value="/find"><button type="submit" name="theme" value="lab" aria-pressed="true">Lab</button><button type="submit" name="theme" value="pixel" aria-pressed="false">Pixel</button></form></div><nav class="shell-nav" aria-label="Main">…</nav></header>
  ```

  `next` is the nav href of `active` (`/` for `top-deals`, for `null` and in `publicShell`). One
  inline `<script>` follows `</header>`: it applies the cookie when the server did not, marks the
  pressed button, sets `next` to the current path and query, and on a click sets or clears
  `data-theme` and the `zal_theme` cookie without posting. It touches the attribute through
  `dataset`, so its text never names `data-theme`.
- The switch is drawn from the buttons alone: each `<button>` is a 44 px hit box, its `::after` the
  24 px pill, its `::before` the glyph (a circle for Lab, a square for Pixel); the form's `::before`
  is the 32 px track. In lab the Lab button is filled (`--action`, text `--on-action`); the pixel
  stylesheet fills the Pixel one. The divider between brand and switch is `.shell-lockup::after`.
- Then `<main class="shell-main">` (the body) and `<footer class="shell-footer">` with the source
  line ("Prices come from the Groupon Partner Storefront API. The price a shopper pays is the
  retail price."), so a page's `pageFoot` carries only its refresh line.

## `blocks.ts`: the shared blocks (loop 5)

Every page is this stack, in this order: `hero`, the picker or the verdict, one `statTiles` row,
`pageSection`s, drawn states (`pair` of `drawnState`), `pageFoot`.

- `hero({ eyebrow, title, lead, aside? })`: `.hero` > `.hero-text` (`p.eyebrow`, `h1.hero-title`,
  `p.lead`; `lead` is a string or `{ text, strong? }`, each `strong` phrase bold where it first appears) and, when given, `.hero-aside` holding `aside`. A title over 60 characters adds
  `.hero-title--long` (a size down).
- Sentence parts, for `pickerCard` only:
  - `sentenceWord(text)`: `span.sentence-word`; a word over 8 characters adds
    `.sentence-word--row` (its own row on the phone). Give a long lead phrase as two words,
    `sentenceWord("Top 20 deals"), sentenceWord("in")`, so the phone pairs "in" with its slot.
  - `sentenceSelect({ label, name, value, options })`: `label.sentence-pick` >
    `span.sentence-pick-label` + `select.sentence-select`; the match is `<option value="v" selected>`,
    the rest `<option value="v">`. The stylesheet gives it `field-sizing:content`, so the box is as
    wide as the chosen option, never its longest one (a long tag name no longer pushes the sentence
    onto a second line).
  - `sentenceInput({ label, name, value?, placeholder?, size? })`: the same label around
    `input.sentence-input`, always `type="text"` with `autocomplete="off" data-1p-ignore
    data-lpignore="true"`. 220 px wide unless `size` (characters) is given; full width on the phone.
  - `sentenceBreak()`: `span.picker-break`, a new line on the desktop (Find a deal breaks after
    City); the phone ignores it.
- `pickerCard({ action, parts, submit?, note?, hidden? })`: `<form class="picker-card" method="get"
  action="…" autocomplete="off" data-1p-ignore>`, then `hidden` (`{ name, value }[]`) as hidden
  inputs, `.picker-sentence` and `p.picker-note`. `parts` is the list of sentence parts above, in
  order; each word and the slots after it become a `span.picker-group`, and the last group ends with
  the submit button (`button.btn`, label `submit`, default "Show"). A word with no slot after it gets
  `.sentence-word--row`. Phone: words in one column, every slot at one x, the button full width.
- `resultsHead({ title, aside?, note?, refresh? })`: `.results-head` > `h2.section-title
  .section-title--rule`, then `aside` (a sort toggle) or, without one, `span.refresh-note`, then
  `p.results-note` (the note, joined by " · " and the refresh when an aside took the right). Phone:
  the head is a column with no wrap, the note under the title, never beside it.
- `pageSection({ title, body, aside?, note?, refresh?, id? })`: `section.page-section` with that head,
  then `body`. Sections sit on the ground; their content goes in boxes.
- `box({ title?, body, note? })`: `.box`, the surface card inside a section; `h3.box-title` (muted),
  `body`, `p.box-note` pinned to the foot.
- `sideBoxes(left, right)`: `.side-boxes`, a history box beside a 320 px box with the latest state;
  stacked on the phone.
- `labelledList(items)`: `dl.labelled-list` of `{ label, value, tone? }`, label left and value right;
  a toned value is `dd.toned.toned--pass` or `.toned--fail`.
- `figureRow(figures)`: `.figure-row` of `.figure` (`span.figure-label`, `span.figure-value`, toned
  as above). A section's own figures; never a second tiles row.
- `statTiles(tiles, options?)`: the page's one tiles row. `tiles` are `{ label, value, hint?, tone? }`
  (`tone`: `pass | fail | warn | neutral`). `.tiles` > `.tile` > `span.tile-label`,
  `span.tile-value`, `span.tile-hint` (cut at two lines). `options.lead` makes the first tile
  `.tile--lead` (two columns, the accent rule); `options.capped` adds `.tiles--capped` (the lead
  no bigger than a card's price, the others 4 under it: Find a deal); `options.panel` still renders
  `.tiles--panel` and changes nothing. A pass or fail tile is `.tile--pass` or `.tile--fail` on its
  tint, its label led by `svg.glyph`. Phone: two a row, the lead and an odd last tile full width.
- `verdictBanner({ tone, title, text, figures?, example? })`: `div.verdict.verdict--{pass|fail|neutral}`
  with `role="status"`, `span.verdict-word` (`title`), `p.verdict-text`, and `figures` as a
  `figureRow` at the right. `example: true` adds `.verdict--example`, drops the role and the rates.
- `drawnState(caption, body)`: `.drawn-state` > `span.state-caption` + `body`; for an example verdict
  or an empty state drawn under the page. Two side by side: wrap them in `div.pair`.
- `emptyState(sentence, link?)`: `div.empty` with the sentence and, when given, `a.empty-link`
  (`{ label, href }`, a phrase with no closing period, 44 px tall). Every empty state has its link.
- `dayStrip({ days, legend? })`: `days` are `{ day, tone, title }` oldest first (`tone`:
  `pass | fail | none`), at most the newest 30 kept. `div.day-strip` with `role="img"` and an
  `aria-label` of the counts; `.day-strip-days` of `span.day.day--{tone}` with `title` as the
  tooltip; `.day-strip-dates` (first and last `day`); `.day-strip-legend` of `.day-strip-key`.
  `legend` names the three outcomes in the page's words (default Pass, Fail, No data). When the first
  and the last day are the same, `.day-strip-dates` holds one `span`, not two.
- `columnChart({ peakText, bars, axisStart, axisEnd })`: one column per day, oldest left (`bars` are
  `{ title, share }`, `share` 0..1 setting the column's height, `title` its tooltip). `div.column-chart`
  > `p.column-chart-peak` (`peakText`, "Peak 1,284 on 21 Sep"), `.column-chart-bars` of
  `span.column-chart-bar`, `.column-chart-axis` (`axisStart`, `axisEnd`: "1 Sep", "30 Sep, so far").
  All four strings are given pre-formatted, as `dayStrip`'s day text is.
- `rankRow({ rank, href, title, optionTitle?, cells, promo? })`: one ranked row, exactly the
  markup the walkthrough parses: `<div class="rank-row" data-rank="N"><span class="rank-no">N</span>
  <span class="rank-deal"><a href="…">title</a><span class="table-option">…</span>[promoLine]</span>`
  then one element per cell: `original` `<s data-label="…">`, `pay` `span.rank-pay`, `save`
  `span.rank-save`, `bar` `<span data-label="…">` around `savingBar(pct)` (`pct` 0..100, or the
  number in `text`), `text` `<span data-label="…">`. The label is the cell's `label`.
- `rankList({ head, rows, title? })`: a `.box` with `h3.box-title`, then
  `.rank-list[data-cols=N]` (`N` = `head.length`) holding `.rank-head` (the column heads, "#" first)
  and the rows. Six columns is Top deals' grid; four (`#, Deal, You
  pay, Gap`) is Price truth's gap rows. Phone: each row a labelled list, except Top deals' six-column
  rows (`data-cols="6"`), two lines under the title: "You pay" beside the struck original, then "You
  save" beside the bar and its percent, neither "Original" nor "Saved" repeated as a label.
- `savingBar(sharePct)`: `.saving` > `.saving-track` > `.saving-fill` (width the rounded percent) and
  `.saving-text` ("43.6 %").
- `podiumCard({ rank, href, title, optionTitle, imageUrl?, payText, originalText, saveText, sharePct,
  promo?, winner?, label? })`: `article.podium-card[data-rank]` (`.podium-card--winner` for rank 1),
  `img.podium-photo` or `span.podium-mono` (the monogram), `span.podium-rank`, `.podium-body` with
  `a.podium-title` (holding `span.card-cover`: the whole card is the link),
  `span.podium-option`, the promo line, `.podium-price` (`span.price-label` "You pay", `span.podium-pay`,
  `s.podium-original`) and the save pill (`.podium-save.save-pill`). The winner's pill is filled;
  `label` (the tile that names the deal, "Biggest saving") leads it. Wrap three in `div.podium`.
- `savePill({ saveText, sharePct, label?, best? })`: `span.save-pill` (`inline-flex`, `flex-wrap:wrap`),
  holding, when `label` is given, `span.save-pill-label` ("Biggest saving · ") then always
  `span.save-pill-amount[data-label="You save"]` ("You save $61.00 · 43.6 %" as plain text). Each span
  is `white-space:nowrap`, so the pill wraps only between the label and the saving, never inside
  either; `best` or `label` fills it (`.save-pill--best`).
- `promoLine({ code, priceText })`: `span.promo-line`, "Type code FALL at Groupon checkout to pay
  $376.20." (or "Groupon may offer $376.20 at checkout." without a code), drawn under the deal that
  carries the promo by `rankRow`, `podiumCard`, `dealCard` (with a rank) and the deal page's option
  rows. The promo price appears only inside it. There is no footnote list any more.
- `pageFoot(text)`: `div.page-foot` > `p.freshness`, the page's refresh line.
- `monogram(title)`: the photo fallback letter (after a leading "Up to N% Off on").
- `glyph(tone)`: `svg.glyph`, the check, cross or dash in `currentColor`.
- `CARD_COVER`: the `span.card-cover` a card's title link holds.

### Older blocks, kept for every page

- `section({ title, lead?, body, id? })`: the white card section (`.section`, `.section-head`,
  `h2.section-title`, `p.section-lead`). Checkout still uses it; rebuilt pages use `pageSection`.
- `dataTable(head, rows, options?)`: `div.table-wrap` > `table.table.data-table`; every `td` carries
  `data-label` (its column head), so the phone draws each row as a labelled list led by its first
  cell. `options.numeric` marks columns `.num` (mono, right, one line). No rows, no output. In a box
  it sits flush and drops its last rule.
- `badge(text, tone, options?)`: `span.badge.badge--{pass|fail|warn|neutral|strong}`, led by its
  glyph unless `options.glyph` is false. `strong` is a blocker.
- `button({ label, href?, type?, tone?, rel? })`: `a.btn` or `button.btn`; `.btn--secondary`.
- `formField(...)`, `selectField(...)`: the boxed `.field` (`.field-label`, input or select;
  `.field--wide|medium|narrow`). Never `type="password"`.
- `sortToggle({ options, current, hrefFor })`: `nav.sort` of links, the current one
  `aria-current="true"`. Put it with the word "Sort" in `div.sort-wrap` (`<span>Sort</span>` first).
- `optionRow`, `optionList`, `breadcrumb`, `twoColumn`, `voucherRow`, `histogram`, `shareBar`,
  `checkRows`, `findingCard` (`.finding-card--{blocker|major|minor}`), `findingList`, `pill`: as
  before; restyled to the boards where they changed.
- `latencyBars(rows)`: `div.latency` > `.latency-legend` (two `.latency-swatch` keys), a `.histogram`
  whose tracks hold `.histogram-back` (p95) behind `.histogram-bar` (p50), the value
  "524 · 3,723 ms", and `.latency-axis` in whole seconds (0 to 4 s at least, five ticks at most).
  Each half of "check · step" is a nowrap `.latency-half`. Rows show in the order given; past eight,
  `details.latency-more` with the summary "Show all N steps" holds the rest.

## `card.ts`: the deal card

- `dealCard(card, options?)`: `article.card` > `img.card-image` or `div.card-image.card-image--mono`
  (the monogram), `.card-body` > `.card-head` (`a.card-title` to `/deals/<id>` holding
  `span.card-cover`, `span.card-option`, `span.card-location` "City, ST", the promo line) and
  `.card-buy` (`.price-row` with `span.price-label` "You pay", `span.price-pay`, `s.price-list` the
  original when it is higher; then the save pill computed from `listPriceMinor` and `payMinor`,
  none when they are equal). With `options.rank` a promo is the promo line under the location, the
  promo price only inside it; without it the card keeps the inline `promoNote`. `options.label` fills
  the pill ("Cheapest"). Phone: the compact card, an 88 px photo left.
- `dealGrid(cards, { labelFor? })`: `div.grid` of cards numbered from 1 (`labelFor(card, rank)` gives a card its save pill label).

## `price.ts`

- `priceBlock(card, size?)` (`.price`, `.price-row`, `.price-label`, `.price-pay`, `.price-list`,
  `.price--large` for the deal page) and `promoNote(promo)` (`.promo`, `.promo-icon`,
  `.promo-text`). The promo price appears only inside `promo.instruction`.

## Page-level classes

A page may put these on its own markup, and no other class:

- `.pair`: two drawn states side by side, ending on one line; stacked on the phone.
- `.sort-wrap`: the word "Sort" and a `sortToggle`.
- `.table-wrap`, `.num`: around and inside a hand-built `table.table`; it scrolls sideways.
- `.form-row`: a row of `formField`s.
- `.pill-row`: a row of `pill()`s.
- `.lead`, `.eyebrow`: a lead sentence or an eyebrow outside `hero`.
- `.freshness`: a muted line of when numbers refresh.
- `.toned.toned--pass`, `.toned.toned--fail`: a figure in the pass or fail ink.
- Kept for pages not rebuilt this round: `.top-deals-hero`, `.ranked` (with `.rank`, `.pay`,
  `.city`, `data-label`), `.table-option`, `.promo-line`, `.results-head`, `.picker-card`,
  `.picker-sentence`, `.picker-note`, `.section-title--rule`, `.sort-wrap-label`, `.page-foot`,
  `.podium`, `.rank-list`, `.rank-head`, `.rank-row`, `.pin`. Rebuilt pages reach these through
  the blocks above.
