<!-- Module: docs/ops/loop5/design/r3-scorecard.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Scorecard, loop 5 round 3 -->
# Round 3: Scorecard

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 4 |
| Consistency (whole ten-board set) | 4 |
| **Judge, this page** | **4** |

Round 2's one structural item (the second tiles row in Catalogue copy) is gone and stayed gone: the
section is now the shared sync card form, the badges carry their own tone, the runs note leads with the
bridging rule, Findings carries its refresh note, the empty-state link fits one line, the row heights
match, and the latency list is the live eight slowest with no label wrapping. What this round's four
lenses found is six real items, none of them a written LANGUAGE.md rule broken on the board the way
round 2's repeat was: a wording gap between two cards that describe the same bug, a value the lead tile
should have been capped against and was not, a badge pair that reads apart only by position, a shared
table's outer padding, three hints that read as sentences where the rest of the site reads them as
fragments, and one shared-header gap already being fixed for a sibling page. Polish and value fixes on
an already-sound structure keep this at a 4.

One craft finding does not survive a pixel check and is dropped: the claim that ScorecardPixel's p95
legend swatch shows one bright accent square beside one `--accent-shadow` square. Reading the actual
pixels of `design/preview/shots/ScorecardPixel.png` at the swatch's own rect (x 290–308, y 1353–1363)
gives `#7A5A12` (`--accent-shadow`) across both segments, with only a 2 px transparent gap between them
(`repeating-linear-gradient(90deg, #7A5A12 0 8px, transparent 8px 10px)`, confirmed against the live DOM
in `design/preview/ScorecardPixel.html`). The p95 swatch is drawn from the bars' own fill, exactly as
LANGUAGE.md's histogram rule asks; no change is needed.

## Ranked changes for round 4

1. **Cap the lead tile at the verdict word's own size, so FAIL stays the headline**
   Why: Phone (medium), confirmed in `design/gen/common.py`: the live verdict word is lab 36/28
   (desktop/phone) and pixel 28/20 (`verdict()`, the `size` and `wstyle` lines), while the tiles() lead
   is lab 36/30 and pixel 32/24 (`tiles()`, the `lead_size` line). Only lab desktop ties (36/36); the
   other three pairings let the tile outsize or tie the page's one display figure. On ScorecardPhone the
   effect is visible, not theoretical: cropping the board (`design/preview/shots/ScorecardPhone.png`,
   y 320–560) shows the fail-toned "Steps passed" tile sitting directly under the FAIL banner in the same
   fail tint, so the tile's own "37 of 39" reads at least as loud as "FAIL" right above it, and the two
   blocks read as one continuous orange band before the neutral tiles start.
   How: add a `verdict_word_size(theme, phone=False)` helper to `common.py` next to `price_size` (lab 36
   desktop / 28 phone, pixel 28 desktop / 20 phone, the live, non-example sizes `verdict()` already
   computes inline). In `design/gen/scorecard.py`'s tiles call (`body()`, the `c.tiles(...)` line), pass
   `cap=c.verdict_word_size(theme, phone)`. `tiles()`'s existing cap logic then does the rest: lab phone
   lead drops 30 to 28, pixel desktop 32 to 28, pixel phone 24 to 20 (lab desktop is already capped at its
   own size, unchanged), and each row's other tiles step 4 under the new lead automatically.

2. **Cross-reference the failing step and its matching Finding**
   Why: CEO (medium), confirmed in `design/gen/scorecard.py`: `FAILING[0]` (line 60) and `FINDINGS[2]`
   ("Products API", Minor, Open, line 113) both cite the same guide clause and the same observed result
   (HTTP 400 invalid_argument, no products array, on a state-scope query) in different words, with nothing
   linking them. A reader cannot tell from the boards alone whether today's FAIL is one of the three
   Findings or a fourth, separate problem.
   How: in `scorecard.py`, append one clause to `FINDINGS[2]`'s `"observed"` string: "…with no products
   array. This is the step that failed on 30 Sep." Leave `FAILING[0]`'s own Expected and Observed text as
   they are; the pointer only needs to run one way, from the tracked Finding back to today's failure.

3. **Give the status badge its own glyph, apart from severity**
   Why: Craft (medium), confirmed on all four boards: `finding_card` in `common.py` calls `badge(...,
   glyph=False)` for both the severity badge and the status badge, so "Minor" and "Open" render as the
   same plain, glyph-less, neutral-toned pill, distinguishable only by position and by reading the text.
   Cropping the Carts API card (`design/preview/shots/Scorecard.png`, the finding at y 2659) shows this
   directly: two identical pills, left and right. `check_rows` already solves the same problem by leaving
   `badge()`'s `glyph` argument at its default.
   How: in `finding_card` (`common.py`, the `status = badge(theme, f["status"], status_tone, glyph=False)`
   line), drop `glyph=False` so the default glyph applies: a check before "Reported"/"Fixed" (pass tone),
   a dash before "Open" (neutral tone). Leave the severity badge's own `glyph=False` as it is, so severity
   stays a plain pill and the two badges now read apart by more than position, even when both happen to be
   neutral (Minor + Open, 2 of the page's 3 findings).

4. **Flush the data table's outer padding to match the card title and the rules**
   Why: Consistency (medium), confirmed in `common.py`'s `data_table` (the `<td>`/`<th>` padding: 12px`
   and `padding: 10px 12px` lines): the desktop cell padding is applied on all four sides, so "Delta sync"
   and the figure columns in Catalogue sync's "Latest syncs" card, and "Kind" in Contract drift's card,
   sit 12 px in from the card's own title and edge, unlike `rank_rows`, `gap_rows` and the side-card lists
   next to these same tables, which start flush. This is the same defect the Deal page's round 3 judge
   found independently in its own Price history table (`docs/ops/loop5/design/r3-deal.md`, change 5), so
   it is one shared fix, not two.
   How: in `data_table`'s desktop branch, drop the outer padding: horizontal padding goes between columns
   only (`padding: 12px 0` on inner columns, none on the first column's left or the last column's right),
   keeping the 12px vertical padding. Scorecard's own calls (`sync_block`, `drift_block`) pass no `pad=`
   override, so both tables line up automatically once this lands; no change needed in `scorecard.py`.

5. **Match three tile hints to the site's lowercase-fragment style, and explain "p95" where it first appears**
   Why: CEO (low) and Consistency (low), both on the same three hints: "The job did not run on 17 and 18
   Sep," "Two price-mismatch steps, tied," and "The major one is reported to Groupon" read as capitalized
   sentences, where Top deals, Find a deal and Deal write every hint as a lowercase fragment continuing
   the figure above it ("median of the top 20", "footnotes, typed at Groupon checkout"). Separately, "p95"
   is not explained until the Latency section's legend, several sections after the "Slowest p95" tile uses
   it.
   How: in `scorecard.py`'s `TILES` list, reword the three hints: "no run on 17 and 18 Sep" (the day
   strip's own word for that state), "two {check} steps, tied (the slowest 1 in 20 calls)" (folding in the
   p95 explanation the CEO lens asked for), and "the major one reported to Groupon".

6. **Keep the look switch reachable on Scorecard's long phone scroll**
   Why: Phone (low). Scorecard is 390×5,137 (lab) and 390×5,400 (pixel), about six phone screens, and
   `header()` in `common.py` has no `position: sticky` in its phone branch on any page, so a reader who
   scrolls into Latency or Findings must scroll back to the top to flip Lab/Pixel. This is already
   speced as a shared fix in `docs/ops/loop5/design/r3-price_truth.md` (change 2), which names Scorecard
   by its own two phone heights as one of the two boards on the site that most need it.
   How: no Scorecard-specific change. Once `header()`'s phone branch wraps the lockup row in `position:
   sticky; top: 0; z-index: 1` as that file specifies, Scorecard's two phone boards gain it at the same
   time as Price truth's and Top deals'.

7. **Fold the sync time into the "Delta sync" row title (optional)**
   Why: CEO (low), and marked optional by its own critic: both "Delta sync" rows in the Catalogue sync
   table read as identical bold row titles on the phone's labelled-list form (`data_table`'s default
   `phone_title=0`), differing only in the muted "Started, UTC" line under them.
   How: in `scorecard.py`'s `SYNC_ROWS`, change the first two rows' "Sync" cell to "Delta sync ·
   21:00 UTC" and "Delta sync · 18:00 UTC"; leave "Full load" as it is, since it is already distinct.

Dropped: the craft critic's p95 legend finding (see above, verified against the rendered pixels and the
live DOM, not confirmed). Not counted as a page defect: the CEO's "Delta sync" duplicate-title note is
folded in above at low priority exactly because the critic itself called it optional, not because it was
found wrong.
