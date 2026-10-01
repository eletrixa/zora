<!-- Module: docs/ops/loop5/design/r3-top_deals.md · Tested: n/a · Judge merge of the craft critic and the consistency critic on Top deals, the home page, loop 5 round 3 -->
# Round 3: Top deals, the home page

## Scores

| Lens | Score |
|---|---|
| CEO | not supplied this round |
| Phone (390 px) | not supplied this round |
| Craft (against LANGUAGE.md) | 5 |
| Consistency (whole board set) | 4 |
| **Judge, this page** | **4** |

No CEO or phone critic ran on this page this round. Craft scored the page 5, nothing to change, and
looking at all four boards (TopDeals, TopDealsPixel, TopDealsPhone, TopDealsPixelPhone) confirms it:
the part order matches LANGUAGE.md end to end (header, hero, picker, tiles, results head with the sort
toggle, podium, rank rows, promo codes, the two drawn states, foot) in both looks, nothing runs wider
than its board, the accent stays a single mark (the sort toggle's fill, the rules, the save pill), and
lab and pixel share one structure with only the skin changed. The consistency critic scored the whole
ten-board set a 4 and raised two findings against this page, both confirmed directly in the boards and
in the code that draws them: a leftover period in the results head note, and a phone gap that is 4 px
short of what its three sibling pages use for the same two-state stack. Neither is a structural change,
a missing part or a broken rule; each is a one-value or one-line text fix in an already-built pattern.
That keeps the page at a 4, polish only, not a 3.

## Ranked changes for round 4

1. **Drop the leftover period where the results note joins the refresh**
   Why: Consistency critic, and the more visible of the two on a straight read of the boards: it sits
   in the results head, the first thing a reader hits under "Top 20 in New York, NY: Things To Do", on
   every board width. Confirmed on both desktop boards (design/preview/shots/TopDeals.png and
   TopDealsPixel.png): the note reads "Ordered by the amount you save, largest first; one row per deal.
   · Refreshes every 3 hours", a full stop sitting right in front of the joining dot. Scorecard's
   Findings section joins the same way with no period: "…worst first · Added as they are found". A CEO
   or a reviewer scanning boards side by side, which is the consistency lens's own job, lands on the one
   page where the join reads as a typo instead of a clean two-clause line.
   How: `section_head` in `design/gen/common.py` (lines 724 to 742; `results_head` calls it) builds
   `note_bits = [esc(note)] if note else []` and only appends `esc(refresh)` when both `refresh` and
   `aside` are given, then joins every bit with `" · "` (line 737). Top deals is the one page whose
   results section carries both a sort toggle (the `aside`) and a refresh note, so it is the one page
   that exercises this join; `ORDER_NOTE` in `design/gen/top_deals.py` (line 25) is the note it affects.
   Fix the join, not the note: when a refresh is about to be appended to `note_bits`, strip one trailing
   "." from the item already in `note_bits` first, so the line reads "…one row per deal · Refreshes
   every 3 hours", the same form as Scorecard's. `common.py` belongs to the language step, so write the
   request into `design/gen/requests/top_deals.md` ("section_head: drop a trailing period from the note
   before it joins the refresh with ' · '") rather than editing it directly.

2. **Give the phone's two drawn states the same 20 px gap as every sibling page**
   Why: Consistency critic. Confirmed on both phone boards (design/preview/shots/TopDealsPhone.png and
   TopDealsPixelPhone.png): "When nothing matches" and "Before the first category walk" stack with a
   visibly tighter step than the rest of the page's between-block rhythm. Find a deal and Price truth
   stack their own pair of phone drawn states at 20, Scorecard at 20 as well for its passed-or-failed
   pair; Top deals is the one page that stacks its pair at 16. A phone walkthrough of all four products
   back to back feels Top deals crowd its two states where every other page gives them the same breathing
   room.
   How: `empties()` in `design/gen/top_deals.py` (line 166) calls `c.stack([none_found, no_walk],
   gap=16)` on the phone. Every sibling page sets the same stack to `gap=20` inline, with no shared
   helper behind it (`design/gen/finder.py` line 161, `design/gen/price_truth.py` line 219). Change the
   one literal to `gap=20`; that alone matches the other three pages, so no new helper in `common.py` and
   no request are needed for this one.

Dropped: nothing. Both findings are a one-character text fix and a one-value spacing fix inside patterns
the other pages already use correctly; neither touches this page's structure, its one-arrangement rule,
or anything LANGUAGE.md sets on purpose, so nothing here contradicts the brief.
