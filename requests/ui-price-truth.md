<!--
Shared-file changes lane ui-price-truth needs but cannot make itself, with what the integrator did.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-price-truth.md
Deps:    n/a
Tested:  n/a
-->
# Requests from ui-price-truth

## app.css: a dedicated 6-column grid for the gap rank list (nice to have, not blocking)

What: a `.rank-list[data-cols="6"]` rule in `public/static/app.css` sized for Price truth's
"Largest gaps" list (money, money, percent-with-bar, a short code), instead of reusing the bare
default grid (`44px minmax(0,1fr) 110px 120px 120px 150px`), which was sized for Top deals' six
columns (`#, Deal, Original, You pay, You save, Saved`).

Why: `src/ui/pages/price-truth.tsx`'s gap rows need four cells beyond rank and deal: You pay
(retail), With code (the promo price), Gap (the percent, with a bar) and Code (the raw code or
"no code"), per `docs/lanes/ui-price-truth.md`, so the row is six columns wide. `src/ui/components/
README.md` names the gap rows as a four-column list (`#, Deal, You pay, Gap`), which only fits two
cells per row; it does not say where "With code" and "Code" go, and `WorstGapDeal` carries no
instruction sentence to hang them off a promo footnote the way Top deals does. I built the row with
`rankRow`/`rankList` at six columns, which renders correctly through the shared grid (I did not add
a class), but the three right-hand columns (With code, Gap, Code) sit at Top deals' widths, tuned
for a bar and two money figures, not money + a percent bar + a short code string.

Until this lands, the page works and every test passes; this is a column-width polish, not a defect.

**Integrator, 2026-10-01: left open.** `data-cols="6"` is also the Top deals grid, so a rule keyed on it would
change Top deals as well. It needs a modifier on `rankList` (the components lane) and widths read off
the Price truth board at 1280 px; it goes to the next loop round with the screenshots, as polish.

**Lane, 2026-10-01: moot.** Round 2 of loop 5 drops "With code" and "Code" from the gap rows (rule 2:
the promo price is never shown as a price), so Largest gaps is back to the four-column grid
(`#, Deal, You pay, Gap`) `README.md` already names. This request can be closed; the row width is the
default `rankList` grid.

## histogram(): format `value` with thousands separators

What: `histogram(bars)` in `src/ui/components/blocks.ts` renders `bar.value` with a plain
`String(bar.value)`. Give it thousands separators (`toLocaleString("en-US")`, matching every other
count on the page), or widen `HistogramBar.value` to accept a pre-formatted string so a page can
format it itself.

Why: `docs/ops/loop5/design/r3-price_truth.md`'s round 2 fix list flags the Options-by-gap histogram's
raw counts (5139, 14239, 95401 instead of 5,142, 95,570, ...) against `PriceTruth.png`. `blocks.ts` is
frozen to this lane, and `HistogramBar.value: number` cannot hold a comma-formatted string, so the page
cannot fix this on its own. Everything else that fix asked for (the raw snapshot timestamp, the History
table's unformatted counts) is gone in this round, since the sentence that showed the timestamp and the
History table itself were both dropped; this is the one spot still blocked on a shared file.

Until this lands, the histogram's bars and bands are correct, just not comma-grouped; every other count
on the page (tiles, figure rows, the 30-day aggregates, the largest-gaps money) already is.

## hero(): a way to bold a word or two inside `lead`

What: `hero({ eyebrow, title, lead, aside })` in `src/ui/components/blocks.ts` always escapes `lead` as
plain text (`<p class="lead">${esc(lead)}</p>`). `PriceTruth.png`'s hero bolds the two count phrases in
its lead ("...the price the cart charges: **20 of 20** carts. groupon.com showed the same price on
**59 of 59** listing pages."). A `lead` that takes `{ text, strong?: string[] }` (or a small set of
`<strong>`-only inline parts, still escaped) would let a page do this without hand-building the hero.

Why: `verdictOf(report).text` is plain prose today, and the hero's lead has to stay plain text to render
through this block, so round 2's "the lead says today's verdict with the counts in bold" is done for
content and placement but not for the bold styling.

Until this lands, the lead carries the same sentence as `verdictOf`, unbolded; the banner (which does
take `figures`) is unaffected.

**Integrator, 2026-10-01: both done.** `histogram()` prints its counts with `toLocaleString("en-US")` (95,401).
`hero()` takes `lead: string | { text, strong? }` and bolds each `strong` phrase where it first appears, escaped;
pass `{ text: verdict.text, strong: ["20 of 20", "59 of 59"] }` to bold the counts.

## bin/walkthrough.ts: the "Largest gaps" check is now stale

What: the price truth check (`await check("the price truth page has today's numbers in all four
sections", ...)`) asserts `expect(/Largest gaps/.test(html), "no worst-deals section")`. Round 3's
board (`design/project/PriceTruth.dc.html`, `docs/ops/loop5/design/r3-price_truth.md`) titles the box
"The 8 largest gaps" (sentence case, capped at 8 rows, not 50), per `docs/ops/loop5.md` Round 2 item 9
and the round 3 fix brief item 3. "Largest gaps" (capital L) no longer appears anywhere on the page.

Why: `bin/walkthrough.ts` is shared (not in `ui-price-truth`'s `owns` list), so I cannot edit it myself.

Ask: loosen the regex to match the new wording, case insensitive, e.g.
`expect(/largest gaps/i.test(html), "no worst-deals section")`. The same check's other assertions
(`carry a promo code`, `median`, the fresh-day and freshness checks) are unaffected.

Until this lands: the walkthrough's price-truth check fails on the "no worst-deals section" line; both
test gates (`bun test`, `bun run typecheck`) and `bun bin/lane-check.ts ui-price-truth` are green, and
`test/ui/pages/price-truth.test.tsx` asserts the new title directly.

**Integrator, 2026-10-01 (round 3): done.** `bin/walkthrough.ts` checks `/largest gaps/i`.

## test/app/pages.test.ts: the sync-figures parity test needs the Scorecard's matching round 2 change

What: CEO review round 2, row 3 moves Price truth's "Last delta sync" value to `syncFacts(sync,
now).lastDeltaAt` (the stamp alone) and prints `lastDeltaNote` (open, failed or late) as its own
`<p>` line under the card's rows, instead of the whole sentence in one `<dd>`. The round's brief says
"The Scorecard does the same, so `test/app/pages.test.ts` keeps holding the two pages to one figure."
`src/ui/pages/scorecard.tsx` is owned by lane `ui-scorecard`, not this lane, and still prints
`facts.lastDelta` (the combined sentence) in its "Last delta sync" `<dd>`.

Why: until `ui-scorecard` makes the matching change, `test/app/pages.test.ts`'s "sync facts on Price
truth and the Scorecard" describe block fails on its two cases with an open run in the window (a
failed run, a late window): it reads each page's `<dt>Last delta sync</dt><dd>…</dd>` with one regex
and expects the two strings equal, and Price truth's `<dd>` is now the stamp alone while the
Scorecard's still carries the full sentence.

Until this lands: `bun run typecheck` and `bun bin/lane-check.ts ui-price-truth` are green;
`bun test test/ui/pages/price-truth.test.tsx` is green (this lane's own suite, extended with the
round 2 cases); the full `bun test` has exactly these two known, cross-lane failures, both in
`test/app/pages.test.ts`, both closed by `ui-scorecard`'s own round 2 item 3. Nothing else regresses.

**Integrator, 2026-10-01 (review round 2): done.** Both lanes landed the split; `test/app/pages.test.ts` holds the two `<dd>` stamps equal and the state line under the rows equal.
