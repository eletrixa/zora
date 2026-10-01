<!-- Module: design/gen/requests/price_truth.md · Tested: n/a · Parts design/gen/price_truth.py draws itself (rounds 1 to 3), for the language step to fold into common.py -->
- `gap_rows`: ranked rows with only #, Deal (with the promo marker), You pay and Gap; `rank_rows` fixes Original, You save and Saved, and a WorstGapDeal has no original while its promo price may live only in the footnote sentence. **folded: `gap_rows`** (price_truth.py's copy is removed; the page calls `c.gap_rows`).
- `card_note`: a muted note inside a card (13 lab, mono 12 pixel), with `foot=True` to pin it to the card's bottom edge; no helper draws a note inside a card today. **folded: `card_note`** (price_truth.py's copy is removed; the common one has `margin: 0`, so the phone loses the stray top margin).
- `state_caption`: the caption over a drawn state other than the empty state (the fail verdict here); `empty_state` draws the same caption only for itself. **folded: `state_caption`** (price_truth.py's copy is removed; `empty_state` draws its caption with it).
- `columns(stretch=True)` or cards as direct grid items: `columns` wraps each item in a flex column, so two cards side by side end at different heights; the page uses a bare grid for the strip card and the latest day card. **folded: `columns(stretch=True)`**, and the strip beside the latest day as one shared part, `strip_cards`.
- `data_table(phone=True)` without the rule under its last row: used as the latest day's labelled list inside a card, the last rule reads as a stray line above the card's edge. **folded: `data_table(last_rule=False)`** (`strip_cards` uses it).
- `section_head(phone=True)` fix: the refresh note keeps its desktop baseline padding (11 lab, 14 pixel) on the phone, which adds about 14 px of air between the refresh line and the section body. **folded: `section_head`** (no baseline padding on the phone).

## Also in common.py for round 2 (from r1-price_truth.md)

- Change 2: `skyline` has `flex-shrink: 0`; the strip no longer collapses (raise the board heights so nothing clips).
- Change 3: `verdict(..., example=True)` draws the sample banner a size down, without `role="status"`, and in pixel out of Press Start 2P.
- Change 4: `CLOCK` holds the one sample moment (30 Sep, 23:23 UTC): 8 delta syncs so far, the next at 00:00 UTC.
- Change 5: every histogram bar that is not zero keeps at least 4 px.
- Change 7: a toned tile carries the check or cross glyph beside its label, in both looks.
- The verdict word sits in a fixed 288 column, so the sentence starts at one x on every banner.

## Round 2, drawn in design/gen/price_truth.py

- `side_cards`: a chart card beside a 320 wide card in the grid `strip_cards` uses, for a history that is not a day strip; Freshness pairs its day bars with "Next sync: 00:00 UTC" as a labelled list, so all three measured sections share one form. **folded: `side_cards`** (`strip_cards` draws on it; price_truth.py's own `side_cards` is removed, it shadowed this).
- `day_bars` in pixel should snap each bar to whole 8 px segments (rounding down): today a height that is not a multiple of 8, or a percent rounded up, leaves a faint 1 or 2 px line on top; the page does it in `bar_shares`. **folded: `day_bars`** (whole 8 px segments rounded down, one segment at least for a day that is not zero; `bar_shares` is now redundant).
- `section(..., anchor=)`: a section needs an id so a footnote or an empty state link can point at it ("See the promo gap" goes to `#promo-gap`); the page adds it with `anchored`. **folded: `section(anchor=...)`**.

## Also in common.py for round 3 (from r2-price_truth.md)

- Change 1: `figure_row` sets figures side by side on the ground; the promo gap's four numbers go there, not in a second `tiles`.
- Change 2: LANGUAGE.md now says an example verdict has no rates; `verdict(..., example=True)` still draws whatever figures it is given.
- Change 3: LANGUAGE.md folds the footnotes under a ranked list on the phone (`footnotes(collapsed=phone)`).
- Change 7: `empty_state` keeps its link as one unit (it moves to its own line, never breaks inside); a lone state stays 760 at most.
- Freshness: `sync_card` draws "Next sync: 00:00 UTC" with the schedule, the last delta sync, the syncs today and the last full load, the card the page builds by hand today.

## Round 3, drawn in design/gen/price_truth.py

- `figure_pairs`: `figure_row(phone=True)` wraps where the row runs out, so the promo gap's four figures read three and one at 390; the page sets them in a two column grid on the phone (as the tiles and the verdict's rates sit); a two by two phone default in `figure_row` for four figures would let the page drop it.
