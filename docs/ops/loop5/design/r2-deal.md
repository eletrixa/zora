<!-- Module: docs/ops/loop5/design/r2-deal.md · Tested: n/a · Loop 5 round 2 judge verdict for the Deal page, merging the CEO and craft critics and the consistency critic into ranked changes for round 3 -->

# Round 2: Deal page

## Scores

| Critic | Lens | Score |
|---|---|---|
| CEO | Does the page say what it is, for whom, today's numbers; is the pixel look a real second look; would I show this | 4 |
| Phone | Shopper on a phone at 390 px | not scored this round (no phone-lens entry came back; not carried forward as a number) |
| Craft | Design craft against LANGUAGE.md | 4 |
| Consistency | The whole five-page set | 4 |
| **Judge (this file)** | **Settled against the four boards and the code** | **4** |

Round 1's structural breaks are gone: the h1 survives the live 116-character title, the duplicate
option and button are merged into "In the box above", the switch and secondary tap targets carry real
44 px boxes, and the photo fallback is quiet. What is left is narrower but still real: the Options
section note flatly contradicts the row directly under it, two different "no button" states render as
the same gray text, the option row's price breaks the type scale, and three small wording and spacing
choices drift from the other four pages. None of that is structural, which is why this settles at 4 and
not lower; the note contradiction is the one item that could pull it to 3 if left in, because it is the
first thing a CEO reads in the section and it reads wrong in two seconds.

One craft item is dropped, not carried to round 3: the pixel lead tile's "$526.00" (32 px Plex Mono) set
beside the buy box's "$79.00" (28 px Press Start 2P). Looking at DealPixel.png directly, the buy box
figure wins the eye by a wide margin — accent color, black drop shadow, and Press Start 2P's blocky caps
outweigh four extra points of raw size — and this asymmetry is the one LANGUAGE.md's own type table
sets up on purpose (section 2: "Deal [spends the display figure] on the price to pay in the buy box");
the tile correctly stays at the plain lead size. No change needed.

## Ranked changes for round 3

1. **Make the Options note true of the row right under it**
   Why: CEO lens, high severity, the page's single worst issue. The note reads "Each option has its own
   checkout link," and the very next line, option 1, reads "In the box above" with no link at all — a
   contradiction a CEO hits before finishing the first sentence. It sits on all four boards.
   How: In `design/gen/deal.py`, the `note=` argument of `c.section(theme, "Options", rows, note=...)`
   (line 163). Reword to something true of every row, e.g. "Ordered by the price you pay; the cheapest
   is shown above."

2. **Give "In the box above" and "Not available right now" different treatments**
   Why: CEO lens, medium severity, the same section as #1. Both states render as the same 14px muted
   gray with no icon or color difference (`common.py`'s shared `quiet` span, `option_row`, line 1800),
   so a fast scan cannot tell "you already bought this one above" from "you cannot buy this one at all."
   How: In `design/gen/common.py`'s `option_row` (line ~1801-1804), keep "Not available right now" on
   the existing muted `quiet` style and give "In the box above" its own style, e.g. `--action`/accent
   text or a small check glyph, so the positive state stops reading as a dead end.

3. **Fill the named option's save pill, matching Top deals, Find a deal and LANGUAGE.md**
   Why: consistency critic, and a genuine open item: `design/gen/requests/deal.md` already flags this as
   an exception the designer asked LANGUAGE.md to accept, and LANGUAGE.md still says plainly (section 6,
   Deal card) that the pill is "filled ... on any card a tile names." The stated reason for keeping it
   tinted — that a filled pill "wears the primary button's skin" next to the row's checkout button — does
   not hold on inspection: the row's button is `kind="secondary"`, which `common.py`'s `button()` (line
   540) renders outlined in both looks, never filled. A filled pill next to an outlined button will not
   duplicate anything. Leaving it tinted is the one place a reviewer moving between Deal and the other
   two pages meets a different rule for the same situation.
   How: In `design/gen/deal.py`'s `name_rows` (the function building the row's pill), draw the row
   through `common.option_row(label=...)` calling `save_pill(theme, ..., label=...)` with its normal
   filled state, instead of the string-surgery that keeps it tinted. Retire the round 2 request in
   `requests/deal.md` once this lands, since the exception it asked for is no longer needed.

4. **Bring the option row price back to the type scale**
   Why: craft lens, medium severity. LANGUAGE.md's type table gives "Price to pay, row" as Plex Mono
   600 16 (18 on phone) lab, 700 16 (18 on phone) pixel. `option_row` in `common.py` (line 1797)
   hardcodes `font-weight: 700; font-size: 18px` for every look and width, so lab desktop rows run one
   weight and 2px heavier than spec, pixel desktop rows run 2px bigger than spec, and the Deal page's own
   row price ends up bolder than the same figure on Top deals' rank rows (16px desktop).
   How: In `common.py`'s `option_row` (line 1797), change the hardcoded value to
   `font-weight: {700 if px else 600}; font-size: {18 if phone else 16}px`, matching `rank_rows`'s own
   values exactly. Shared code, so the fix lands wherever `option_row` is used.

5. **Match the Deal page's column gap to the rest of the site**
   Why: consistency critic, medium-low. Every other side-by-side row on the site (podium, strip cards,
   Freshness, Finder grid, Top deals states) uses gap 20; Deal alone uses 28 in three places.
   How: In `design/gen/deal.py`, drop `gap=28` to `gap=20` (or omit it, once `columns`'s default moves
   to 20) at the photo/buy box row (line 155), Locations/About this deal (line 173) and the two empty
   states (line 187).

6. **Build one footnote sentence both Deal and Find a deal use**
   Why: craft and consistency critics independently flagged the same line. LANGUAGE.md section 6 fixes
   the sentence as "Numbers match the list above; deals without a code are left out."; Deal's `SKIPPED`
   constant (`design/gen/deal.py` line 64) instead prints "Numbers match the options above; an option
   without a code is left out." Reasonable wording on its own, but it breaks "same words for the same
   thing" the moment a reviewer reads the two pages back to back.
   How: Give `common.py`'s `footnotes()` a noun parameter, e.g. `footnotes(..., list_word="options",
   item_word="options")` building "Numbers match the {list_word} above; {item_word} without a code are
   left out.", and have Deal and Find a deal each pass their own words. Deal keeps "options"; Find a deal
   keeps "deals" (its current wording already matches LANGUAGE.md's sample sentence).

7. **Write Price history dates the way Scorecard writes them**
   Why: consistency critic, low severity. Deal's `SEEN` column (`design/gen/deal.py`, `HISTORY_HEAD` /
   `HISTORY`, lines 87-91) reads "28 Sep 2026" as a left-aligned Plex Sans lead column; Scorecard's
   Contract drift table sets its date as a mono, right-aligned figure column, per `data_table`'s own
   "numeric" rule (`common.py` line 1293: dates belong in `numeric`).
   How: In `deal.py`, change the `HISTORY` rows' first cell to the numeric form ("2026-09-28" etc.), add
   `0` to the `numeric=(3, 4)` argument at line 175 (becomes `numeric=(0, 3, 4)`), and keep
   `phone_title=1` so the phone row still leads with Option, not the date. Scorecard's own table is out
   of this round's scope and will need the matching change later to finish the pair.

8. **Name the tile's option as "below" so the lead tile and the buy box read as one loop**
   Why: CEO lens, low severity, a cheap win. The lead tile ("Biggest saving $526.00," Four Adults) sits
   right under the buy box ("The cheapest option," $79.00, One Adult): two different headline numbers for
   two different options in the first screenful. The matching Options row already closes the loop for a
   careful reader, but a first scan can read it as two competing answers.
   How: In `design/gen/deal.py`'s `TILES` (line 68), change the lead tile's `hint` from the option title
   alone to the option title plus ", below" (matching the option's own row), so the connection reads on
   the first pass.

Dropped: the pixel lead tile's raw font-size versus the buy box display price (craft, low) — settled by
looking at DealPixel.png directly; see the note above the ranked list.

## Designer's response, round 3

All eight changes are made; none is declined. Checked on the four rebuilt boards (Deal, DealPixel,
DealPhone, DealPixelPhone): scroll width equals the board width, no element past the edge, the fonts of
each look loaded, and each height is the measured content height (2521, 2555, 4254, 4479).

1. **Options note: done.** It reads "Ordered by the price you pay; the cheapest is in the box above.",
   LANGUAGE.md's own sentence, true of every row including the first, which has no button.
2. **Two "no button" states: done** (in `common.option_row`, folded between rounds). "In the box above"
   carries a check in `--action` 600; "Not available right now" stays muted with no button. Both read
   apart on all four boards.
3. **Filled pill on the named option: done.** The Four Adults row shows "Biggest saving · You save
   $526.00 · 66.1 %" filled, beside an outlined secondary button; `common.option_row` draws it from the
   option's label. deal.py's `name_rows` is gone and the round 2 request is marked folded.
4. **Row price on the type scale: done** (in `common.option_row`): Plex Mono 16 (phone 18), 600 lab,
   700 pixel, as `rank_rows`.
5. **Gap 20: done.** The three `gap=28` are removed (photo and buy box, Locations and About this deal,
   the two drawn states); `columns` defaults to 20.
6. **One footnote sentence: done.** deal.py drops its own sentence and passes
   `footnotes(noun="options")`: "Numbers match the list above; options without a code are left out."
7. **History dates as figures: done, in a slightly different form.** Dates read "2026-09-28" in a
   right aligned mono column, as asked. I did not keep the date as the first column (`numeric=(0, 3,
   4)`): LANGUAGE.md says a date in a table is never a lead column, and Scorecard's Contract drift leads
   with the kind and sets Seen as its first figure column. So the row is now Option, What changed, Seen,
   From, To, with the option taking the spare width; the two tables read alike and the phone list still
   leads with the option.
8. **Tile hint points below: done.** It reads "Two Hour Guided Highlights Tour for Four Adults, in
   Options below", with "in Options below" held on one line so no word is stranded.

Also changed, beyond the list:

- **The dropped craft item, capped after all.** LANGUAGE.md, consolidated between rounds, now states as
  a binding rule that the lead tile is never set larger than the page's biggest price to pay. The pixel
  lead was 32 (phone 24) under a 28 (phone 22) price to pay. The judge's visual reading holds, but the
  rule is written in sizes, so the lead is now capped at the buy box's price (`tiles(cap=...)`): pixel 28
  and 24 for the other tiles (phone 22 and 18). Lab is unchanged, its buy box price (44, phone 36) is
  already above its lead (36, phone 30). The cap sizes live in deal.py for now; `requests/deal.md` asks
  common for them.
- **The two drawn states end on one line**, through `columns(..., stretch=True)` with
  `empty_state(..., fill=True)`, as LANGUAGE.md says for two states side by side.
- **Anchors through `section(anchor=...)`** for "options" and "about", in place of string edits, so the
  "See all 4 options" link and both empty state links land on their section.
- Tile hints keep their phrase whole ("1 not available"), so the pixel and phone tiles break between
  phrases, not inside them.
