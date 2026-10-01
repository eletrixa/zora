<!-- Module: docs/ops/loop5/design/r3-finder.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Find a deal, loop 5 round 3 -->
# Round 3: Find a deal

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 4 |
| Consistency (whole board set, this page's issues) | 4 |
| **Judge, this page** | **3** |

All four single lenses read the page as close to done and each scored it 4. Reading the boards myself
(Finder.png, FinderPixel.png, FinderPhone.png, FinderPixelPhone.png) turns up one thing none of the three
critics caught on their own but the consistency critic did: on the desktop grid's first row, card 2's
labelled save pill wraps to two lines and stops being a pill. LANGUAGE.md's own save pill rule is "a full
pill on one line, a soft chip on two"; `common.deal_card`'s own comment says "Price and pill sit at the
foot of the card, so cards side by side line their prices up." Neither is true on the built board: the
wrapped pill widens to the card's full content width, an indigo (lab) or amber (pixel) bar the size of the
Search button, and because it shares a bottom-anchored block with the price line, card 2's $135.00 sits
about 24 px above $75.00 and $149.00 beside it. That is the page's own written spec not holding on the
built boards, the same bar round 2 used to hold the page at a 2, and it repeats wherever a labelled or
two-line pill appears (the Top deals podium winner, the Deal phone four-option row), so it is a shared
`common.py` defect, not a one-page glitch. One clear structural break, not two or more, keeps this a 3
rather than a 2: everything else below is real but is wording, a missing hard-case proof, or a one-value
spacing fix inside an already-built pattern, not a second broken rule.

## Ranked changes for round 4

1. **Fix the save pill so a two-line wrap stays a chip, and prices stay lined up across a row**
   Why: Consistency critic, confirmed directly against `design/gen/common.py` and the boards (high): the
   wrapped pill on Finder.png / FinderPixel.png row 1, card 2 turns into a full-width slab instead of the
   "soft chip" LANGUAGE.md's save pill rule (section 6) calls for, and because `deal_card` pins price and
   pill together at the card's foot, the taller pill pushes that card's price about 24 px out of line with
   its row neighbours. The same shared part draws the TopDeals podium winner and the DealPhone four-option
   row, so the same fix clears all three.
   How: in `common.save_pill` (design/gen/common.py, line 1071), stop sizing the pill from natural text
   wrap. Draw the label and the "You save … · …" line as two explicit stacked children of an
   `inline-flex; flex-direction: column` pill, each its own span, so the pill's width is the max-content
   width of its longest line, not the available column width. In `common.deal_card` / `common.deal_grid`
   (lines 1120 and 1185), give every card in a grid row the same reserved height for its price-and-pill
   block, or fix the price line at one y above the pill, so a taller two-line pill in one card never moves
   that card's price relative to its row. This is a `common.py` change; log it in
   `design/gen/requests/finder.md` since Top deals and Deal need it too.

2. **Say plainly whether this browser page is the agent tool or a preview of it**
   Why: CEO critic (medium): the hero lead says "the way an agent asks over HTTP, MCP or the command
   line," but the picker under it is a typed field plus three dropdowns, not free text, so the page never
   states whether this view is itself one of the agent's access methods or a human-facing preview of the
   same search. It is the first sentence a reader hits.
   How: in `design/gen/finder.py`, `LEAD` (line 26), change the clause to "...the same search the agent
   tool runs over HTTP, MCP or the command line." Keep the rest of the lead and the picker as they are.

3. **Decide the no-code promo case in LANGUAGE.md, then prove it on the board**
   Why: CEO critic (medium), and a real gap, not a taste call: `src/shopping/index.ts`'s `promoOf()`
   returns a `PromoNote` with `code: null` and the sentence "Groupon may offer $X at checkout. Expect to
   pay $Y." whenever checkout could be cheaper but Groupon gives no code, a separate branch from "Type
   code …". None of finder.py's nine `DEALS` rows uses it; three rows simply carry no promo at all. The
   "Promo codes: 6 of 9" tile, the six "promo N" markers and the six footnote entries agree on this board
   only because the harder case never appears, so the agreement is unproven where it matters.
   How: `AGENTS.md` rule 2 ties a reported promo to "its code and the sentence that the shopper must type
   it," which a no-code note does not have, so on that reading it should carry no "promo N" marker and
   should not sit in, or count toward, a heading called "Promo codes." Write that decision into
   `design/LANGUAGE.md`'s promo marker and footnotes section. Then in `design/gen/finder.py`, swap one of
   the three no-promo rows (item 3, "Discover Ultimate Relaxation…", or item 6, "60-minute Tailored…") for
   the no-code sentence, and confirm on the rebuilt board that the tile, the markers and the list still
   agree under the rule as written, not the easy case. This is the open item already logged under "Round
   3" in `design/gen/requests/finder.md`.

4. **Fix the foot line: this page has no category tags**
   Why: Consistency critic: the foot line's second sentence is copied from Top deals, which has a Tag
   slot; Find a deal has none, so "the category tags refresh daily" names something the reader never sees
   on this page.
   How: in `design/gen/finder.py`, `FOOT` (line 64), change the second sentence to "The city and category
   lists refresh daily at 00:30 UTC.", matching the words the picker note already uses ("the lists").

5. **Give the promo footnote card the site's own card padding**
   Why: Consistency critic: every other page's footnote list sits in its section card at the default
   24 px padding; Find a deal wraps it in its own `c.card(..., pad="20px 24px")`, the one place on the
   site this list gets bespoke spacing.
   How: in `design/gen/finder.py`, `notes_card` (line 144), drop the `pad=` argument so the card falls
   back to `common.card`'s default, matching Top deals, Price truth and Deal. If a shared
   `deal_grid(..., notes=...)` or footnote-card helper is added to `common.py` for this instead, route
   Finder through it and log the request in `design/gen/requests/finder.md`.

6. **Say "full load," the site's own word for the sync, not "catalogue load"**
   Why: Consistency critic: the empty-state caption says "Before the first catalogue load," while the
   sentence right under it, the Scorecard sync card and Price truth's Freshness note all say "full load,"
   LANGUAGE.md's own term for it.
   How: in `design/gen/finder.py`, `empties()` (line 157), change the caption to "Before the first full
   load."

7. **Give the two "Discover…" sample cards distinct fallback letters**
   Why: CEO critic (low): card 3 and card 5 both monogram to "D" because both real titles open with
   "Discover," so a nine-card sample meant to read as obviously real shows a repeated letter.
   How: in `design/gen/finder.py`'s `DEALS` (line 35), swap card 5's entry ("Discover Armitage Massage &
   Chiropractic's...") for a different real result from the same "massage" in Chicago, IL query that does
   not open with "Discover," keeping its own real price, option and promo sentence. Leave
   `common.monogram` as it is: "Discover" is common across many real titles the same way "Up to N% Off" is,
   and changing the shared skip rule for one board's coincidence is a wider, unreviewed change.

8. **Trim the Cheapest tile's hint at a whole word**
   Why: Craft critic (low), raised and deferred in round 2 too: the two-line clamp on "Discover Armitage
   Massage & Chiropractic's tailored…" cuts inside "tailored," leaving "tailore…", rough next to the rest
   of the tile row.
   How: in `common.tiles`'s hint clamp (design/gen/common.py, the two-line `-webkit-line-clamp` folded in
   during round 2), trim to the last whole word before the ellipsis when that is possible without losing
   the full-title intent, for every page's hint, not only Finder's. If that cannot be done cleanly, leave
   it: the written rule ("stops at two lines with an ellipsis") is already met to the letter.

Dropped: the phone critic's note that the lab typed "What" field reads weaker than pixel's boxed field.
This was raised in round 2 (Phone, low) and declined there because LANGUAGE.md's picker section states
the missing chevron as the deliberate cue that a typed slot is not a dropdown. Re-raising it a third time
with no new argument would reopen a call LANGUAGE.md already settled; no action this round.
