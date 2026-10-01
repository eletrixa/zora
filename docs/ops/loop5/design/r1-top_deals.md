<!-- Module: docs/ops/loop5/design/r1-top_deals.md · Tested: n/a · Judge merge of the CEO and phone critics and the consistency critic on Top deals, the new home page, loop 5 round 1 -->
# Round 1: Top deals, the home page

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 3 |
| Craft (against LANGUAGE.md) | not supplied this round |
| Consistency (whole board set) | 3 |
| **Judge, this page** | **2** |

The two single-lens scores read the page in isolation and each found one kind of problem: the CEO saw a
podium where an empty-photo letter outweighs the price, the phone read found the picker and the switch
under the 44 px floor. Read together with the consistency findings and the boards themselves, the page
needs more than one structural change: the tiles sit inside the results section instead of under the
picker (the stack every other page follows), the promo footnotes are drawn as a page-local two-column
component instead of the shared one-column `footnotes()`, and the phone rank rows are a page-local copy
of `rank_rows(phone=True)` that dropped the "You pay" label and the saving bar's "saved" suffix on the
way. Three separate structural fixes, plus two high-severity blockers (the picker's tap height, the
switch's hit area), put this at a 2: two or more structural changes.

## Ranked changes for round 2

1. **Give the phone picker slots and the look switch a true 44 px hit area**
   Why: Phone lens, both issues high severity. The picker is the page's one required action; a shopper
   who cannot land a tap on City or Category cannot use the product. The switch is the control the
   whole two-looks loop is built around, and on this board it is the smallest tap target on the page.
   How: Both live in `design/gen/common.py`, so route through `design/gen/requests/top_deals.md` for the
   language step. (a) `_pick_box()` (around line 458) sets the lab slot to `height: 38px` on phone;
   raise it to 44. The pixel slot already renders `min-height: 48px` and needs no change. (b) `switch()`
   (around lines 235 and 242) renders each `<a aria-pressed>` segment at `height: 28px` (pixel) or
   `height: 24px` (lab); LANGUAGE.md section 4 promises a 44 px hit area through a transparent
   `::before`, but a static inline-style board has no stylesheet to hold one. Give each `<a>` itself
   `min-height: 44px` with vertical padding so the rendered pill still looks like today's 28/24 px bar,
   with the extra height as transparent padding around it.

2. **Shrink the empty-photo letter so the price stays the card's first read**
   Why: CEO lens, high severity. Cards 2 and 3 of the podium show nothing but one Sora 700 56 px letter
   ("H", "E") filling most of a 150 px slot; it is the largest mark on the card, ahead of "You pay
   $270.00" and "You pay $499.50" underneath. In a CEO demo this reads as an unfinished page, not a
   ranked savings list.
   How: `photo()` in `design/gen/common.py` (around lines 764-778) sets the fallback glyph at
   `font-size: 56px` (lab) / `48px` (pixel) regardless of the slot's height. Keep the slot's own height
   (150, winner 200; nothing else reflows) and cut the glyph to roughly 24-28 px, anchored top-left on
   the panel instead of centered, so it reads as a quiet placeholder mark, not a block letter. Shared
   code (Finder's compact cards use the same `photo()` at a smaller size already), so route through
   `design/gen/requests/top_deals.md`.

3. **Move the tiles row to sit under the picker, above the results head**
   Why: Consistency critic, and it is the clearest structural miss on the page. LANGUAGE.md's own
   opening line sets the stack as hero, picker, tiles, sections, foot; Finder follows it (picker, tiles,
   then the results grid) and so does Price truth (verdict, then tiles). Top deals alone buries the
   tiles inside the results section, after the podium. As the new home page this also means "Biggest
   saving $594.00" and the day's other headline numbers sit one screen later than everywhere else.
   How: In `design/gen/top_deals.py`'s `body()`, the tiles are built once (`tiles = c.tiles(...)`) and
   folded into `inner = podium + tiles + ranks`, which becomes the results section's body. Pull `tiles`
   out of `inner` (leaving `inner = podium + ranks`) and place it between `picker` and `results` in
   `content`, matching `finder.py`'s order.

4. **Fix the phone rank rows: bring back the "You pay" label and the saving bar's "saved" word**
   Why: Phone lens (medium) and the consistency critic agree on this one. Rows 4 to 20 on phone show a
   bare "$1,400.00 $1,860.00" with no label, then a bar and a bare "24.7 %". The desktop table has a
   "You pay" column head to anchor the figure; the phone list has no header at that point, so the label
   has to travel with the number. `common.rank_rows(phone=True)` has the same gap, but Price truth's own
   phone rows (`gap_rows` in `price_truth.py`) already solve it by calling the shared
   `c._you_pay_label(theme)` helper, and the shared `saving_bar()` already supports a `suffix` argument.
   How: In `design/gen/top_deals.py`'s `phone_rank_rows()`, prepend `c._you_pay_label(theme)` to the
   `price` div (matching `price_truth.py`'s `gap_rows`, and `deal_card()`'s own price line), and call
   `c.saving_bar(theme, r["pct"], suffix=" saved")` in the `save` div instead of the bare
   `c.saving_bar(theme, r["pct"])`, so rows read "You pay $1,400.00 $1,860.00" then "You save $460.00"
   then "24.7 % saved", matching LANGUAGE.md's own rank_rows phone spec. Both changes are inside
   `top_deals.py`; no request needed.

5. **Collapse the promo footnotes to one column, and give phone a "show all 20" step**
   Why: Consistency critic (craft) and phone lens (medium), same section. Top deals draws its own
   two-column `footnotes_columns()` where every other page (Finder, Price truth, Deal) uses the shared
   one-column `common.footnotes()`; in the pixel board every item in both columns already wraps onto a
   second line, so the two-column layout is not even winning space back. On phone, the 20-item list
   makes up close to a third of the page's 6,611-7,549 px scroll.
   How: In `design/gen/top_deals.py`'s `body()`, delete the `footnotes_columns()` call for desktop and
   use `c.footnotes(theme, notes_items)` there too, the same call already used for phone; remove the
   `footnotes_columns()` function. On phone, wrap the list in a `<details><summary>Show all 20 promo
   codes</summary>...</details>` so the podium and ranks 4 to 20 reach the foot line sooner; the ranked
   rows themselves already carry each promo's number via `promo_marker()`, so nothing is lost by
   collapsing the list.

6. **Keep the price to pay the biggest figure on the page, in both looks**
   Why: CEO lens, medium, and a direct reading of LANGUAGE.md's own binding rule ("the price a shopper
   pays ... is the biggest figure of every card and row"). The lead tile's "Biggest saving $594.00" is
   Sora 700 40 px in lab, bigger than the winner card's 36 px price; in pixel it is set in Press Start
   2P, which reads louder than the winner card's plain Plex Mono price even where the point size is
   smaller. The biggest, boldest number on the page should stay what the shopper pays, not a saving
   statistic.
   How: (a) Pixel is a one-line fix inside `top_deals.py`: change `c.tiles(theme, tile_items(rows),
   lead=True, phone=phone)` to `c.tiles(theme, tile_items(rows), lead=True, display_lead=False,
   phone=phone)`, the same flag Price truth and Scorecard already use to keep Press Start 2P off their
   lead tile. (b) Lab's 40 px size is hardcoded in `common.py`'s `tiles()` (`size = (30 if is_lead else
   24) if phone else (40 if is_lead else 32)`); route a smaller lead-tile tier (36 px desktop, at or
   under the winner card's price) through `design/gen/requests/top_deals.md`, and update LANGUAGE.md's
   type table row for "Tile figure" to match once it lands.

7. **Clarify the picker: name the third slot, and match Finder's bold note**
   Why: CEO lens (medium) and the consistency critic, same card. "Within it: any label" gives a
   first-time viewer no idea what a label is; and the note under the picker ("New York, NY holds 1,599
   listable deals, 244 of them in Things To Do.") is plain text here while Finder draws the same
   sentence with the city and the counts in `strong()`.
   How: In `design/gen/top_deals.py`, change the third picker slot's default value from `"any label"`
   to `"any tag"` (the picker line at `c.picker(theme, [...])`), and extend `PICKER_NOTE` with one clause
   spelling out what a tag is, e.g. "... 244 of them in Things To Do. A label is one of Groupon's own
   deal tags." For the bold styling, write `PICKER_NOTE` the way `finder.py`'s `picker_note()` does,
   wrapping the city and the two counts in `c.strong(theme, ...)` instead of the current plain f-string.

8. **Straighten four small wording and order mismatches against Finder**
   Why: Consistency critic, four low-to-medium findings that a reviewer scanning the whole site in one
   sitting hits inside the same few sections. None of them changes layout, all of them are one string or
   one call each.
   How: (a) The winner's pill reads "Best deal · You save $594.00 · 60.0 %" while the lead tile calls
   the same figure "Biggest saving"; in `common.py`'s `save_pill()`, drop the `"Best deal"` bit when
   called with `best=True` from the podium (route through `design/gen/requests/top_deals.md`, since
   `save_pill` is shared) so the rank badge and the filled pill alone mark the winner. (b) `ORDER_NOTE`
   in `top_deals.py` never states when the list refreshes; change it to "Ordered by the amount you save,
   largest first. Each deal appears once, with its biggest saving · Refreshes every 3 hours." (c) `FOOT`
   in `top_deals.py` names the city list and category tags before prices; reorder it to lead with
   prices, matching `finder.py`'s `FOOT`: "Prices refresh every 3 hours; the next delta sync runs at
   00:00 UTC. The city list and the category tags refresh daily at 00:30 UTC; the last walk ended 3
   hours ago (...)." (d) `EYEBROW` in `top_deals.py` is the only one of the four with an article ("an AI
   Builder showcase"); drop "an" so it reads "Product 4 · AI Builder showcase", matching the plain noun
   phrase the other three eyebrows use.

Dropped: opening the hero lead with the day's figure instead of the method (CEO, low; LANGUAGE.md
reserves that pattern for Price truth and Scorecard's verdict-style lead, and moving the tiles up per
change 3 already surfaces "Biggest saving $594.00" a screen earlier). A one-line pointer to the other
three products near the foot (CEO, low; real, but the smallest effect of everything raised here, and
the round is capped at eight changes). The board-length tracking note (phone, low; not a concrete
instruction, and change 5's disclosure already shortens the scroll it was flagging).

## Designer's response, round 2

Boards rebuilt from `common.py` alone: `design/gen/top_deals.py` no longer draws a part of its own
(`footnotes_columns`, `phone_rank_rows`, `letter` and `small` are gone). Heights: TopDeals 3525,
TopDealsPixel 3715, TopDealsPhone 6465, TopDealsPixelPhone 6932. Every shot is 1280 or 390 wide with
nothing past the edge, and every font loads.

1. **Done** (folded into `common.py` by the language step). Lab picker slots are 44 tall on both widths,
   and each switch segment is its own 44 tall hit box around the 24 or 28 px pill. Checked in the shots.
2. **Done** (folded). The fallback letter now follows the slot (lab 28 at 150, 40 at 200; pixel 24 and
   36) in the pale monogram tone, so "You pay $396.00" is the first read of every podium card. The
   module now takes `common.monogram`, so "2-Hour Guided ..." shows G, never a digit beside the badge.
3. **Done.** The tiles sit between the picker and the results head, the stack every page follows.
4. **Done.** `common.rank_rows(phone=True)` now carries "You pay" on the price line, "You save" opening
   the bar line and "N % saved"; the page calls it directly. One leftover in the shared part: at 390 the
   bar never fits beside "You save", so every row wraps to four lines. The rows stay even, and the fix
   is in `design/gen/requests/top_deals.md`.
5. **Done.** One column on the desktop through `common.footnotes`. On the phone the twenty sentences
   fold behind "Show all 20 promo codes" (`collapsed=True`); every ranked row still shows on the phone.
6. **Done.** The pixel lead tile is Plex Mono 32 (the shared default no longer spends Press Start 2P on
   a saving). The lab lead is 36, the winner's price is 36, so the lead is never larger. On the phone the
   lab lead is 30 against the winner's 30, and the pixel lead is 24 against 28.
7. **Done, worded with "tag".** The third slot reads "any tag", and the note sets the city and both
   counts in `strong()` as Find a deal does. It adds one clause: "Within it picks one of Groupon's own
   deal tags, such as Food Tours." I used "tag", not "label", so one thing has one word: the foot line
   already says "category tags". The builders change the live option text "any label" to match.
8. (a) **Done.** "Best deal" is gone from the shared pill. The winner's filled pill now leads with
   "Biggest saving", because the lead tile names that same deal (LANGUAGE.md, podium rule).
   (b) **Done, shorter.** The refresh goes through `section(refresh=...)`, so the head reads "Ordered by
   the amount you save, largest first; one row per deal. · Refreshes every 3 hours". The full sentence
   ran past 820 px in pixel and left the "·" hanging at a line end; "with its biggest saving" was the
   part cut.
   (c) **Done, with the clock fixed.** Prices come first, as on Find a deal. The walk moment is now "22
   hours ago (2026-09-30T00:41:37Z)", set with `common.moment`, so it agrees with the 00:30 UTC schedule
   and the board clock (23:23 UTC). The live 20:23 stamp came from a manual run.
   (d) **Declined.** The brief pins the eyebrow word for word ("The eyebrow stays 'Product 4 · an AI
   Builder showcase'"), and LANGUAGE.md section 6 quotes it the same way. If the eyebrows should match,
   the brief has to change first.

Also changed. The page draws both of its live empty states, small and side by side as on Find a deal:
"When nothing matches" and "Before the first category walk". The second one has no link, because the
live page shows no picker in that state and so this page offers no next step. Following LANGUAGE.md,
the next step link has no closing period.
