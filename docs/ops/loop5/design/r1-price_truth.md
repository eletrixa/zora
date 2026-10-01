<!-- Module: docs/ops/loop5/design/r1-price_truth.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Price truth, loop 5 round 1, and the designer's response in round 2 -->
# Round 1: Price truth

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 3 |
| Craft (against LANGUAGE.md) | 3 |
| Consistency (whole ten-board set) | 3 |
| **Judge, this page** | **3** |

The three single-lens scores sit close (CEO 4, Phone 3, Craft 3) and the whole-set consistency check
lands at 3 too. Measuring the boards directly changes what those scores should weigh. Two of Craft's
three findings, the lead tile's figure size and the rule that follows from it, do not hold up: pixel
measurement of both desktop boards shows the lead tile's figure is already about a quarter larger than
its siblings in both looks, matching LANGUAGE.md's 40/32 and 32/28 ratios almost exactly, so that
recommendation is dropped. Craft's third finding, the squashed pixel skyline strip, does hold up, but
under the consistency critic's diagnosis rather than Craft's own: measured pixel by pixel it is the
correct quiet strip, compressed by a missing `flex-shrink: 0`, not the wrong skyline variant. Combined
with a confirmed high-severity mobile bug (three of eight Largest gaps rows, and their promo codes,
silently missing on phone) and a confirmed cross-page clock contradiction, the page has two genuine
structural defects to clear before a side-by-side demo is safe. That keeps it at 3 rather than the
CEO's 4, even though the core structure, one verdict, the tiles, the sections, is sound.

## Ranked changes for round 2

1. **Show all 8 Largest gaps ranks on phone, with their promo codes**
   Why: Phone (high) and CEO (medium) both flag this. Confirmed in code, `design/gen/price_truth.py`
   line 208 reads `worst = WORST[:5] if phone else WORST`, and confirmed in the rendered board: the
   phone "Promo codes" list jumps from footnote 5 straight into the Freshness section, so codes 6
   (EXCEL35), 7 (WINE) and 8 (FALL) are not just trimmed from view, they are entirely absent from the
   phone page. On a page whose whole point is full disclosure of the worst gaps, a mobile reader sees
   an apparently complete ranked list that is missing three of the eight worst-gap deals and their codes.
   How: drop the `[:5] if phone` cap and pass the full `WORST` list on phone too; `gap_rows` already has
   a compact two-line phone layout, the same one Top deals uses for ranks 4 to 20, so all 8 rows fit. If
   a cap is ever needed again, add a visible "Showing N of 8" line and a link to the rest instead of
   truncating silently.

2. **Give the pixel quiet strip its full 24 px on Price truth, desktop and phone**
   Why: Craft (high) read the desktop strip as the wrong, Top-deals-style skyline competing with the
   MATCHED banner. Measuring the actual pixels settles it differently: `header(..., strip="auto")`
   already resolves to "quiet" on this page, so the correct variant is already selected. The bug is that
   it is squashed, exactly as the consistency critic found: the desktop strip runs from row 74 to 89 (15
   px, 9 short of the spec's 24), and the phone strip runs from row 108 to 109 (1 px, 23 short), against
   Finder's and Scorecard's correct 74 to 98 and 108 to 132 on the same boards. The compressed blocks
   still show their roof borders, so they read as a busier skyline than intended, which is what put
   Craft on the wrong diagnosis; the real defect is the squeeze, not the content.
   How: in `design/gen/common.py`'s `skyline()`, add `flex-shrink: 0` to the strip's own returned style;
   it is currently the one child of the fixed-height board column without it, so it absorbs the
   shortfall. Then raise the PriceTruthPixel and PriceTruthPixelPhone board heights, wherever the shot
   generator sets them, by 9 and 23 px so the strip no longer needs to shrink.

3. **Mark the sample MISMATCHED banner as an example, not a second verdict**
   Why: CEO (medium). The "When a cart or a page disagrees" MISMATCHED banner reuses `c.verdict()` at
   full size and full weight, identical to the real MATCHED banner at the top, just recoloured. A fast
   scroll or a cropped screenshot of the CEO's one-product demo can land on it and read it as today's
   answer, which undercuts the page's single point: read the verdict, done.
   How: in `design/gen/price_truth.py`, around the `fail = c.verdict(...)` and `fail_block` lines, add a
   small "Example" pill on the banner itself, built the way `sample_pill()` already is, next to the
   existing `state_caption`; or scale the banner down (shorter, narrower, lower contrast) relative to the
   live one. Keep the "When a cart or a page disagrees" caption as is, it is correct, just not loud
   enough on its own to stop the banner reading as real.

4. **Align Price truth's sample clock with the rest of the site**
   Why: Consistency (whole-set score 3). Top deals and Scorecard both read from the same sample moment,
   23:23 UTC on 30 Sep, with the next delta sync at 00:00 UTC (`design/gen/scorecard.py` states the
   boards are "read at 23:23 UTC like the other loop 5 boards"). Price truth instead says "3 delta syncs
   so far, the next at 09:00 UTC" twice, which places it between 06:00 and 09:00 UTC, hours out of step
   with the other two tabs open in the same demo.
   How: in `design/gen/price_truth.py`, change the tile hint (line 178) and the Freshness note (line
   224) to "8 delta syncs so far, the next at 00:00 UTC" and "...The next delta sync runs at 00:00 UTC."
   (syncs at 00:00, 03:00, ... 21:00 give 8 completed by 23:23). The full fix is one shared sample clock
   in `common.py` that every page reads from, per the consistency critic; this page can correct its own
   two lines now without waiting on that.

5. **Give every non-zero histogram bar a minimum visible width on phone**
   Why: Phone (medium). In "Options by gap," the 30 to 35 %, 35 to 40 % and over 40 % bands (633, 3 and
   17 against a 95,570 max) render at 0 to 1 px on the 390 px board. Confirmed in the board: the 35 to
   40 % and over 40 % bars are not visible at all, only their numbers are, so a thumb-scrolling reader
   cannot see those bands have any data.
   How: in `common.histogram`'s bar width calculation, floor every non-zero value's rendered width at 3
   to 4 px independent of the linear scale.

6. **Stop repeating "Median gap 20.0 %" as two different tiles**
   Why: Consistency. The top tiles row and the Promo gap section both show "Median gap 20.0 %," so the
   page's one lead-tile slot spends itself on a number the reader already saw two sections earlier
   instead of adding information.
   How: in the top tiles call in `design/gen/price_truth.py` (near line 178), replace the "Median gap"
   tile with a figure no other tile on the page shows, for example "Days matched, 30 days: 28 of 30,"
   taken from the cart strip's own day count.

7. **Make the lab look's "good news" tiles read as clearly as the pixel look's**
   Why: CEO (low). "Carts matched" and "Pages matched" use `--pass` (`#1F4FBF`) in lab, a blue close
   enough in hue and weight to the page's own `--figure` indigo (`#2B2D6E`) that the two pass tiles
   barely stand out from the two neutral ones beside them. Confirmed side by side: the pixel look's mint
   green against cream pops instantly, the lab pair does not.
   How: lighten lab `--pass` further from `#2B2D6E`, keeping the 4.5:1 contrast the tokens table already
   documents, or give passing tiles the small pass glyph `badge` already uses elsewhere, so lab and pixel
   carry the same visual confidence for the same data.

8. **Explain the Freshness chart's Monday spikes in its own note**
   Why: CEO (low). The four tallest bars in "Price changes per day, last 30 days" (7, 14, 21, 28 Sep) are
   the weekly full-catalogue loads, not delta-sync anomalies. The generator already knows this, a code
   comment at `design/gen/price_truth.py` line 43 says Mondays "follow the weekly full load," but the
   on-page note only says "Price changes the delta sync picked up, per day," so a reader sees unexplained
   spikes.
   How: append one clause to the Freshness section note: "Price changes the delta sync picked up, per
   day; Mondays include the weekly full load, so the count runs higher." Combine with change 4's clock
   fix in the same edit.

## Designer's response, round 2

1. **All 8 Largest gaps on the phone: done.** The `[:5]` cap is gone; the phone boards show ranks 1 to 8 and all 8 promo sentences, as on the desktop.
2. **The quiet strip at its full 24 px: done.** `skyline` has `flex-shrink: 0` in common.py, and every board height is now the measured content height, so the strip keeps 24 px and nothing clips (3509 and 5865 on the pixel boards).
3. **The MISMATCHED sample reads as an example: done, the language's way.** The banner uses `verdict(..., example=True)`: a size down (lab 28, pixel Silkscreen 20 instead of Press Start 2P), no live region, under its caption "When a cart or a page disagrees". I did not add a second "Example" pill: LANGUAGE.md settled this form for both report pages, and the page keeps one sample pill.
4. **One sample clock: done.** Every time comes from `common.CLOCK` (30 Sep, 23:23 UTC): "8 delta syncs so far, the next at 00:00 UTC", and today's changes are 781, a full Wednesday, not the 337 of a morning.
5. **Non-zero histogram bars stay visible: done** by common.py (at least 4 px); the 35 to 40 % and over 40 % bands now show on the phone.
6. **No second "Median gap" tile: done.** The top row's fourth tile is now "Since a mismatch: 8 days" (last on 22 Sep, 2 of 61 pages), not "Days matched 28 of 30". A streak answers the CEO's question, "how long has it held", and it does not mix missing samples with mismatches.
7. **Pass tiles read as pass in lab: done through the glyph.** Each toned tile carries the check beside its label (common.py), so the tone no longer rests on the blue alone. I left the lab `--pass` token as it is: a token is the language step's call, not one page's.
8. **The Monday spikes explained: done.** The Freshness note says "Mondays run higher: the weekly full load lands at 05:00 UTC."

Also changed this round:

- The verdict sentence gives the 30-day counts behind the rates: "No cart and no page disagreed with the API today. In 30 days: 1 of 580 carts, 2 of 1,599 pages." The last-disagreement date moved to the new tile.
- Freshness now has the shared two-card form: the day bars beside a 320 card "Next sync: 00:00 UTC" (delta sync every 3 hours, last at 21:00 UTC, 8 today, last full load Mon 28 Sep, "In 37 minutes"), so the brief's "next delta sync" is a figure, not a clause in a note.
- Both comparison sections use the shared `strip_cards`, with a title on every square ("19 Sep: Mismatched").
- The empty state no longer sends the reader to another product: "Before the first cart sample", with "See the promo gap" as the next step on this page (the promo gap snapshot runs after the catalogue load, before the first cart sample).
- Pixel day bars end on whole segments, with no stub line on top.
- The tile label "Price changes today" (19 characters) became "Changes today".
