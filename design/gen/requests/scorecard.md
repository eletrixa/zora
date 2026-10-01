<!-- Module: design/gen/requests/scorecard.md · Tested: n/a · Shared parts the Scorecard boards drew in design/gen/scorecard.py, for the language step to fold into common.py -->
# Requests from the Scorecard page (round 1)

- `latency_bars` (scorecard `latency_block`): one track with two fills, p50 in `--action` in front and p95 in `--neutral` (pixel: accent over `--accent-shadow`, both segmented) behind, a two-swatch legend and a 0 to 4 s axis; `histogram` draws one share, and latency needs both figures as bars. **folded: `latency_bars`**, built on `histogram(back=, legend=, axis=, stack=)` (r1-scorecard change 5).
- `figure` (scorecard `_figure`, `run_summary`): a small label over a figure with an optional pass or fail tone, for counts beside a strip; nothing in common draws a labelled figure outside a tile or the verdict. **folded: `figure`** (the verdict's rates are drawn with it too).
- `card_note` (scorecard `_note`): the muted line inside a card, with `foot=True` pinning it to the card's bottom; used for "The other 38 steps: 37 passed, 1 skipped." **folded: `card_note`**.
- `check_rows(last_rule=False)` and `data_table(last_rule=False)` (scorecard `_no_last_rule`): rows inside a card end on a rule of their own, a second line just above the card's edge; the board clips it with `clip-path`, a builder uses `:last-child`. **folded: `check_rows(last_rule=False)`** and **`data_table(last_rule=False)`**.
- `columns(stretch=True)` (scorecard `_stretch` and the `flex: 1` on the paired sections): two short sections side by side whose cards fill the row, so both cards end on one line (Failing steps beside Contract drift). **folded: `columns(stretch=True)`** with `section(fill=True)`.
- `check_rows(narrow=True)`: the stacked form (name and badge on one line, the detail under them) inside a half-width card on desktop; today that is `phone=True`, which reads as a phone-only form. **folded: `check_rows(narrow=True)`**.
- `day_strip(titles=...)`: each square carries its date and outcome ("30 Sep: Fail") in a title, as the brief asks for the run strip "with the date". **folded: `day_strip(titles=...)`**.
- `skyline`: add `flex-shrink: 0`; with `overflow: hidden` the quiet strip collapses to 0 px when a board's stated height is a few px short of its content, and `shots.js` then measures a height without the strip. **folded: `skyline`** (`flex-shrink: 0`).

## Also in common.py for round 2 (from r1-scorecard.md)

- Change 2: `strip_cards` is Price truth's strip form (titled count card with a foot note, a 320 wide latest card).
- Change 4: `CLOCK["probe_run"]` and `CLOCK["probe_age"]` are "2026-09-30T04:00:12Z" and "19 hours ago"; `moment(ago, iso)` keeps the stamp on one line.
- Change 5: `latency_bars(..., more=("Show all 29 steps", href))` puts the link in a 44 tall `text_link`.
- Change 6: `verdict` has the fixed 288 word column and `example=True` for the captioned PASS sample.
- Change 7: `empty_state` is 760 wide at most on the desktop by default.
- Change 8: `check_rows` takes a detail as `[("Expected", ...), ("Observed", ...)]`, drawn with `label_line`.

## Round 2

- `data_table(grow=0)` (scorecard `grow_first_column`): the column that takes the spare width, so the right aligned figure columns (Seen, From, To) sit together at the right of a full-width card instead of spreading over 1168 px. **folded: `data_table(grow=0)`** (`grow_first_column` is now redundant).
- `drawn_state(caption, body)` (scorecard `states_block`): a state caption over any drawn example, here the PASS verdict; Price truth and Scorecard both inline the same caption-over-block wrapper that `empty_state` carries for itself. **folded: `drawn_state`** (`empty_state` draws with it; `states_block` can wrap the PASS example in it).
- `data_table` cell tone (scorecard `toned`): a figure in a labelled list set in the pass or fail ink, for "Failed 1" in the "Latest run" card; a cell has no tone today. **folded: `toned`** (`c.toned("1", "fail")`; `data_table` colours the cell itself at line height 1.3, so the row stays as tall as its neighbours; scorecard.py's own `toned` is removed, it shadowed this).

## Also in common.py for round 3 (from r2-scorecard.md)

- Change 1: `sync_card` is the one catalogue sync card, in Price truth's words and clock ("Last delta sync", "Last full load"); `extra=[("Listable deals", "55,805 of 61,477")]` adds the count. It replaces the second `tiles` in Catalogue copy.
- Change 2: `finding_card` gives the status badge its own tone: pass for "Reported" and "Fixed", neutral for "Open" (`status_tone` overrides).
- Change 5: a toned tile takes its tone's tint in both looks (lab fail ink on the fail tint is 4.7:1).
- Change 7: see the `toned` line above. The cause was Plex Mono 600, which sets a 23 px line where 400 sets 18; with the fixed line height the latest run's rows step 24 and 25 px, where they stepped 24 and 29.
- Change 6: `empty_state` keeps its link as one unit; a short link still reads better ("Read the API contract").

## Round 3

- `latency_bars` step label (scorecard `step_label`): each half of "check · step" kept whole, so a long live name ("price-mismatch · current-price", 30 characters) wraps at the dot on the pixel phone, never at the hyphen inside "current-price"; a builder sets `white-space: nowrap` on each half.
