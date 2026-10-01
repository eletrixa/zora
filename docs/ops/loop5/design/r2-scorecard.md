<!-- Module: docs/ops/loop5/design/r2-scorecard.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Scorecard, loop 5 round 2 -->
# Round 2: Scorecard

## Scores

| Lens | Score |
|---|---|
| CEO | 4 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 2 |
| Consistency (whole ten-board set) | 4 |
| **Judge, this page** | **3** |

Round 1's five structural problems are gone: the sections run in the brief's order, the runs card is
the shared strip form, the tiles row exists, the timestamps agree, and the latency chart is the shared
histogram. What is left is one real structural repeat (the craft lens's "two components for one job" on
Catalogue copy, echoed by the consistency lens as one sync told with two vocabularies and two clocks)
plus a set of wording, tone and spacing fixes. One structural change, the rest polish: by the rubric
that is a 3.

The CEO lens's third issue (today's 37/1/1 counts stated three times) is dropped. It names the "Latest
run" card as the most droppable of the three, but that card is the shared `strip_cards` form round 1
put in place to match Price truth's own "Latest day" card; removing it would undo the one consistency
win round 1 already banked, and the critic's own note says this is not a request to break cross-page
consistency.

## Ranked changes for round 3

1. **Replace the second tiles() row in Catalogue copy with one shared sync part, in Price truth's words
   and clock**
   Why: craft (high), the page's only high severity finding: LANGUAGE.md's Never list forbids two
   components for one job, and Catalogue copy draws a second full tiles() group (panel fill, no
   border, label over figure over hint) inside a section, the same shape as the page's one tiles row
   under the verdict. Consistency finds the same defect from the other side: this section describes the
   one product catalogue sync with words and a clock that disagree with Price truth's Freshness section,
   which reads the same SyncStatus data ("Last full run" and "Last delta run" here against "Last full
   load" and "Last delta sync" there, "Last refresh ... 21:01 UTC" against "Last delta sync 21:00 UTC",
   and "products" against Top deals and Find a deal's "listable deals"). One change fixes both readings.
   How: drop the second `c.tiles(theme, CATALOGUE, ...)` call. Draw Catalogue copy the way Price truth
   draws Freshness: a `c.data_table` schedule row (or `side_cards`) naming "Last delta sync" (21:00 UTC),
   "Delta syncs today", "Last full load" (28 Sep), and a plain count line using "listable" ("55,805
   listable, of 61,477 in the catalogue"). If common.py has no ready part for a count beside a schedule,
   write the request to `design/gen/requests/scorecard.md` for the language step instead of
   reinstantiating tiles().

2. **Give the Findings status badge its own tone, apart from severity**
   Why: CEO (medium): severity (Major, Minor) is colour coded but status (Reported, Open) uses the same
   neutral pill for both values, so the one thing a CEO most wants at a glance, whether anything is
   still unhandled, takes reading every card's text to answer.
   How: in `finding_card`'s status badge call, pass the tone that already exists in `common.badge`:
   `"pass"` for "Reported", `"neutral"` for "Open". No new token or common.py change is needed. Declined:
   the critic's own suggestion of the lavender promo tint. That colour is reserved for promo throughout
   the language; "Reported" is not a promo concept, and the pass tone already reads as settled without
   giving an existing token a second meaning.

3. **Lead the Runs note with the rule that explains the two pass rates**
   Why: CEO (medium): the FAIL banner's "Steps, 30 days, 98.6 %" and the Runs card's "23 of 28 runs
   passed" (82 %) read as contradictory before a reader reaches the sentence that bridges them, "A run
   passes when every step that ran passed," which today is the second sentence of the Runs note, after
   "One square per day, the day's last run."
   How: swap the order of the Runs section's two note sentences, so the bridging rule is the first thing
   read on arriving at the section, right after the banner: "A run passes when every step that ran
   passed. One square per day, the day's last run."

4. **Put the real refresh note on Findings, fold "Added as they are found" into it**
   Why: consistency: every section of Price truth and Scorecard carries a "Refreshes ..." note at the
   section head's right edge; Findings alone shows "Added as they are found" there instead, breaking the
   one rule LANGUAGE.md states for this page's sections.
   How: in the `sec("Findings", ...)` call, pass "Refreshes daily at 04:00 UTC" as the `refresh`
   argument and move "Added as they are found" into the note text after " · ", the way Top deals joins a
   refresh to its note.

5. **Lift the fail toned lead tile above 4.5:1 in the lab look**
   Why: craft (medium), measured: fail ink #B4500B on the tile's --panel (#F3EEE5) is 4.44:1, just under
   the lens's floor. LANGUAGE.md's own contrast table checks that ink against --fail-tint, not against
   the plain panel a toned tile actually sits on. The pixel tile already clears this (6.6:1), so it is
   lab only.
   How: a shared tiles() behaviour, not a page only fix: write the request to
   `design/gen/requests/scorecard.md` asking that a pass or fail toned tile take its tint background
   (--pass-tint or --fail-tint) in the lab look instead of plain --panel, the way the verdict banner and
   the badges already do for the same tones.

6. **Shorten the empty state's link so it stops breaking mid phrase**
   Why: the link "Read the API contract the probe checks" wraps after "the," splitting one link across
   two lines, on both the desktop and the phone. The consistency critic's claim that Price truth uses a
   narrower 574 px half column for its own empty state does not hold on inspection: Price truth's
   "Before the first cart sample" panel is the same single column, 760 px wide form Scorecard already
   uses (`empty_state(small=True)`'s own default). The 574 px half column only appears where a page
   shows two empty states side by side, Top deals and Find a deal, which is a different case; matching
   it here would make Scorecard's one empty state narrower than Price truth's, not the same.
   How: shorten the link text to fit one line at 760 px, for example "Read the API contract," since the
   sentence before it already says what the contract covers. No width change and no common.py change.

7. **Match Price truth's even row height in the "Latest run" card**
   Why: consistency: the toned "1" in the Failed row changes that row's line box against its neighbours
   (Passed to Failed about 28 px, Failed to Skipped about 25 px), where Price truth's own "Latest day"
   list holds an even 24 px on every row because it never tones a cell this way.
   How: needs a tone option inside common.data_table's own cell markup, so the coloured figure is part
   of the cell's span rather than a nested span from scorecard's local `toned()` helper. Add this to
   `design/gen/requests/scorecard.md` for the language step; scorecard.py's `strip_cards(...,
   latest_row=[...])` call stays as it is once that lands.

8. **Fit the pixel phone's longest latency label on one line**
   Why: phone (low): "price-mismatch · current-price" wraps to two lines only in
   ScorecardPixelPhone.png, making that one row taller than its seven neighbours on the same chart.
   Every other board keeps it on one line.
   How: shorten the label used for this row, for example "price-mismatch · price" (the repeated
   "current-" is the only reason it runs long), in the LATENCY list's first entry.

## Designer's response, round 3

1. **One sync card in Catalogue copy.** Done. The second tiles row is gone. The section is now "Catalogue sync" (LANGUAGE.md's Words table lists "catalogue copy" under Never) and uses the side cards form of Price truth's Freshness: on the left "Latest syncs: 0 errors", a table of the last two delta syncs and Monday's full load (Sync, Started, Deals read, Errors, the figures together at the right), with a foot note on what each kind reads; on the right the shared `sync_card`, "Next sync: 00:00 UTC", with "Last delta sync 21:00 UTC", "Delta syncs today 8", "Last full load 28 Sep" and "Listable deals 55,805 of 61,477". One vocabulary and one clock with Price truth; no "products", "full run", "delta run" or "Last refresh" left. The foot line says "the catalogue sync every 3 hours".
2. **Status badge in its own tone.** Done by `finding_card` in common.py: "Reported" is the pass tone, "Open" neutral, apart from severity. The board passes the status words only.
3. **The rule first in the Runs note.** Done: "A run passes when every step that ran passed. One square per day, the day's last run."
4. **A real refresh note on Findings.** Done: "Refreshes daily at 04:00 UTC" at the head's right, and the note ends "worst first · Added as they are found".
5. **Fail toned tile above 4.5:1.** Done by `tiles()` in common.py: the toned lead tile sits on the fail tint in both looks (lab 4.7:1).
6. **A short empty state link.** Done: "Read the API contract". It moves to a line of its own as one unit and no longer breaks inside.
7. **Even rows in "Latest run".** Done by `toned` in common.py; the local helper is gone and the Failed row now steps like its neighbours.
8. **One line for the pixel phone's longest latency label.** Declined as written. "current-price" is the live step name, and the builder will render it, so renaming it on the board would show a step the probe does not have. What changed instead: each half of "check · step" is kept whole, so on the pixel phone the name wraps cleanly at the dot ("price-mismatch ·" over "current-price") and never at the hyphen. That is how the live page will look too (a request line for `latency_bars` is in `design/gen/requests/scorecard.md`). The latency list is also corrected to the live eight slowest by p95: "price-mismatch · refused" ties "current-price" at 524 · 3,723 ms and "catalogue-walk · page-2" (805 ms) drops out. The Slowest p95 tile's hint says "Two price-mismatch steps, tied".

Also this round: the sample PASS verdict now sits in the shared `drawn_state`; the drift table takes the shared `data_table(grow=0)` (the local `grow_first_column` is gone); the latency card title is shorter ("p50 and p95, last 7 days") and the failing steps note too ("The other 38 steps: 37 passed, 1 skipped."), so neither wraps on the pixel phone; the board heights match their content (1280 by 3303 lab, 3384 pixel; 390 by 5137 lab, 5400 pixel).
