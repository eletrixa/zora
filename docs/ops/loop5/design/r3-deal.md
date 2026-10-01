<!-- Module: docs/ops/loop5/design/r3-deal.md · Tested: n/a · Judge merge of the CEO, phone and craft critics and the consistency critic on the Deal page, loop 5 round 3 -->

# Round 3: Deal page

## Scores

| Critic | Lens | Score |
|---|---|---|
| CEO | One product to show; does the page say what it is, for whom, today's numbers; is the pixel look a real second look | 4 |
| Phone | Shopper on a phone at 390 px: reading order, thumb usability, price as the biggest figure | 4 |
| Craft | Design craft against LANGUAGE.md | 4 |
| Consistency | The whole five-page set | 4 |
| **Judge (this file)** | **Settled against the four boards and the code** | **4** |

All four critics converged on 4 without seeing each other's notes, and the boards back that up: nothing
here is a structural break like round 1's, and none of round 2's eight fixes have regressed. What is left
is six real, narrow items. The worst is the unavailable option's price line, because it is the one place
a fast CEO read could land on the wrong number in the Options section; the rest are quick, low-risk
craft and consistency cleanups. None of it is enough to pull the page below what all three independent
lenses already agreed on, so this settles at 4.

## Ranked changes for round 4

1. **Mute the unavailable option's price line before its "Not available" text**
   Why: CEO lens, medium severity, the page's single worst issue. The Three Adults row prints "You pay
   $210.00 $597.00, You save $387.00 · 64.8 %" in the same ink and `--save` tone as the three purchasable
   rows, with "Not available right now" only underneath in muted gray. A fast scan reads an actionable
   price before it reads the state that makes it unbuyable. Confirmed on all four boards and in
   `option_row` (`design/gen/common.py`, the price line at line 1966): the `not o.get("sellable", True)`
   branch only changes the action slot, never the price line above it.
   How: In `option_row`, when `not o.get("sellable", True)`, render that row's "You pay" figure and its
   "You save … · …" text in `t["muted"]` instead of `t["ink"]` and `t["save"]` (the struck original is
   already muted). Same row, same numbers, just the plain gray treatment "Not available right now"
   already gets, so the eye reads "can't act on this" before it reads a figure.

2. **Give the breadcrumb's leaf its own, muted look**
   Why: craft lens, medium severity. `design/gen/deal.py` line 125 builds
   `path = [("Find a deal", finder), (CATEGORY, finder), (LABEL, finder)]`: all three segments carry the
   same href and the same `--action` link color on every board, so "Find a deal / Things To Do / Tours"
   reads as three equal links with nothing marking where the reader is. `common.py`'s `breadcrumb()`
   already renders a muted, non-link span whenever a segment's href is `None` (line 1869); deal.py just
   never uses it.
   How: Change the leaf entry to `(LABEL, None)`, i.e.
   `path = [("Find a deal", finder), (CATEGORY, finder), (LABEL, None)]`. No change to `common.py` needed.

3. **Give the empty state's next-step link a real 44 px thumb target**
   Why: phone lens, medium severity. The two "When …" panels near the foot each end in an underlined
   link ("Compare the options", "Read the terms"). `empty_state()` (`common.py` line 1842) wraps it as
   `display: inline-block`, so it renders at its plain line height, well under the 44 px round 1 already
   won for the page's other links (`text_link`, the breadcrumb). A thumb can miss it or catch the
   sentence above it instead.
   How: In `empty_state()`, wrap that link the way `text_link` already does: `display: inline-flex;
   align-items: center; min-height: 44px`, keeping it one unit that drops to its own line rather than
   breaking inside, as LANGUAGE.md already asks.

4. **Add one more pixel h1 size step for the longest phone titles**
   Why: CEO and phone lenses together, both low severity, same root cause. At the 116-character live
   title, Press Start 2P's 18 px phone step still wraps to 7 all-caps lines before the lead sentence, and
   the buy box price lands at roughly y≈710 against y≈610 for the same title in lab. The price still
   makes the first screen, but seven lines of blocky caps is a long runway for a demo, and pixel is
   giving back part of round 2's "buy box before the photo" win. Lab and the desktop pixel board show no
   equivalent problem, so this is phone, pixel only.
   How: In `common.py`'s `h1()` (line 447), add a second, longer threshold (about 90 characters) that
   only applies to the pixel phone branch, stepping its size from 18px to 16px past it (keep the existing
   60-character step and the lab sizes unchanged).

5. **Let the Price history table sit flush with its own card, like Options and Locations**
   Why: consistency critic. `design/gen/deal.py`'s Price history card is drawn with
   `pad="12px 24px 8px"` (line 174) and `data_table`'s cells add their own 12 px padding on top
   (`common.py` line 1430), so "OPTION" and the option names start 12 px further right than the Options,
   Locations and About cards, which use the default 24 px card padding with nothing under it.
   How: Give `data_table`'s desktop `<th>`/`<td>` padding flush outer edges (no left padding on the first
   column, no right padding on the last), then drop deal.py's custom `pad=` argument on the Price history
   card so it takes the same default padding as its neighbors, matching the Scorecard tables and the Top
   deals rank card.

6. **Match the phone drawn-states gap to the rest of the site**
   Why: consistency critic, low severity. `design/gen/deal.py` line 173 stacks the two empty states on
   the phone with `c.stack(empties, gap=16)`; Find a deal, Price truth and Scorecard all stack their own
   phone drawn states at gap 20 (`finder.py` line 161, `price_truth.py` line 219, `scorecard.py` line
   201).
   How: Change that call to `c.stack(empties, gap=20)`.

Nothing here contradicts the brief or LANGUAGE.md; all six extend rules the page, or its sibling pages,
already follow. Nothing was dropped.
