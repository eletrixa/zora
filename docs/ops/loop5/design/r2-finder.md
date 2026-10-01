<!-- Module: docs/ops/loop5/design/r2-finder.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Find a deal, loop 5 round 2 -->
# Round 2: Find a deal

## Scores

| Lens | Score |
|---|---|
| CEO | 2 |
| Phone (390 px) | 2 |
| Craft (against LANGUAGE.md) | 4 |
| Consistency (whole board set, this page's issues) | 4 |
| **Judge, this page** | **2** |

Round 1 closed out all eight requested changes: the ribbon is gone, the compact phone price row holds
one line in both looks, the picker breaks after City on every board, the category is named once, the
promo marker has a real tap target, the refresh wording matches the rest of the site, the tile hint
clamp moved into `common.tiles`, and the footnote gap sentence is in place. That work shows: Craft and
Consistency both read the page as close to the brief now.

But CEO and Phone, reading the live boards rather than the component list, each catch a different
structural break. I checked both against the code (`design/gen/common.py`) rather than taking either on
faith:

- `deal_card` has no cover link. LANGUAGE.md's own text for this part says "title (the link; its
  `::after` covers the card so the whole card is the link)," but the function only wraps the title text
  in an `<a>`; there is no `position: relative` on the `<article>` and no `::after` anywhere in
  `deal_card`. This is not a matter of taste, it is the page's own written spec not being built.
- `tiles()`'s lead figure is capped against a podium winner's price, and Find a deal has no podium, so
  the cap never fires. Checked at every size the page uses: lab desktop 36 vs. a 30 px card price, lab
  phone 30 vs. 26, pixel desktop 32 vs. 28; only pixel phone ties at 24. LANGUAGE.md's own binding rule
  says "a saving never takes the display face," and on this page it does, at three of four sizes.
- The "Promo codes" tile reads "5 of 9" while the footnote list under the grid carries six numbered
  entries (1, 2, 4, 5, 7, 8), because footnote 5 has no code to type and still wears a "promo 5" marker.
  CEO and Craft both catch this independently.

Two of those are the page's own written rules not holding on the built boards (the cover link, the lead
tile cap), which is the "two or more structural changes" bar this review has used all along, so the page
stays at a 2 despite the higher single-lens craft and consistency reads. The remaining issues (the pill's
wrap point, the quiet strip, the city line, the hero lead length, the picker's ragged left edge) are real
but are each one part, one fix, not a second structural break.

## Ranked changes for round 3

1. **Make the whole deal card a tap target, in both looks and every width**
   Why: Phone (high). LANGUAGE.md's own "Deal card" entry says the title's `::after` covers the card so
   the whole card is the link; `promo_marker` already reserves `z-index: 1` to sit "above the card's
   cover link," which only makes sense if a cover link exists. It does not: only the title text opens
   the deal. On a 390 px phone the 88 px photo and the option/city lines sit right beside the title and
   look tappable but are not, on every one of the four Finder boards (this is a `deal_card` bug, so it
   hits Top deals and the podium too).
   How: in `common.deal_card` (`design/gen/common.py`), give the `<article>` `position: relative` and
   add a full-cover anchor: either make the title's own `<a>` carry `::after { content: ""; position:
   absolute; inset: 0 }`, or add one documented stretched-link element in the article. Keep `promo_marker`
   and any "Get checkout link" button above it with `position: relative; z-index: 1` so they still take
   their own taps. This is a `common.py` change; record it in `design/gen/requests/finder.md`.

2. **Cap the lead tile at the page's own biggest price when there is no podium**
   Why: Phone (high), and it is LANGUAGE.md's own binding rule: "a saving never takes the display face."
   Find a deal has no podium, so `tiles()`'s existing cap (against the podium winner's price) never
   applies, and the "Biggest saving $59.00" lead outsizes every "You pay" price on the page at three of
   four board sizes (confirmed in `common.py`: lab 36 vs. 30, lab phone 30 vs. 26, pixel 32 vs. 28).
   This has been asked for once already (`design/gen/requests/finder.md`, "tiles: cap the lead figure
   at the page's biggest price to pay when the page has no podium") and is still unbuilt.
   How: in `common.tiles`, when the caller has no podium, pass the page's own biggest price-to-pay as
   the cap (a `max_size` or similar parameter `finder.py` supplies) instead of leaving the lead at its
   full default size. `common.py` change; keep the existing request in `finder.md`, it is not closed.

3. **Make the "Promo codes" tile and the footnote list agree, every time**
   Why: CEO (high) and Craft (medium) both flag this from different angles: six cards carry a "promo N"
   marker and the footnote list has six entries, but the tile says "5 of 9" because footnote 5 (no code,
   "Groupon may offer $60.05 at checkout") is not a code. A reader who counts markers gets six, the tile
   says five, and the CEO demo is exactly the moment a number mismatch like this gets noticed first.
   How: in `design/gen/finder.py`, either give the no-code, automatic-price case a different marker (not
   "promo N", so it is not counted as a footnote in the tile's figure) and keep the tile's count, label
   and hint strictly to redeemable codes, or change the tile to state a figure that covers both footnote
   forms ("6 of 9 carry a note" or similar) so the tile, the markers and the footnote count always match.
   Prefer the first: it keeps "Promo codes" meaning what it says.

4. **Fix the save pill's wrap point once, in the shared part**
   Why: Phone (medium) and Consistency agree: on Finder's desktop card 2 (both looks) and on
   FinderPixelPhone, the pill breaks between "You save $X ·" and the percent, leaving "30.4 %" or
   "17.5 %" alone on its own line; the lab Finder phone gets the right break, after the label. This is
   already logged in `finder.md` ("save_pill (with a label): ... finder.md leaves it as common draws
   it") and unbuilt; `save_pill` joins three independently-wrapping parts with a plain " · ", so the
   break point is unpredictable by board.
   How: in `common.save_pill`, draw two nowrap groups instead of three loose parts: the label alone,
   then "You save $X · Y %" as one nowrap unit. The only break point becomes the one after the label,
   matching the lab Finder phone board on every look and width.

5. **Make the pixel quiet strip read as restrained chrome, not a second skyline**
   Why: CEO (medium). `design-unified.md` reserves the full skyline for the home page and calls every
   other page's strip "quiet... 24 tall, no windows." Checked in `common.skyline`: the `quiet=True`
   branch drops the windows but still tiles the full header width with 15 to 20+ randomly sized blocks
   (20 to 36 wide, 8 to 20 tall). At a glance Find a deal still shows the same building-block motif as
   Top deals, which works against the one thing this loop is meant to fix: a unified site where the
   skyline is the home page's signature, not decoration repeated on every page.
   How: in `common.skyline`'s `quiet` branch, drop the per-block random widths and heights and draw a
   flat, undecorated band (the ground fill plus the existing 2 px `--line` rule), or cut it to two or
   three low, uniform blocks so it reads as texture rather than a second skyline. This is shared by
   every non-home page, so record it as a request rather than hand-editing Finder's boards.

6. **Drop the city line on Find a deal, to match Top deals**
   Why: Consistency. Every Find a deal card prints "Chicago, IL" under its option; Top deals' podium
   cards use the same `deal_card` and print no city, because both lists are already scoped to one city.
   Showing the city here and not there is exactly the kind of divergence the whole-site consistency pass
   is meant to catch, and it is a one-line fix.
   How: in `design/gen/finder.py`, stop passing `city` into each card dict when the query names a real
   city (keep it only for the "anywhere" case, the same rule Top deals already follows). No `common.py`
   change: `deal_card` already renders the city line only `if d.get("city")`.

7. **Cut the hero lead to two sentences**
   Why: Craft (medium). LANGUAGE.md section 6 caps the hero lead at one or two sentences; Finder's lead
   runs three ("Search Groupon deals in plain words..." / "Every card shows the price you pay..." / "A
   promo code, where one exists, is a footnote."). The promo marker and the footnote list already show
   that a code is a footnote, so the page states it twice.
   How: in `design/gen/finder.py`, drop the third sentence from the hero lead, keeping the first two.

8. **Line up the phone picker's four word labels on one left edge**
   Why: Phone (medium), already logged and unbuilt (`finder.md`, "picker (phone): set the words in one
   column as wide as the widest word"). "Find," "in," "for" and "under" each render at their own text
   width today, so the slot after each word starts at a different x on the 390 px board, reading ragged
   under a thumb.
   How: in `common.picker`'s phone branch, give the word label a fixed `min-width` equal to its widest
   member ("under") so every slot lines up in one column. `common.py` change; keep the existing request.

Dropped from this round's critic notes: the cheapest tile's mid-word hint clip ("...tailore…", Craft,
low) and the typed-field-vs-dropdown cue on the phone picker (Phone, low) are real but are single-lens,
low-severity, and each a smaller fix than the eight above; carry them in `finder.md` for a later round
rather than spend one of the eight ranked slots on them this round.

## Designer's response, round 3

All eight changes are in the round 3 boards. One is done by the judge's second route, not the preferred
one; that part is declined below with the reason. `finder.py` no longer patches any common output: the
Deal link rewrite, the filled empty state and the nowrap link phrase are gone.

1. **Whole card a tap target: done.** `common.deal_card` now draws the cover (a stretched span in the
   title link, the article `position: relative`). Checked in the browser, not only in the code: a tap on
   the photo corner and on the card foot opens the Deal board of the same look and width on Finder and
   FinderPixelPhone, and the "promo 1" marker keeps its own tap, 46 px tall.
2. **Lead tile capped at the card price: done.** `finder.py` passes `cap=c.price_size(theme, phone,
   compact=phone)`. The lead now matches the card price and never passes it: lab 30 (the others 26),
   pixel 28 (24), lab phone 26 (22), pixel phone 24 (20).
3. **Promo codes tile agrees with the markers and the list: done, by the second route.** The tile counts
   the cards that carry a marker, and those are exactly the sentences in the list: 6 markers, 6 footnotes,
   "6 of 9". The Armitage card now carries the sentence the live page shows today ("Type code RELAX at
   Groupon checkout to pay $60.05. Without it you pay $65.99."). The no code sentence was made up for the
   board in round 1 and is gone. *Declined:* a second marker for a note with no code. LANGUAGE.md has one
   promo marker and one footnote list, and a second marker would be two components for one job. LANGUAGE.md
   now also says the tile counts exactly the markers and the list. The no code wording is still a real
   case in `src/shopping/index.ts`, so the question of its label is logged in `design/gen/requests/finder.md`
   for the language step.
4. **Save pill breaks after the label: done** in `common.save_pill`. Seen on all four boards: "Biggest
   saving ·" sits over "You save $59.00 · 30.4 %", "Cheapest ·" breaks the same way on the phones, and no
   percent is left alone on a line.
5. **Quiet strip: done** in `common.skyline`. Both pixel boards show a flat 24 px band with the 2 px
   rule, and no buildings.
6. **City line dropped: done.** `finder.py` gives each card a city only when the query is "anywhere"
   (`SPANS_CITIES`). The head already says "in Chicago, IL".
7. **Hero lead in two sentences: done.** The promo sentence is gone. The markers and the footnotes already
   say where a code goes.
8. **Phone picker words in one column: done** in `common.picker`. On both phone boards, Find, in, for
   and under share one column and the four slots start at one x.

The two items the judge dropped stay as they are. The Cheapest hint still ends in an ellipsis, because
the two line clamp is the language rule and a hint names its deal by the full title. The typed field
still shows no chevron: it is a typed slot, and the missing chevron is the cue.

The round also brought two smaller changes. The first empty state's link is now "Search "massage"
anywhere, any price", one unit of 36 characters. The second empty state uses the site's words ("the
full load runs Mondays at 05:00 UTC"). Heights were measured again: Finder 2488, FinderPixel 2605,
FinderPhone 4525, FinderPixelPhone 4879.
