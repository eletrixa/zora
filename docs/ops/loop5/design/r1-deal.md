<!-- Module: docs/ops/loop5/design/r1-deal.md · Tested: n/a · Loop 5 round 1 judge verdict for the Deal page, merging the three lens critics and the consistency critic into ranked changes for round 2 -->

# Round 1: Deal page

## Scores

| Critic | Lens | Score |
|---|---|---|
| CEO | Will show this page as one product | 2 |
| Phone | Shopper on a phone at 390 px | 3 |
| Craft | Design craft against LANGUAGE.md | 4 |
| Consistency | The whole five-page set | 3 |
| **Judge (this file)** | **Settled against the four boards and the code** | **3** |

The boards carry the tokens, type scale and spacing right and both looks share one structure, which
is why craft scored it a 4. But the page breaks two of LANGUAGE.md's own rules in a way a CEO demo or a
thumb would hit immediately: the summary card and the first Options row put the same option, the same
price and two "Get checkout link" buttons on screen together (LANGUAGE.md's own "Never: two components
for one job"), and the look switch — the one control every lens is watching on every page — falls short
of the 44 px hit area LANGUAGE.md section 4 already specifies. Those two, plus an unbounded h1 that has
never been tested against a real long title, keep this at a 3, not a 4.

## Ranked changes for round 2

1. **Stress-test the h1 with a real long title, then give it a length rule**
   Why: CEO lens, high severity. Real deal titles run 100+ characters (see `/top-deals`); the board only
   ever shows a 38-character sample. If a long title pushes the price block and the checkout button off
   the first screen, the CEO's own demo breaks the moment they pick a different deal.
   How: Rebuild the board once with a title pulled from a live top-deals entry (100+ chars) to see what
   actually happens. If it breaks the layout, add an optional size override to `common.py`'s `hero()`/
   `h1()` (default unchanged, so every other page keeps its current call) and have `deal.py` pass a
   smaller size once the title passes roughly 60 characters — lab 30 px desktop / 24 px phone (down from
   38/28), pixel 22 px desktop / 18 px phone (down from 28/20) — instead of reusing the fixed-short-string
   rule built for Top deals, Find a deal, Price truth and Scorecard.

2. **Drop the duplicate option, price and checkout button**
   Why: CEO lens, high severity, and a direct hit against LANGUAGE.md's "Never: two components for one
   job." "The cheapest option" card and the first row of the Options list both show Private Room for
   Four, 60 Minutes, $79.00/$140.00, the same save line and their own "Get checkout link" button. A
   shopper — or the CEO mid-demo — has to work out which of two identical buttons to click.
   How: In `deal.py`'s options card, drop the button on the option row that matches the buy box's
   selected option (the first, cheapest row) — replace it with a short "Shown above" note, or simply
   omit the action cell for that one row — since the buy box already carries that exact action as the
   page's one primary CTA. Leave the other two rows' own buttons as they are.

3. **Give the look switch a real 44 px hit area**
   Why: Phone lens, high severity. LANGUAGE.md section 4 already promises "32 px tall inside a 44 px hit
   area" with a transparent `::before` on each segment; the code in `common.py`'s `switch()` only wraps
   the 32 px track in a 44 px `<form>`, and the segments themselves render at 24 px (lab) / 28 px (pixel)
   with no padding reaching 44. Every nav link on the same page already gets its 44 px min-height — the
   switch is the one control that misses the page's own rule, on the page whose header carries it on
   every board.
   How: In `common.py`'s `switch()`, give each `<a>` segment real box height — padding so the rendered
   box is 44 px tall, or the `::before` inset LANGUAGE.md describes. It is shared code, so the fix lands
   on every page's header at once.

4. **Give the secondary tap targets — "See all 3 options" and the breadcrumb — the same 44 px box**
   Why: Phone lens, medium and low severity, same root cause as #3. "See all 3 options" sits one
   thumb-width under the primary CTA as 13 px underlined text with no box; this is the page whose only
   job is to get a shopper to checkout, so a mis-tap here is a mis-tap away from buying. The breadcrumb
   links above the eyebrow have the same gap, lower traffic.
   How: In `deal.py`'s `buy_box()`, give the "See all 3 options" `<a>` `min-height: 44px; display: flex;
   align-items: center`, the same treatment nav links already get. In `common.py`'s `breadcrumb()`, apply
   the same pattern — ideally one small shared text-link helper with a built-in 44 px box, used by both,
   rather than two one-off patches.

5. **Bring the hero photo fallback down to a weight that doesn't outweigh the price block**
   Why: CEO and craft lenses independently flagged this (medium). `photo_frame()` scales the fallback
   letter to 120 px (lab) / 96 px (pixel), well past the sitewide deal-card fallback of 56/48 used
   everywhere else, and because the slot stretches to the buy box's full height, the empty state becomes
   the single largest visual mass on the flagship shopper page while carrying zero information. Lab's
   fallback also sits on a flat `--panel` fill with no texture, unlike pixel's 16 px checker.
   How: In `deal.py`'s `photo_frame()`, scale the fallback letter down — roughly 80 px (lab) / 64 px
   (pixel) desktop, correspondingly smaller on phone — so it reads as a quiet placeholder rather than the
   page's dominant figure, and give the lab fallback the same quiet checker texture pixel already has.
   Keep the monogram scaling with the slot (per the function's own intent); just narrow how far it scales.

6. **Add the "You pay" label to option rows**
   Why: Craft lens, medium. `deal_card()` always prepends `_you_pay_label(theme)` to its price line;
   `common.py`'s `option_row()` builds the price span directly and never calls it. The Options card has
   no column header nearby (unlike Top deals' ranked rows, which sit under an explicit "You pay" column),
   so this is the one place on the site a struck-price pair appears with no "You pay" text anywhere near
   it.
   How: In `common.py`'s `option_row()`, prepend `_you_pay_label(theme)` to the price line, matching
   `deal_card()`'s treatment at line ~872, so the figure reads the same way everywhere it appears.

7. **Fix the three wording and structure mismatches that live entirely in `deal.py`**
   Why: Consistency critic. A reviewer scanning the whole site in one sitting — exactly how the CEO will
   see it — hits three small disagreements between Deal and every other page within the same few
   sections.
   How: (a) Change `FOOT` from "the next delta sync runs at 12:00 UTC" to "Prices refresh every 3 hours;
   the next delta sync runs at 00:00 UTC", matching Finder's wording and the shared sample clock. (b)
   Call `c.tiles(theme, TILES, lead=True, display_lead=False, phone=phone)` with `TILES` reordered so
   "Biggest saving $96.00" is the lead tile (spans two columns), followed by Options, Promo codes and
   Price changes — matching the lead-tile pattern every other page's first tile row already uses, and
   keeping the pixel display figure on the price to pay as LANGUAGE.md's type table already specifies
   for this page. (c) Change the Promo codes tile hint from "options, typed at Groupon checkout" to
   "footnotes, typed at Groupon checkout", matching Top deals and Finder.

8. **Rename the Price history table head and make the breadcrumb agree with the eyebrow**
   Why: Consistency critic (table head) and CEO lens (breadcrumb vs. eyebrow), both low severity but
   both sit inside the same 80–200 px of the page, so a careful look catches them together. Deal's own
   date style — "28 Sep 2026" in Plex Sans 600 — is already the format Scorecard should adopt, so only
   the head word needs to move on this page.
   How: (a) In `deal.py`'s `HISTORY_HEAD`, change "Seen on" to "Seen", matching Scorecard's head word
   (Scorecard's own date format and head are out of this round's scope, but will need the matching
   change to finish the pair). (b) In `deal.py`'s `body()`, add the eyebrow's category to the breadcrumb
   so it reads "Find a deal / Things To Do / Escape Games / [title]" instead of leaving "Things To Do"
   and "Escape Games" as two unconnected labels in the same view.

Dropped: the Locations/About card height mismatch (craft, low, desktop only) — real but the smallest
effect of everything raised, and the round is capped at eight changes.

## Designer's response, round 2

The sample deal is now rank 2 of the Top deals board, the guided tour of The Met with its live title of
116 characters, so every board shows what a real long title does. Its options are the tour for one to
four adults; Top deals ranked it by the four adult option, and that is the option the lead tile names.

1. **Long h1: done.** The boards carry the live 116 character title. common.py's `h1` steps it down past
   60 characters (lab 30, phone 24; pixel 22, phone 18): 3 lines in lab and 4 in pixel on the desktop,
   and the buy box with its button stays on the first desktop screen (the button ends near y 690 in
   lab). On the phone the title fills 5 lines in lab and 7 in pixel, which pushed the price off the
   first screen, so on the phone the buy box now comes before the photo: the price to pay sits near
   y 610 in lab and y 710 in pixel.
2. **Duplicate option and button: done.** The first option row says "In the box above" in place of a
   button (`option_row` note); the other sellable rows keep a secondary "Get checkout link".
3. **Switch hit area: done** in common.py by the language step (each segment a 44 tall box); the Deal
   header uses it on all four boards.
4. **Secondary tap targets: done.** "See all 4 options" is common's `text_link` inside `buy_box` (44 tall)
   and the breadcrumb links are 44 tall boxes.
5. **Quiet photo fallback: done** through common's photo rule: 72 in lab and 64 in pixel at 360, the lab
   slot striped like the pixel checker. I kept the rule's 72, not the 80 suggested here, so the letter
   follows one rule on every page.
6. **"You pay" on option rows: done** (common's `option_row`).
7. **Wording and structure: done.** (a) The foot line reads "Prices refresh every 3 hours; the next delta
   sync runs at 00:00 UTC." (b) "Biggest saving" is the lead tile, two columns wide, Plex Mono in pixel;
   the tiles row also moved out of the Options section to sit right after the buy box, since
   LANGUAGE.md puts the tiles after the page's answer and before the first section. Its hint names the
   option in full, as Top deals and Find a deal name their deal, and that option's row carries the save
   pill led by "Biggest saving". The pill stays tinted in the row, because a filled pill beside a
   checkout button wears the primary button's skin in pixel and outweighs the 18 px price (asked for in
   `design/gen/requests/deal.md`). (c) The Promo codes hint reads "footnotes, typed at Groupon checkout".
8. **Table head and breadcrumb: (a) done, (b) done in part.** The head reads "Seen". The breadcrumb now
   reads "Find a deal / Things To Do / Tours". **Declined:** the deal title at its end. The h1 right under
   it names the deal, and the live title repeated in the path wrapped onto its own line in pixel and
   doubled the page's longest string. The eyebrow now carries only the city, so "Tours" is not said
   twice in two lines.

Dropped item: the Locations and About cards now end on one line through common's
`columns(stretch=True)` and `section(fill=True)`.

Also changed: the "no price change yet" empty state links to "Compare the options" on this page, not to
Price truth (LANGUAGE.md: the next step for this page's reader); the option that cannot be sold carries
no code, so the promo numbers skip 3 and the note under "Promo codes" says so for options.
