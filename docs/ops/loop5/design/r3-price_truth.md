<!-- Module: docs/ops/loop5/design/r3-price_truth.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Price truth, loop 5 round 3 -->
# Round 3: Price truth

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 5 |
| Consistency (whole set) | 4 |
| **Judge, this page** | **4** |

Craft found nothing this round, a clean 5, and reading the four boards confirms the page's structure
is sound: one verdict, one tiles row, every section carrying its refresh note, the two drawn states in
`drawn_state`, nothing that breaks LANGUAGE.md. CEO and Phone both land on 4 with one medium finding
each and small polish beyond it; the whole-set consistency check adds one more small drift on this page.
None of it blocks the page, so it stays where round 2 left it rather than dropping. One phone finding
needs a correction before it goes to the designer: the claim that Price truth is "the tallest of the
four products" does not hold up against the other three boards' own measured heights (TopDealsPhone
6,015 px and TopDealsPixelPhone 6,479 px, against PriceTruthPhone 5,054 and PriceTruthPixelPhone 5,275;
Scorecard's two phone boards, 5,137 and 5,400, also run longer than Price truth's lab board). Price
truth is the third tallest, not the first, roughly level with Scorecard. The underlying problem, no
page on the site keeps its look switch within reach past the first screen (`grep -rn sticky design/gen
design/project` returns nothing), is real and worth fixing once, in the shared header; it just is not
this page's problem alone, and the fix belongs in `common.py` rather than in anything unique to Price
truth. The CEO's note on the lab pass tone is the other lens worth flagging rather than assigning: it
names a shared token (`--pass` against `--action`), and the critic's own fix says to raise it when the
token set is next revisited, not to edit this board alone, so it is not counted as a page defect.

## Ranked changes for round 4

1. **Name who the lead is for**
   Why: CEO (medium). The eyebrow ("Product 1 · Price truth monitor") and the lead state what the
   monitor is and today's numbers, but never say whose promise the numbers back. Confirmed on all four
   boards: "Today the price the API quotes is the price the cart charges: 20 of 20 carts. groupon.com
   showed the same price on 59 of 59 listing pages." reads as a fact with no stated stakeholder. A reader
   outside the team has to infer why 20 of 20 matters.
   How: in `design/gen/price_truth.py`'s `lead_text` (around line 122), fold one clause into the first
   sentence, keeping the two-sentence cap: "Today the price the API quotes is the price the cart charges,
   so a partner's price promise holds: 20 of 20 carts." The second sentence stays as is.

2. **Keep the look switch reachable through the scroll, in the shared header**
   Why: Phone (medium), corrected. Price truth is not the tallest board on the site (Top deals runs to
   6,015 and 6,479 px, Scorecard to 5,137 and 5,400, against Price truth's 5,054 and 5,275), but at
   roughly six phone screens it is still long enough, and no board on the site keeps the switch in reach
   past the first screen: `header()` in `design/gen/common.py` has no `position: sticky` in either its
   phone or desktop branch, on any page. A shopper who scrolls into Promo gap or Freshness and wants to
   flip Lab/Pixel has to scroll all the way back up.
   How: in `common.py`'s `header()`, phone branch (around line 400), wrap the lockup row (mark, wordmark,
   switch, 60 px) in `position: sticky; top: 0; z-index: 1` with the header's own `--bar` background, so
   it stays visible while the nav row and the page scroll under it. This is a `common.py` change, so it
   lands on every page at once; Top deals and Scorecard, the two boards longer than this one, gain the
   same fix. If the fix is judged out of scope for this round, say so explicitly rather than leaving it
   silent, since it is the one real defect Phone found.

3. **Say which mismatch "Since a mismatch" counts, in the site's own hint style**
   Why: CEO (low) and consistency both touch this one string. The tile gives one number, "8 days," but
   its hint names two dates for two different kinds of mismatch ("Pages last on 22 Sep, carts on 19
   Sep"), so a reader has to subtract to notice the 8 days is measured from the more recent, pages, not
   both. The same hint also breaks the site's own casing rule the consistency critic names: it starts
   capitalized like a sentence ("Pages last..."), while every other tile hint on this page and on Top
   deals is a lowercase fragment.
   How: in `design/gen/price_truth.py`'s tiles call (line 141), change the hint to name the more recent
   mismatch and drop the capital: `f"pages, the more recent, last on {LAST_PAGE_MISMATCH}; carts on
   {LAST_CART_MISMATCH}"`. The label ("Since a mismatch") stays; it already sits at the 16-character
   guidance's edge and a longer rename would only push past it.

4. **Scale the largest-gaps bar to the list's own range, not 0 to 100 %**
   Why: CEO (low), confirmed by measuring the boards. All eight rows in "The 8 largest gaps" sit in a
   30.0 to 40.1 % band, but `saving_bar()` in `common.py` (line 1198) fills its track against a fixed
   0 to 100 % domain, so every row's bar is nearly the same short length; cropping the pixel board shows
   only about one segment of its roughly nine separates the smallest gap (30.0 %) from the largest
   (40.1 %). The printed percent does the actual ranking; the bar adds nothing next to it.
   How: give `saving_bar()` an optional `domain=(lo, hi)` parameter, defaulting to `(0, 100)` so
   `rank_rows`' existing calls (a true 0 to 100 % saving share) are unchanged, and thread it through
   `gap_rows()`. In `price_truth.py`, compute the domain from `WORST`'s own gaps (about 28 to 42 %,
   padded a few points past the list's 30.0 and 40.1) and pass it to `gap_rows(...)`, so the bar's length
   tracks the number beside it.

5. **Lowercase the "Carts matched" tile hint to match the site**
   Why: Consistency (low). "Sampled at 04:30 UTC, every cart abandoned at once" starts capitalized like a
   sentence; every other hint on Top deals, Find a deal and Deal is a lowercase fragment, and this page's
   own "groupon.com, read at 06:00 UTC" and "8 delta syncs so far..." hints already follow that style.
   How: in `price_truth.py`'s tiles call (line 136), change the hint to "sampled at 04:30 UTC, every cart
   abandoned at once".

6. **Spread the verdict banner's two rates across the full card width on phone**
   Why: Phone (low), confirmed by cropping both phone boards. `verdict()`'s phone branch (`common.py`
   line 1682) renders the rates with a plain `figure_row(theme, figures, phone=True)`, a left-aligned
   flex row with no `justify-content`; with exactly two figures ("Carts, 30 days" and "Pages, 30 days")
   they cluster in the left 55 to 60 % of the 390 px card, leaving the banner's own right edge empty right
   under a sentence that runs full width.
   How: in `verdict()`'s phone branch, wrap the two figures in their own row with `justify-content:
   space-between` in place of the bare `figure_row` call, so the two rates span the same width as the
   sentence above them. Scope the change to `verdict()`, not `figure_row()` itself, since Promo gap's own
   four-figure row is meant to wrap and left-align.

7. **Flag the lab pass tone for the next token pass, not a page edit**
   Why: CEO (low). In the lab look, `--pass` (`#1F4FBF`) sits close enough in hue to `--action`
   (`#2B2D6E`, links, buttons, the current nav underline) that the MATCHED banner reads as one more
   branded panel rather than an unambiguous pass, the way pixel's mint (`--pass` `#7FE0A6`) does at a
   glance. The critic's own fix asks for this to be raised when the token set is next revisited, not
   edited on this one board, and round 1 already declined to touch `--pass` for the same reason on the
   tiles.
   How: no change to this page. Carry the note forward to whoever next revisits `design/LANGUAGE.md`
   section 1's token table; the designer should not override `--pass` locally on Price truth.
