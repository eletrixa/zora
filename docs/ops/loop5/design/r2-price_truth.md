<!-- Module: docs/ops/loop5/design/r2-price_truth.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Price truth, loop 5 round 2, with the designer's response for round 3 -->
# Round 2: Price truth

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 3 |
| Consistency (whole board set) | 4 |
| **Judge, this page** | **4** |

Two lenses land on 4, craft lands on 3, and the whole-set consistency check lands on 4. Craft's low
score rests almost entirely on one confirmed high-severity finding: a second `tiles()` call inside the
Promo gap section, which LANGUAGE.md's section 6 rules out by name. That is a real defect, but it is
narrow, one block moved from one place to another, not a flaw spread across the page. Reading the four
boards directly also confirms a second, independent problem CEO and craft both caught from different
angles: the example MISMATCHED banner prints the exact same 99.8 % and 99.9 % rate figures as the real
MATCHED banner above it, a leftover from round 1's fix that only shrank the banner without touching the
numbers inside it. Phone adds two real mobile issues (the promo codes list open and duplicated, a date
on the "Since a mismatch" tile that looks inconsistent with the cart section below it) and the
consistency critic adds three small cross-page drifts on this page alone (the foot line, the Freshness
weekday, the lone empty state's width). None of these breaks the page; every number checks out and the
structure (verdict, tiles, sections, drawn states, foot) is sound. Given this round's own brief is to
unify the site, the consistency drifts carry more weight than their size alone suggests, which keeps the
page at 4 rather than the clean 5 its data and content otherwise earn.

## Ranked changes for round 3

1. **Fold the Promo gap tiles into a figure row, not a second tiles block**
   Why: Craft (high). LANGUAGE.md section 6 is explicit: the tiles row "comes right after the picker or
   the verdict and before the first section... it never sits inside a result section, and every report
   page... has one." Confirmed in `design/gen/price_truth.py`: `gap_tiles = c.tiles(theme, [...],
   lead=False, phone=phone)` sits inside `c.stack([gap_tiles, hist, ranked], ...)`, the body of the
   "Promo gap" section, while the page's one tiles row already sits between the verdict and "Catalogue
   against cart." Two tile panels on one page reopens the exact pattern the language rules out, on the
   very round asked to unify the site's structure.
   How: Delete the `gap_tiles = c.tiles(...)` call and its place in the stack. Render the four numbers
   (Sellable options, With a code, Median gap, 90th percentile) with `c.figure()` in a flex row instead,
   the same pattern `verdict()` already uses for its rates (`display: flex; gap: 28px`, wrapping on
   phone), placed under the section's note and above the "Options by gap" histogram card. Every figure
   stays on the page; only the tile-panel styling mid-section goes.

2. **Stop the example MISMATCHED banner from repeating the live banner's own rates**
   Why: CEO (medium) and craft (medium) both flag this, from a demo-trust angle and a build-hygiene
   angle. Confirmed in code: the live `verdict = c.verdict(theme, "pass", "Matched", ..., figures=rates,
   ...)` call and the example `fail = c.verdict(theme, "fail", "Mismatched", ..., figures=rates, ...,
   example=True)` call pass the same `rates` tuple, so "Carts, 30 days 99.8 %" and "Pages, 30 days
   99.9 %" print identically in both banners, on all four boards. A CEO scrolling fast during a live demo
   can land on the second banner and read it as today's answer.
   How: Drop `figures=rates` from the `fail = c.verdict(...)` call; `verdict()` already defaults
   `figures=()`, so the example keeps only its one sentence with the day's own counts (1 of 20 carts, 2
   of 61 pages) and has no numbers left to mistake for today's rates. If that still reads too close to
   the live banner's weight, give the example state its own lower-contrast tint in `verdict()`'s
   `example=True` branch, distinct from both `pass_tint` and `fail_tint`, without reopening round 1's
   decision against a second pill.

3. **Collapse the promo codes footnote on the phone, as Top deals already does**
   Why: Phone (medium). The 8-row "The 8 largest gaps" list and the "Promo codes" ordered list under it
   repeat the same 8 deals, title and You-pay price, back to back, about 900 px of mostly repeated
   reading on the narrowest board. LANGUAGE.md defines `footnotes(collapsed=True)` for exactly this, and
   `design/gen/top_deals.py` already passes `collapsed=phone`; `price_truth.py`'s own footnotes call
   leaves `collapsed` at its default `False`.
   How: Add `collapsed=phone` to the `c.footnotes(...)` call in `design/gen/price_truth.py`, matching
   `top_deals.py`. The 8 rows still show on the phone, round 1's fix stays; only the footnote sentences
   fold behind "Show all 8 promo codes," and the markers still link straight into it.

4. **Make the "Since a mismatch" tile self-explanatory against the cart section below it**
   Why: Phone (medium). The tile reads "8 days, Last on 22 Sep: 2 of 61 pages," the more recent of two
   different streaks. Two sections down, "Catalogue against cart" states a cart last mismatched on 19
   Sep, 11 days ago. A reader scrolling top to bottom hits the shorter number first and has to do mental
   math to square it with the longer one, on the one page whose whole point is price trust.
   How: Change the "Since a mismatch" hint in the top tiles call from "Last on 22 Sep: 2 of 61 pages" to
   a line naming both dates, "Page: 22 Sep, Cart: 19 Sep," so the figure explains itself in the order the
   page is read. Leave the label as is; it already sits at the 17-character mark LANGUAGE.md's
   16-character guidance flags, and a longer rename would only make that worse.

5. **End the foot line with the clause every other page carries**
   Why: Consistency. `price_truth.py`'s foot text reads "Carts and the promo gap refresh daily at
   04:30 UTC, groupon.com pages at 06:00 UTC, price changes every 3 hours," and stops there. Every other
   page's `FOOT` constant (`top_deals.py`, `finder.py`, `deal.py`, `scorecard.py`) ends its first
   sentence with "the next delta sync runs at 00:00 UTC." In a demo that tabs between pages, the one page
   missing this clause reads unfinished next to the other three.
   How: Append "; the next delta sync runs at 00:00 UTC" to the foot text in `price_truth.py`, right
   after "price changes every 3 hours."

6. **Drop the weekday from Freshness, as no other page uses one**
   Why: Consistency. Freshness reads "Peak 1,284 on Mon 21 Sep" (the `peak=` string in `price_truth.py`
   builds in the word "Mon" itself) and "Last full load Mon 28 Sep" (the sync table builds in "Mon" the
   same way). Scorecard writes "28 Sep, 05:00 UTC" and Deal writes "the last on 28 Sep," neither with a
   weekday. The section's own note already says Mondays run higher, so the weekday on the date adds
   nothing but an inconsistent date format next to the rest of the site.
   How: Drop the manual "Mon " text from the `peak=f"Peak {peak:,} on Mon {peak_day}"` line and from the
   sync table's `f"Mon {CLOCK['last_full_load'].split(',')[0]}"` line in `price_truth.py`, so both read
   "21 Sep" and "28 Sep" like the rest of the site.

7. **Give the lone empty state the shared panel width, and keep its link on one line**
   Why: Consistency. Price truth's "Before the first cart sample" panel stands alone in a vertical stack
   and takes the full 760 px small-panel width, against the 574 px half column every other page's empty
   panel uses when paired with a peer (Top deals, Find a deal, Deal). At 760 its own link wraps on the
   desktop board, "See the" breaking onto its own line before "promo gap." Top deals keeps a similar link
   on one line with a page-local `white-space: nowrap` span; Price truth has none.
   How: Give the panel the same 574 px measure the paired empty states use elsewhere, for example by
   setting it in a left cell of that width rather than relying on the 760 px default meant for a lone
   stacked panel. Wrap "See the promo gap" in a `white-space: nowrap` span the way `top_deals.py` already
   wraps its own empty-state link, so the phrase never breaks mid-sentence.

8. **Replace "in the catalogue copy" with plain words**
   Why: CEO (low). To an outside reader "copy" first reads as marketing copy, not as a snapshot of the
   catalogue data. AGENTS.md's own writing rule asks for plain words on every board.
   How: Change the "Sellable options" tile hint in `price_truth.py` from "in the catalogue copy" to "in
   today's catalogue."

## Designer's response, round 3

1. **Promo gap tiles into a figure row: done.** The second `tiles()` call is gone. The four numbers
   (Sellable options, With a code, Median gap, 90th percentile) stand in `c.figure_row` on the ground,
   under the section note and above "Options by gap". Their old hints moved into one card note at the
   foot of the histogram: "144,772 of 154,038 sellable options in today's catalogue carry a code. Half
   of those codes take off 20.0 % or more, one in ten 29.8 % or more." On the phone `figure_row` wrapped
   three and one, so the page sets the four figures two by two there (`figure_pairs`, one line in
   `design/gen/requests/price_truth.md`).
2. **No rates on the example MISMATCHED banner: done.** The example passes no figures; its sentence
   keeps the day's own counts (1 of 20 carts, 2 of 61 pages). It keeps the fail tint: the caption over
   it, the smaller word and, in pixel, Silkscreen instead of Press Start 2P already set it apart, and
   LANGUAGE.md now asks for nothing more. The example is wrapped in `c.drawn_state`, the one wrapper
   for every drawn state.
3. **Promo codes folded on the phone: done.** `footnotes(..., collapsed=phone)`, as on Top deals. All 8
   gap rows stay on the phone; the sentences sit behind "Show all 8 promo codes".
4. **"Since a mismatch" names both dates: done, in plainer words.** The hint reads "Pages last on
   22 Sep, carts on 19 Sep", so the 8 days explain themselves against the cart section below. The label
   stays.
5. **Foot line ends with the delta sync clause: done.** "... price changes every 3 hours; the next delta
   sync runs at 00:00 UTC."
6. **No weekday in Freshness: done.** "Peak 1,284 on 21 Sep". The sync card is now `c.sync_card`, which
   writes "Last full load 28 Sep" with no weekday, the same card Scorecard uses.
7. **Empty state width and link: link done, width declined.** The link is one unit now: common's
   `empty_state` moves "See the promo gap" whole to its own line on the lab desktop and keeps it on one
   line in pixel. The 574 width is declined: LANGUAGE.md section 6 (consolidated between rounds) sets a
   lone state at most 760 wide, and Scorecard draws the same pair (an example verdict over one empty
   state) at 760. A 574 panel here would make the two report pages differ, which is the drift this
   change meant to remove.
8. **"in the catalogue copy" in plain words: done.** The words are "in today's catalogue", now in the
   histogram's card note, since the figure row has no hints.

Also this round: every part comes from `common.py` (`section(anchor=...)`, `day_bars` snapping its own
pixel segments, `sync_card`, `drawn_state`); the page's own copies (`anchored`, `bar_shares`, the hand
built sync table) are removed. The verdict sentence now reads "In 30 days, 1 of 580 carts and 2 of
1,599 pages did.", so the counts say what they count. Heights fit the content on all four boards
(lab 3371, pixel 3465, phone 5054 and 5275); scroll width equals the board width on each.
