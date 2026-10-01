<!-- Module: design/gen/requests/top_deals.md · Tested: n/a · Shared parts the Top deals boards drew in design/gen/top_deals.py, for the language step to fold into common.py -->
# Requests from top_deals, round 1

- `footnotes(columns=2)`: a long promo list (20 of 20 today, one site wide code) fills a screen in one column; the desktop wants two columns, and CSS columns need a block `<ol>` where the helper draws a flex list (drawn as `footnotes_columns`). **declined**: r1-top_deals change 5 keeps one column on every page (in pixel every item wraps in two columns anyway). Folded instead: `footnotes(collapsed=True)`, the "Show all 20 promo codes" disclosure for the phone.
- `rank_rows(phone=True)`: "You save" shares the price line and wraps only when the figures are long, so rows alternate between two rhythms; put it at the start of the bar line on every row (drawn as `phone_rank_rows`). **folded: `rank_rows`** (phone: "You pay" on the price line, "You save" opening the bar line, "N % saved", per change 4).
- `deal_card` and `podium_card` monogram: take the title's first letter, never a digit, since a "2" beside the rank badge "2" reads as a second rank (drawn as `letter()` passed in `d["letter"]`). **folded: `monogram`** (skips a leading "Up to N% Off" and any word that starts with a figure; `deal_card` uses it when `letter` is not given).
- `foot`: keep an ISO stamp on one line with a nowrap span, since the phone breaks "2026-09-30T20:23:41Z" at its first hyphen (drawn by passing `raw(...)`). **folded: `moment(ago, iso)`**.
- `tiles` labels: Silkscreen 11 wraps past about 18 characters at a fifth of the desktop row and at half the phone row, so tile labels stay short in both looks ("Total saving", not "Saved across the top 20"). **folded: LANGUAGE.md rule** (a tile label is at most 16 characters); `tiles` prints a build note past that.
- `empty_state(small=True)`: the empty state drawn under a page's content wants a max width (760 on the desktop) so it reads as a note, not as a section (drawn as `small()`). **folded: `empty_state(small=True)`** (the default: 760 at most on the desktop).

## Also in common.py for round 2 (from r1-top_deals.md)

- Change 1: lab picker slots are 44 tall on both widths; the switch segments are 44 tall hit boxes.
- Change 2: the photo fallback is quiet and follows the slot (28 lab and 24 pixel at 150; 40 and 36 at 200).
- Change 6: the lab lead tile figure is 36 (phone 30), and `tiles` sets no pixel lead in Press Start 2P by default.
- Change 8a: the podium winner's pill no longer says "Best deal"; pass `label` in the deal dict when a tile names it.

# Requests from top_deals, round 2

- `rank_rows(phone=True)` bar line: "You save $304.00" and the bar with "40.0 % saved" need about 309 px where a 390 row leaves 282, so the bar always wraps under "You save" and every ranked row runs to four lines (drawn as is, not overridden); keep it to three by dropping " saved" on the phone, or by a 56 px bar there. **folded: `rank_rows`** (the phone bar line ends in the bare percent, gap 8; a 56 px bar still left 293 px for 282, so " saved" went).

## Also in common.py for round 3 (from r2-top_deals.md)

- Change 1: `empty_state(fill=True)` with `columns(..., stretch=True)` ends two states on one line.
- Change 2: `picker` pairs a phone slot with a word of 8 characters at most; give the lead phrase as `("word", "Top 20 deals"), ("word", "in")`, and the desktop joins them back into "Top 20 deals in" (the same markup as today).
- Change 3: `save_pill` breaks after the label only; the saving and its percent stay together.

# Requests from top_deals, round 3

- No new part: every part of the four boards comes from common.py (`empty_state(fill=True)`, the split picker words, the one-unit save pill all landed).
- LANGUAGE.md section 6, the Top deals sentence: now "Top 20 deals in [City] for [Category] within [Tag] **Show**", since every slot has a word (r2 change 2) and the label "Tag" names the list where "Within it" would repeat the word.
