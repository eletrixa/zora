<!-- Module: docs/ops/loop5/design/r1-scorecard.md · Tested: n/a · Judge merge of the three critics and the consistency critic on Scorecard, loop 5 round 1 -->
# Round 1: Scorecard

## Scores

| Lens | Score |
|---|---|
| CEO | 3 |
| Phone (390 px) | 4 |
| Craft (against LANGUAGE.md) | 3 |
| Consistency (whole ten-board set) | 3 |
| **Judge, this page** | **2** |

The three single-lens scores each saw one structural problem in isolation. Read together with the
consistency findings, the page needs several structural changes, not one: the section order, the runs
card, the missing tiles row, two contradicted timestamps, and a latency chart built outside the shared
histogram. That is "two or more structural changes," so the page scores 2.

## Ranked changes for round 2

1. **Run the five sections in the brief's order, each full width**
   Why: CEO (high) and Craft both flag that Contract drift jumps ahead of Latency per endpoint and
   Catalogue copy, the two sections a reader needs for the daily-health read. `docs/lanes/design-unified.md`
   states the order Failing steps, Latency per endpoint, Catalogue copy, Contract drift, Findings; the
   board instead pairs Failing steps with Contract drift right after the run strip. This also fixes, as
   a side effect, Craft's low-severity note that the Failing steps card carries 60 to 80 px of dead
   space when `columns(stretch=True)` forces it to match the taller Contract drift card on a low-failure
   day: once the pairing is gone, so is the forced stretch.
   How: in `body()`, drop the `columns([failing, drift], ...)` pairing and the `_stretch` call; emit
   `failing`, then `latency`, then `catalogue`, then `drift`, then `findings` as five ordinary
   full-width `sec(...)` calls, in that order.

2. **Rebuild the "Runs, last 30 days" card as the shared day-strip form Price truth uses**
   Why: the consistency critic finds this card is a different component from Price truth's: no card
   title, no sentence, figures behind a divider instead of a card title plus a separate side card. CEO
   and Craft both separately flag that the banner's step-level "Pass rate, 30 days: 98.6 %" and this
   card's run-level "Pass 23 · Fail 5" (82 %) sit on the page with nothing telling them apart; giving
   the card Price truth's form, with its own stated unit, removes the ambiguity instead of just relabelling it.
   How: title the card "Last 30 days: 23 of 28 runs passed"; add a sentence at the card's foot, "Last
   fail on 30 Sep: 1 of 39 steps failed. No run on 17 and 18 Sep."; move the day-with-a-run count out
   of this card (see change 3); add a separate side card "Latest run: 30 Sep" with a labelled list
   (Passed 37, Failed 1, Skipped 1), the same `minmax(0, 1fr) 320px` layout `strip_section()` uses on
   Price truth.

3. **Add a tiles row under the verdict**
   Why: consistency finds Scorecard is the only report page with no tiles row under its verdict; Price
   truth, Top deals and Finder all put one there, and on this page it is where "Days with a run 28 of
   30" belongs once the runs card no longer carries it (change 2).
   How: `c.tiles(theme, [...], lead=True, phone=phone, display_lead=False)` right after the verdict
   banner: lead "Steps passed, 37 of 39"; then "Days with a run, 28 of 30"; "Slowest p95, 3,723 ms";
   "Open findings, 2 of 3".

4. **Fix the two timestamp contradictions against the shared schedule**
   Why: consistency finds the hero lead and verdict both say the last probe run was 11 hours ago at
   `12:23:45Z`, while every section note, the empty state and the foot all say the probe runs daily at
   04:00 UTC; and the Catalogue copy tile's "Last full run" hint says 30 Sep (a Wednesday) 09:11 to
   12:20, while Finder's own empty state says the full catalogue load runs every Monday at 05:00 UTC.
   Both read as the page contradicting its own stated schedule, which undercuts the CEO's trust in the
   numbers on a page whose whole job is trustworthy numbers.
   How: change `AGE`/`FINISHED` to `"19 hours ago"` / `"2026-09-30T04:00:12Z"` (LANGUAGE.md's own
   example moment); change the `CATALOGUE` "Last full run" hint to `"products, 0 errors; 28 Sep, 05:00
   to 08:09 UTC"`.

5. **Rebuild Latency per endpoint on the shared histogram, not a page-only chart**
   Why: consistency finds this chart uses its own legend-as-card-title, mono labels about 260 wide and
   an axis, where Price truth's "Options by gap" (the site's other histogram) has a card title, muted
   110-wide labels and the figure at the right; the phone lens separately flags the p95 legend swatch
   relying on a shade difference alone at swatch size, and the "Show all 29 steps" link sitting as bare
   text with no real touch target right under the dense axis.
   How: build the block on `common.histogram` in a two-value (p50, p95) mode, with a card title
   ("p50 and p95 per step, last 7 days") and the legend under it, Price truth's label style and a
   shared phone rule (stack the label when it is wider than 84 px); give the p95 swatch the same
   gapped and segmented fill the p95 bar itself uses, instead of a second shade of the same colour;
   give "Show all 29 steps" its own 44 px tall row instead of flush text under the axis.

6. **Give the verdict banner a PASS sample and a fixed word column**
   Why: consistency finds Price truth shows its verdict in both states (a live MATCHED banner and a
   captioned MISMATCHED sample below), while Scorecard shows only FAIL; and that the word column sizes
   to the word itself, so the sentence starts at a different x on each page's banner.
   How: add a captioned PASS sample under the live FAIL banner ("When the latest run passed"), matching
   Price truth's `state_caption` plus a second `c.verdict(...)` call in the "pass" tone; give
   `common.verdict`'s word column a fixed width, about 240 px, instead of `min-width: 130px`, so a FAIL
   and a PASS banner line up on the two pages (write this into `design/gen/requests/scorecard.md` since
   it touches `common.py`).

7. **Fix the empty state: its own next step, the shared width, no trailing period**
   Why: CEO and the phone lens both find the empty state's link, "Open Price truth.", sends a reader who
   came to check the probe to an unrelated product; on the phone board this card is the last thing before
   the foot line, so it reads as the page's parting word. Consistency separately finds the board is 840
   wide where Top deals and Price truth cap a single empty state at 760, and that the link's trailing
   period appears only on Scorecard and Top deals, not on Finder, Price truth or Deal.
   How: drop the link and state only the schedule ("Runs automatically every day at 04:00 UTC. Come back
   after that."), as the brief allows a sentence alone; change the board's wrapper from
   `max-width: 840px` to `760px`; if a link is kept anywhere, end it with no period.

8. **Craft polish: align Contract drift's figures, lead with relative time, match the finding-card words**
   Why: Craft finds Contract drift's From/To values ("3f9ac1…0c21", "version 6") are left-aligned prose
   where LANGUAGE.md's `data_table` calls for figure columns to be mono and right aligned; the
   Catalogue copy "Last refresh" tile leads with the bare clock time "21:01 UTC" against the Words
   table's rule that a moment is never led with a bare timestamp; and the Failing steps card writes
   "Guide: … Observed: …" as one muted paragraph where the Findings cards on the same page use "Expected:"
   and "Observed:" on their own lines, label muted and text in ink.
   How: right-align the From and To cells as mono figures in `drift_block`; swap the Catalogue copy
   "Last refresh" tile's value and hint so the figure is "2 hours ago" and the hint is "21:01 UTC"; write
   the failing step's body with the same two-line `label: text` pattern `common.finding_card`'s `line()`
   helper uses, instead of one merged sentence.

## Designer's response, round 2

1. **Five sections in the brief's order, full width.** Done. Failing steps, Latency per endpoint, Catalogue copy, Contract drift and Findings each run full width, in that order. The pairing and the stretch are gone, so is the dead space in the Failing steps card, which now carries its own count title ("1 of 39 steps failed") like the drift card.
2. **The runs card in Price truth's strip form.** Done with `strip_cards`: "Last 30 days: 23 of 28 runs passed", the foot note "Last fail on 30 Sep: 1 of 39 steps failed. No run on 17 and 18 Sep: the job did not run." (Price truth's wording for a missing day), and the 320 wide "Latest run: 30 Sep" card (Passed 37, Failed 1 in the fail ink, Skipped 1). Each square carries its date and outcome. To finish the unit fix, the banner's rates are now "Steps, 7 days" and "Steps, 30 days", the form of Price truth's "Carts, 30 days", so the step unit sits on the figure and the strip counts runs. The rates follow `src/probe/scorecard.ts` (passed over passed plus failed).
3. **Tiles row under the verdict.** Done: Steps passed 37 of 39 (the lead, in the fail tone with its cross, since the latest run failed), Days with a run 28 of 30, Slowest p95 3,723 ms, Open findings 2 of 3. The Catalogue copy tiles lost their lead, so the page has one lead tile. The pixel lead stays Plex Mono; the page's one display figure is the verdict word.
4. **Timestamps against the schedule.** Done: the lead reads "19 hours ago (2026-09-30T04:00:12Z)" from `CLOCK`. For the full run I kept the start and dropped the end time: "products, 0 errors; 28 Sep, 05:00 UTC". "05:00 to 08:09" pushed the hint past the two-line clamp on the pixel phone tile and cut it off. The start is the scheduled time `CLOCK` states.
5. **Latency on the shared histogram.** Done with `latency_bars` (folded from the round 1 request). It has the card title "p50 and p95 per step, last 7 days", a legend drawn in the bars' own fills (pixel p95 segmented), and "Show all 29 steps" as a 44 px text link. Declined: the 110 wide label from Price truth. LANGUAGE.md sets 260 for latency, because step names run to 30 characters. The phone stacks them.
6. **A PASS sample and a fixed word column.** Done. A captioned example under the page ("When the latest run passed", `verdict(example=True)`, no live region, not a display figure). The 288 column is in `common.verdict`.
7. **The empty state.** Width (760) and the missing period: done. Dropping the link: declined. LANGUAGE.md, consolidated after this file, asks for one link as the next step for this page's reader. The link now goes to the contract the probe checks every day ("Read the API contract the probe checks", the public openapi.json), not to another product.
8. **Craft polish.** Done. Contract drift sets Seen, From and To in mono, right aligned; Kind leads the row and takes the spare width, so the figures sit together at the right. The "Last refresh" tile leads with "2 hours ago", and its hint reads "21:01 UTC; the next at 00:00 UTC". The failing step's detail is two lines, "Expected: …" and "Observed: …", drawn with `label_line` as in the finding cards.
