<!--
Shared-file changes lane ui-scorecard needs but cannot make itself, with what the integrator did.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-scorecard.md
Deps:    n/a
Tested:  n/a
-->
## test/app/pages.test.ts: the sync-facts parity test now compares two different things

What: `describe("sync facts on Price truth and the Scorecard")` reads each page's "Last delta sync"
`<dd>` with the same regex and asserts the two strings are equal. Round 2 (`docs/lanes/ui-scorecard.md`,
"Review round 2, loop 5 fixes", item 1) moves the Scorecard's `<dd>` to `syncFacts(sync, now).lastDeltaAt`
alone (the bare stamp, e.g. "21:05 UTC") and prints `lastDeltaNote`, when it is not null, as its own
`<p class="box-note">` line under the card's rows. Price truth's `price-truth.tsx` (lane `ui-price-truth`,
not mine to touch) still prints the old combined `facts.lastDelta` in its own `<dd>`, so for the two
fixtures named "a failed run in the current window" and "a late window after an earlier failed run"
(the ones where `lastDeltaNote` is not null) the two pages' `<dd>` text now differs by design: the
Scorecard's is the bare stamp, Price truth's still carries the appended state sentence.
Why: `test/app/pages.test.ts` is shared (not in `ui-scorecard`'s `owns` list), so I cannot edit it
myself, and the two lanes make this exact split independently, so neither side can wait for the other.
Ask: once `ui-price-truth` lands the same split (its own round 2 item 1), change `figure()`'s assertion
to compare `lastDeltaAt` alone, e.g. match `<dt>Last delta sync</dt><dd>([^<]*)</dd>` as today but assert
equality on that value only, and add a second comparison that the page's `box-note` text under the card
(present only when `lastDeltaNote` is not null) also agrees between the two pages for the same fixture.
Until this lands: `bun test` fails on exactly these two cases in this one shared describe block with a
stamp-only value on one side and the old combined sentence on the other; every other test, including
every test in `test/ui/pages/scorecard.test.tsx` and `test/lib/sync-facts.test.ts`, is green, and so are
`bun run typecheck` and `bun bin/lane-check.ts ui-scorecard`.

**Integrator, 2026-10-01 (review round 2): done.** `figure()` compares the bare stamps, and a second
check holds the state line under the card's rows equal between the two pages.

## latency_bars (src/ui/components/blocks.ts)

What: the dual-bar latency chart `design/LANGUAGE.md` names (`[latency_bars]`): p50 in front, p95
behind, one combined figure per step ("524 · 3,723 ms"), a 0 to 4 s axis, step names, and a "Show all
N steps" link under it.
Why: Scorecard's Latency per endpoint section wants both p50 and p95 for every step, drawn as the
board does. The only chart block in `blocks.ts` is the single-bar `histogram()`, whose `value` is one
bare number with no unit (`esc(String(bar.value))`), so it cannot carry both figures or a unit the
way the board's chart does.
Until this lands: `src/ui/pages/scorecard.tsx` uses `histogram()` instead, p95Ms driving the bar's
width and its `value`, p50Ms folded into the bar's `label` ("check · step: p50 412 ms, p95"). Both
figures are on the page; the chart just is not the two-tone bar the board draws.

**Integrator, 2026-10-01: done.** `latencyBars(rows)` in `src/ui/components/blocks.ts` (test
`test/ui/components/latency-bars.test.ts`): p95 behind and p50 in front on one track, "524 · 3,723 ms",
the two-key legend, an axis from 0 to 4 s that widens in whole seconds, each half of "check · step"
kept whole, and "Show all N steps" past eight as a `details` that needs no script. Lab and pixel styles
are in `app.css` and `pixel.css` (the app.css cap rose from 28 to 30 KB for it). `scorecard.tsx` now
draws latency with it, slowest p95 first.

## bin/walkthrough.ts: the scorecard check's "pass rate" regex is now stale

What: the scorecard check (`await check("the scorecard shows today's run with age, pass rate, failing
steps, latency and findings", ...)`) asserts `expect(/[Pp]ass rate/.test(html), "no pass rate")`. Round
2's board (`design/project/Scorecard.dc.html`, `docs/ops/loop5/design/r3-scorecard.md`) drops the words
"pass rate" from the page: the verdict banner now carries the two rates as `figureRow` figures labelled
"Steps, 7 days" and "Steps, 30 days", not a "Pass rate, N days" sentence. The round 2 fix brief
(`docs/ops/loop5.md`, item 18) asks for exactly this change, so `scorecard.tsx` no longer prints "pass
rate" anywhere, and this one walkthrough check will fail on the next run.
Why: `bin/walkthrough.ts` is shared (not in `ui-scorecard`'s `owns` list), so I cannot edit it myself.
Ask: change the assertion to match the new wording, e.g.
`expect(/Steps, 7 days|Steps, 30 days/.test(html), "no step rate")`, or loosen it to
`/[Pp]ass rate|Steps, \d+ days/`. The two other scorecard assertions in that check
(`hasFreshDay(html)`, the `p95`/finding/failing-step checks) are unaffected: `hasFreshDay` matches on
the `YYYY-MM-DD` date, which is still present inside the new `YYYY-MM-DD hh:mm UTC` stamp format (also
part of this round's fix, item 17).
Until this lands: the walkthrough's scorecard check fails on the "no pass rate" line; every other
check and both test gates (`bun test`, `bun run typecheck`) are green.

**Integrator, 2026-10-01: done.** The walkthrough's scorecard check accepts `/[Pp]ass rate|Steps, \d+ days/`.

## CheckRow / checkRows (src/ui/components/blocks.ts): no room for an Expected/Observed split

What: round 4 (`docs/ops/loop5.md`, Round 3, item 7; `docs/lanes/ui-scorecard.md`, "Round 4, loop 5
fixes", item 2) asks the Failing steps card to read like the board: a title naming the count ("1 of 39
steps failed"), each row with its own "Expected:" and "Observed:" lines (as `findingCard`'s
`FindingCardProps` already carries `expected`/`observed` fields for Findings), and a closing "The other
N steps: X passed, Y skipped." note.
Why: `CheckRow` (`blocks.ts`) has one `detail: string` field, and `checkRows()` escapes it as a single
`esc(row.detail)` span, so neither a two-line layout nor a labelled split is reachable through it;
`ScorecardReport["failingSteps"]` likewise carries one `detail` string, not separate `expected`/
`observed` fields the way `Finding` does.
Until this lands: `src/ui/pages/scorecard.tsx` no longer calls `checkRows()`. A local
`splitFailDetail()` splits each `detail` at its own "; " (the convention every check in
`src/probe/checks/*.ts` already writes its fail detail in, e.g. `` `guide: ...; the call itself failed
with ${code}` ``) into an `expected` and an `observed` half, and a local row-builder reuses the
existing `.check-row`, `.check-row-name`, `.check-row-badge` and `.check-row-detail` classes (already
styled for `checkRows()`) with the two escaped halves joined by one `<br>` for the second line. The
title and the closing note need no new component: they are `box({ title, body, note })` as it stands.
Ask: give `CheckRow` optional `expected`/`observed` fields (falling back to today's single `detail`
line when absent, so every other page that calls `checkRows()` is untouched) and render them as
`findingCard()`'s own `.finding-line`/`.finding-line-label` pair, so Failing steps can drop its local
row-builder and go back through `checkRows()`.

**Integrator, 2026-10-01: done.** `CheckRow` has optional `expected`/`observed`; when `expected` is set, `checkRows()`
draws the `.finding-line`/`.finding-line-label` pair in place of `detail` (`app.css`: `.check-row-detail
.finding-line{display:block}`). `scorecard.tsx` builds Failing steps with `checkRows()` and `splitFailDetail()`; the
local row builder is gone. Test: `test/ui/components/blocks-2.test.ts`.
