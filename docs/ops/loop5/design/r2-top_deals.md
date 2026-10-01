<!-- Module: docs/ops/loop5/design/r2-top_deals.md · Tested: n/a · Judge merge of the consistency critic's findings on Top deals, the home page, loop 5 round 2 (no per-lens critics supplied this round) -->
# Round 2: Top deals, the home page

## Scores

| Lens | Score |
|---|---|
| CEO | not supplied this round |
| Phone (390 px) | not supplied this round |
| Craft (against LANGUAGE.md) | not supplied this round |
| Consistency (whole board set) | 4 |
| **Judge, this page** | **4** |

No CEO, phone or craft critic ran on this page this round. The consistency critic scored the whole
board set a 4 and raised three findings against this page, all of them contained: a shared pill that
breaks a figure from its percent on the phone, a phone picker where two of three slots lose their
connecting word, and the two drawn states below the results list, one of them a dead end with no next
step. None of the three touches the page's structure (hero, picker, tiles, podium, ranks, foot all sit
where LANGUAGE.md puts them, confirmed against both desktop boards) and none breaks the rule that only
the skin should change between looks; each is a one- or two-line fix in a shared helper or the page's
own parts list. That keeps the page at a 4: real, worded fixes, not structural change.

## Ranked changes for round 3

1. **Give the two drawn states one height, and a next step for the category-walk state**
   Why: Consistency critic, medium-high, and the only one of the three findings with a real product
   gap, not just a reading rhythm. A shopper who opens the page before tonight's 00:30 UTC category
   walk reads "Categories appear after the first category walk... The city list is ready." and has
   nowhere to go; "When nothing matches" right beside it ends in a working link. The mismatched heights
   are the one place on the page where the two-column drawn-state layout does not read as one component,
   which a reviewer scanning the whole site in one sitting notices immediately next to Find a deal's
   matching pair.
   How: `empties()` in `design/gen/top_deals.py` (lines 145-158) calls `c.columns([none_found, no_walk],
   "repeat(2, minmax(0, 1fr))", gap=20)` with no `stretch=True`; `columns()` in
   `design/gen/common.py` (line 209) already supports it. Finder already hit the same gap and filed it
   as an open request (`design/gen/requests/finder.md`, "`empty_state`: a `fill=True` that lets the
   panel grow to its row"); until that lands in `common.py`, reuse Finder's own local `filled()` pattern
   (`design/gen/finder.py`, `filled()`) in `top_deals.py` so this does not wait on a second page's fix,
   and pass `stretch=True` once it does. Give `no_walk` a link the way `none_found` already has one:
   `c.empty_state(theme, "Before the first category walk", "Categories appear after the first category
   walk, tonight at 00:30 UTC. The city list is ready.", link=("Pick another city", "#"), phone=phone)`,
   pointing at the picker above it, worded as a phrase with no closing period per LANGUAGE.md.

2. **Give every phone picker slot a word on its own row, City and Within it included**
   Why: Consistency critic, medium. Confirmed on the lab phone board: "Top 20 deals in" sits alone as a
   headline, then "City" and "New York, NY" sit on their own row below with no connecting word; "for"
   correctly pairs with "Things To Do", but "Within it" carries only its small field label next to "any
   tag", never a flowing word. Find a deal's phone picker puts every word beside its slot ("Find
   [massage]", "in [Chicago, IL]", "for [Beauty & Spas]", "under [$150.00]"); a shopper skimming Top
   deals' picker on a phone has to re-parse two un-cued rows where Find a deal reads straight through.
   How: In `design/gen/top_deals.py`'s `body()` (lines 176-178) the parts list is `[("word", "Top 20
   deals in"), ("select", "City", PLACE), ("word", "for"), ("select", "Category", CATEGORY), ("select",
   "Within it", TAG)]`. `picker()`'s phone loop (`design/gen/common.py`, the word-then-next-part row
   builder around lines 599-613) always folds a "word" part into the row of the part right after it, so
   "Top 20 deals in" only pairs with City when the combined text fits the 358 px row; it does not, so
   the pair wraps apart while the shorter "for" and Category stay together. Split the lead phrase into
   `("word", "Top 20 deals")` then `("word", "in")` placed right before `("select", "City", PLACE)`, so
   "Top 20 deals" alone clears its row and "in" pairs with City the way "for" already pairs with
   Category. Give the third slot the word it is missing: add `("word", "Within it")` right before
   `("select", "Within it", TAG)`, so it reads at the big picker-word size beside "any tag" instead of
   only at the small field-label size above it; drop the select's own field-label text so "Within it" is
   said once, not twice, on the phone row.

3. **Give the podium's filled save pill one unbreakable "You save … · …%" group**
   Why: Consistency critic, medium. Confirmed on the lab phone board: the winner's pill wraps mid
   figure, "Biggest saving · You save $594.00 ·" ending one line and "60.0 %" sitting alone on the next;
   the fix's own note that the Deal phone option row shares the pattern means it is worth fixing once,
   in the shared helper. A shopper reading a phone deal card gets a beat of confusion from a lone percent
   sign with nothing in front of it.
   How: `save_pill()` in `design/gen/common.py` (lines 999-1009) builds `bits = ([label] if label else
   []) + [f"You save {save}", pct]` and joins every bit, label included, as its own `white-space: nowrap`
   span, so the browser is free to break between the saving figure and its percent. Keep the label (when
   present) as its own breakable unit, but put "You save {save}" and the percent inside one shared nowrap
   span: `text = raw((f'<span style="white-space: nowrap">{esc(label)}</span> · ' if label else '') +
   f'<span style="white-space: nowrap">You save {esc(save)} · {esc(pct)}</span>')`. That lets a narrow
   pill break after the label only, never between a saving and its own percent, matching the lab
   Finder phone's pill. `save_pill` is common.py's, so route the change through
   `design/gen/requests/top_deals.md`.

Dropped: nothing. All three findings are contained, one- or two-line fixes that reuse a pattern already
built for another page (Finder's `filled()`, Finder's word-per-slot rhythm, the lab Finder phone pill),
so none of them contradicts the brief or LANGUAGE.md's one-arrangement-per-page rule.

## Designer's response, round 3

1. **The two drawn states: one height, and a next step for the walk state.** Done, with a different link.
   Both states now take `empty_state(..., fill=True)` in `columns(..., stretch=True)` and end on one line in
   both looks. The walk state has its link, but not "Pick another city": declined as worded, because
   before the first walk the live page draws no picker at all (`src/ui/pages/top-deals.tsx` replaces it
   with the empty state), and the walk tags every city at once, so no other city could answer either. The
   true next step is the time the list appears, worded the way Find a deal words its own ("Search again
   after the Monday load"): "Show the top 20 after the walk". The sentence is now the live one word for
   word, "Categories appear after the first category walk, tonight at 00:30 UTC."; "The city list is
   ready." is gone, since in that state no city can be picked and it promised a step the page cannot give.
2. **A word beside every phone picker slot.** Done. The lead phrase is two words, "Top 20 deals" and "in",
   so the phone pairs "in" with City and the desktop still reads "Top 20 deals in". The third slot has its
   word too, but "within", not "Within it": LANGUAGE.md now gives a phone row to a word of 8 characters at
   most, and "Within it" (9) would have sat alone again. I kept a label over the slot, as over City and
   Category, since it is the select's name for a screen reader, and renamed it "Tag" so the row does not
   say "within" twice. The desktop reads "Top 20 deals in [New York, NY] for [Things To Do] within [any
   tag] Show" on one line in both looks, and the picker note now says what a tag does. The builders rename
   the live label "Within it" to "Tag" and add the word (noted in `design/gen/requests/top_deals.md`).
3. **The save pill keeps a saving with its percent.** Done in common.py by the language step. The lab
   phone winner now reads "Biggest saving ·" over "You save $594.00 · 60.0 %"; the pixel phone fits it on
   one line.

Also changed, from LANGUAGE.md as consolidated: the lead is two sentences. "A promo code, where one exists,
is a footnote." is gone, since the language says a lead never repeats what the markers and the footnotes
already show. Heights were measured again (TopDeals 3501, TopDealsPixel 3715, TopDealsPhone 6015,
TopDealsPixelPhone 6479); every board is exactly as wide as stated.
