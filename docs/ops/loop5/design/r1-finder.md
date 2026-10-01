<!-- Module: docs/ops/loop5/design/r1-finder.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Find a deal, loop 5 round 1 -->
# Round 1: Find a deal

## Scores

| Lens | Score |
|---|---|
| CEO | 3 |
| Phone (390 px) | 3 |
| Craft (against LANGUAGE.md) | 3 |
| Consistency (whole ten-board set) | 3 |
| **Judge, this page** | **2** |

Each single lens named one structural problem on its own (CEO and Craft both caught the ribbon;
Phone caught the compact price wrap; Craft and Consistency both caught the pixel picker breaking to
a second row) and scored the page 3 in isolation. Read together, the page carries at least three
separate structural problems, not one, and two of them break the rule that only the skin should
change between looks. That is "two or more structural changes," so the page scores 2.

## Ranked changes for round 2

1. **Drop the "tag" ribbon; mark the standout cards with the pill the site already has**
   Why: CEO (high) and Craft (high) both flag the same thing from different angles: the floating
   corner ribbon over the "U" and second "D" cards is a page-local component with no entry in
   LANGUAGE.md, and it does the exact job `save_pill(best=True)` already does for Top deals' podium
   winner. LANGUAGE.md's Never list rules out "two components for one job." Flipping from Top deals to
   Find a deal, a CEO doing the live demo sees a card pattern that belongs to no other page, which is
   the one thing keeping this page from reading as the same product.
   How: in `design/gen/finder.py`, delete `tag()` and `tagged_card()` and the absolute-positioned
   wrapper they put around the photo; call `c.deal_card` / `c.deal_grid` directly as the other grids
   do. Give `common.save_pill`'s `best=True` path an optional label (it is hardcoded to "Best deal"
   today) so the two cards call it with `label="Biggest saving"` and `label="Cheapest"` in place of the
   ribbon text, keeping the winner border/shadow treatment `best=True` already draws. This is a
   `common.py` change, so record it in `requests/finder.md` for the language step.

2. **Fix the pixel compact card's price row wrap on the phone**
   Why: Phone (high): on FinderPixelPhone, the second card's "You pay $135.00" sits on its own line
   with the struck "$194.00" dropped below it, while the identical card and data in FinderPhone (lab)
   hold both on one line. The cause is the Silkscreen "You pay" label: uppercase and blocky, it takes
   much more width at this size than Plex Sans's label does in lab, eating the room the struck price
   needs inside the same 88 px-photo compact layout. The two looks end up with different numbers of
   lines for identical data on a real phone, which is not "only the skin changes."
   How: in `common.deal_card`'s compact branch (`design/gen/common.py`, flagged for the language step
   since it is shared), give the compact price row's pixel "You pay" label less width at this size —
   drop its letter-spacing for this one instance, or stack it above the price/struck row instead of
   inline with them — so the row holds one line in pixel the way it already does in lab. Check it
   against the widest pair in the sample, $135.00 against $194.00.

3. **Make the pixel picker hold one row at 1280, the way Top deals and lab both already do**
   Why: Craft (medium) and Consistency both flag that FinderPixel wraps "UNDER [$150.00] SEARCH" to a
   second row at 1280 while Finder (lab) and TopDealsPixel keep the same kind of sentence on one row.
   `finder.py` narrowed the typed What field from LANGUAGE.md's 220 to 180 specifically so "the
   sentence fits one line at 1280" (`requests/finder.md`), and it works in lab but not in pixel, so the
   field pays the cost (tight for a real typed query like the one in Finder's own empty-state copy)
   without the benefit where it is actually needed.
   How: TopDealsPixel's picker holds one row at 1280 using the shared `c.picker` with no per-field
   width override, so use it as the reference rather than inventing a new width. Before narrowing the
   What field further, trim the pixel-only chrome that is costing the row space: the select's chevron
   padding (`_pick_box`, 36 px right padding) and the sentence's inter-group gap (12 px). Once that
   chrome matches what lets Top deals fit, restore the What field to 220 so it is not the only part
   paying for the fix. If the sentence still cannot hold one row in pixel at 1280, wrap lab at the same
   pair (after "for [Category]") instead of leaving one look single-row and the other double-row.

4. **Stop saying the category twice in two sentences that sit three lines apart**
   Why: CEO (low) but a real "read it twice" moment for someone skimming top to bottom: the picker
   card's note ("Chicago, IL holds 809 listable deals, 451 of them in Beauty & Spas.") and the results
   note ("In Beauty & Spas, under $150.00. Ordered by relevance, the closest match first.") both name
   "Beauty & Spas" within two sentences of each other.
   How: in `design/gen/finder.py`, cut the category clause from `picker_note()` so it reads "Chicago,
   IL holds 809 listable deals. The lists offer the 50 cities with the most deals and Groupon's top
   categories."; keep the category only in `results_note()`, which is the note actually tied to the
   live search.

5. **Give the promo footnote marker a real thumb target**
   Why: Phone (medium): the switch gets an explicit 44 px hit area in LANGUAGE.md, but "promo N" right
   after a card's title gets none on any board. On a 390 px phone a thumb aiming for the footnote can
   as easily land on the card's own cover link instead.
   How: in `common.promo_marker`, add enough padding or line-height around the "promo N" link that its
   tap target reaches close to 44 px, the same floor every other control on the page holds. This is a
   `common.py` change; record it in `requests/finder.md`.

6. **Match the site's wording for the results refresh note**
   Why: Consistency: the results head on Finder says "Prices refresh every 3 hours," while every other
   section head on the site (Price truth Freshness, Scorecard Catalogue copy, Deal's Options and Price
   history) says "Refreshes every 3 hours." Small, but it is the one sentence on the page that reads as
   a different product mid-scroll.
   How: in `design/gen/finder.py`, change the `REFRESH` constant used by the results section to
   "Refreshes every 3 hours," matching `common.refresh_note`'s wording elsewhere. Leave the foot line's
   own sentence as it is; it is prose, not this shared note.

7. **Move the tile-hint truncation rule into the shared tiles part**
   Why: Consistency: the Cheapest tile's hint is cut short with an ellipsis on desktop, the lead hint
   is cut short on FinderPixelPhone, but the same lead hint shows whole on FinderPhone in lab; Top
   deals never cuts a lead hint at all. The truncation only exists because `finder.py` wraps its own
   hint text in a page-local `clamp()`, so it fires unevenly across boards instead of following one
   rule.
   How: fold `finder.clamp`'s two-line, `-webkit-line-clamp` behaviour into `common.tiles` itself (a
   `common.py` change, record it in `requests/finder.md`) so every tile hint on every page clips the
   same way at the same width; remove `finder.clamp` once `tiles` carries the rule.

8. **Explain the gaps in the promo footnote numbering**
   Why: Phone (low): the "Promo codes" list runs 1, 2, 4, 5, 7, 8 because only cards with a code are
   numbered; scrolling a phone fast, that reads as a missing item rather than the intended design.
   How: in `design/gen/finder.py`, add one line under the "Promo codes" heading in `notes_card()`:
   "Only cards with a code are numbered."

## Designer's response, round 2

Every part now comes from `common.py`; `finder.py` keeps two small patches of common output (the Deal link
of a card, the height of a drawn state), each asked for in `design/gen/requests/finder.md`.

1. **Drop the ribbon: done.** `tag()`, `tagged_card()` and the page grid are gone; the cards come from
   `c.deal_grid`. The two cards a tile names carry the tile's label in their filled save pill
   ("Biggest saving · You save $59.00 · 30.4 %", "Cheapest · You save $14.01 · 17.5 %"), through the
   `label` the language step folded into `save_pill`. The pill wraps to two lines in a 375 wide card;
   a cleaner break after the label is asked for in the requests.
2. **Compact price row on the phone: done** (folded into `deal_card`). "You pay" sits on its own line over
   the price and the original in both looks; $135.00 and $194.00 share one line at 390 in lab and pixel.
3. **One picker row in pixel: done another way.** LANGUAGE now rules that the four-slot sentence breaks
   after City in both looks (the `("break",)` part), because a single line is 24 px over in lab and 90 px
   over in pixel even with What at 220. So lab and pixel draw the same two lines, and What is no longer
   narrowed: with the first line free it is 400 wide and holds the empty state's own query, "hot stone
   couples massage", whole. Declined: forcing one row in pixel, since it cannot fit without shrinking the
   slot the judge wanted restored.
4. **Category named once: done.** The picker note reads "Chicago, IL holds 809 listable deals. The lists
   offer the 50 cities with the most deals and Groupon's top categories."; only the results note names
   Beauty & Spas.
5. **Thumb target for the promo marker: done** (folded into `promo_marker`: inline padding 16 by 4, the
   line does not move).
6. **Refresh wording: done.** The results head says "Refreshes every 3 hours"; the foot line keeps its prose.
7. **Hint truncation in the shared tiles: done.** `common.tiles` clamps every hint at two lines;
   `finder.clamp` is gone and the hints pass the full titles.
8. **Explain the numbering gaps: done with the site's shared line.** `common.footnotes` adds "Numbers match
   the list above; deals without a code are left out." whenever the numbers skip. I kept that sentence
   over "Only cards with a code are numbered." so every page says it in the same words.

Also changed this round:

- The Promo codes tile counts only cards whose promo carries a code: 5 of 9, not 6, because footnote 5
  is the no-code sentence ("Groupon may offer $60.05 at checkout.").
- Each drawn state is one sentence and a link phrase. "Before the first catalogue load" no longer sends
  the shopper to the Scorecard (another product); its next step is "Search again after the Monday load".
  The two panels end on one line.
- Every card links to the Deal board of its own look and width.
