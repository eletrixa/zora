<!-- Module: docs/lanes/ui-scorecard.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 (loop 5, wave B), model sonnet -->
# Lane ui-scorecard, loop 5: the Scorecard with a verdict, and the 404 page

**You build:** `src/ui/pages/scorecard.tsx`, the Scorecard page: a pure renderer from `ScorecardPageProps` to a full HTML document, cut from the boards, built from the shared blocks; and `src/ui/pages/not-found.tsx`, brought to the same language.
**Keep these exports:** `renderScorecard: PageRenderer<ScorecardPageProps>`, `ageText(fromIso, now)`, `renderNotFound: PageRenderer<NotFoundPageProps>`. Add `verdictOf(report)`.
**Read first:** `design/project/Scorecard.dc.html` and `ScorecardPhone.dc.html` (the structure, wording and order; the `Pixel` siblings are the other look, carried by the stylesheets), `docs/ops/loop5/design/r3-scorecard.md`, `design/LANGUAGE.md`, `src/ui/components/README.md` (the contract: every block and class you may use; nothing else), `src/contracts/pages.ts`, `src/contracts/reports.ts` (`ScorecardReport`, `ProbeRunRow`, `EndpointLatency`, `DriftEvent`, `Finding`, `SyncStatus`), the page as it is (keep every fact it states, the age line first of all, and every empty sentence with a time), `test/ui/pages/scorecard.test.tsx` (extend it), `docs/ops/loop5.md` "What working means", `AGENTS.md`.
**Test with:** literal reports; string assertions on the HTML.

## Behaviour

1. **Document**: `shell({ title: "Scorecard", active: "scorecard", body })`. Body in order: the hero (eyebrow "Product 2 · Partner experience daily probe", h1 "Scorecard", the lead is the age line exactly as today: "Last probe run 3 hours ago (2026-09-30T04:00:12Z): pass, 14 passed, 0 failed, 1 skipped." or "No probe run yet."), the verdict banner, the run strip, the sections in the board's order, the foot line.
2. **`verdictOf(report)`** returns `{ tone, title, text }`: pass or fail from `latestRun.verdict` (title "PASS" or "FAIL" as the board words it, text with the 7-day and 30-day pass rates as whole percents, or "no runs yet in this window"); neutral with the schedule ("The probe runs daily at 04:00 UTC.") when there is no run.
3. **The run strip**: `dayStrip` over `report.runs`, newest last, at most 30, tone from the verdict, the title `<finishedAt>: <verdict>, <passed> passed, <failed> failed`.
4. **Sections**, each a `section` with the board's title and lead: Latest run (the tiles: passed, failed with the fail tone when above zero, skipped, the two pass rates); Failing steps (`checkRows` as today; the existing sentence when none); Latency per endpoint (the histogram of `p95Ms` per step with `p50Ms` in the label or the value, as the board draws it; the existing sentence when empty); Catalogue copy (tiles from `sync`: listable products, total products, the last refresh with `ageText`, the last full and delta runs; the existing sentences); Contract drift (`dataTable`; the existing sentence when none); Findings (`findingCard` in `findingList`; the existing sentence when none).
5. **Foot line**: `pageFoot` with the schedule (the probe daily at 04:00 UTC, the delta sync every 3 hours, the full load Mondays 05:00 UTC).
6. **The 404 page**: `shell({ title: "Not found", active: null, body })` with the hero (eyebrow "Zora Agent Lab", h1 "Nothing at this address", lead naming the escaped path) and `button({ label: "Top deals", href: "/" })` beside `button({ label: "Find a deal", href: "/find", tone: "secondary" })`.
7. The acceptance script reads these words, so keep them: "Last probe run" and "ago", the run's date `YYYY-MM-DD`, "Pass rate" (or "pass rate"), "p95", the finding ids (F-001 and so on), each failing step's name and detail. Every value through `esc`. Never "no data". No `Date.now()` (`now` comes from the props).

## Tests you must have

`test/ui/pages/scorecard.test.tsx`, extended:
- opens with the age line as the lead, before anything else in the main content
- states the PASS verdict with both pass rates, the FAIL verdict on a failed run, and the schedule when no run exists
- draws one strip square per run with the verdict tone and the run's time in the title, at most 30, newest last
- keeps the tiles, the failing steps, the latency figures (p50 and p95), the catalogue copy, the drift rows and the finding cards, and every existing empty sentence
- names the schedule in the foot line
- marks the Scorecard nav link current
- escapes a finding text that carries HTML
- never says "no data"
- the 404 page names the path, escaped, and links to the home page and to the finder

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-scorecard`, on branch `lane/ui-scorecard`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-scorecard` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-scorecard.md` (what, why, the exact change) and you build against what exists. A block or class the README does not list is not yours to add: build the part inside your page file as a local function and write it into `requests/ui-scorecard.md` for the components lane. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-scorecard
```

Your changelog lines go in `changes/ui-scorecard.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-scorecard.md`: `| 2026-09-30 hh:mm | what you built | ui-scorecard | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-scorecard: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.

## Round 2, loop 5 fixes

From the round 1 check of 2026-10-01 01:00 UTC (`docs/ops/loop5.md`, Round 1). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **Raw stamps.** Where: `/scorecard`, both looks: the lead "Last probe run 12 hours ago (2026-09-30T12:23:45.124Z)"; the sync table's Started and Finished cells ("2026-10-01T00:01:27.366Z", wrapping over two lines). Expected: `Scorecard.png`: `YYYY-MM-DD hh:mm UTC` in the lead, "2026-09-30 21:00" in the table. See: `docs/ops/loop5/scorecard-lab-1280.png`.
2. **The tiles row and the Runs section are missing.** Where: `/scorecard`, both looks: the day strip floats under the banner with no section; "Latest run" is a second five-tile block; the banner says only "Pass rate, 7 days: 91%. Pass rate, 30 days: 91%."; section heads carry no refresh time; "Catalogue copy" has a long run table and a Catalogue card. Expected: `Scorecard.png`: the banner names the failing step in a sentence with "Steps, 7 days" and "Steps, 30 days" at its right; one tiles row (Steps passed 37 of 39, Days with a run, Slowest p95, Open findings); a Runs section with the strip card ("Last 30 days: N of M runs passed", legend, last fail sentence) beside the "Latest run" card; "Refreshes daily at 04:00 UTC" on every section head; "Catalogue sync" with the latest syncs table and the "Next sync" card; findings with their status pill at the right. See: `docs/ops/loop5/scorecard-lab-1280.png`.

## Round 3, loop 5 fixes

From the round 2 check of 2026-10-01 01:32 UTC (`docs/ops/loop5.md`, Round 2). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The Runs strip contradicts its own words.** Where: `/scorecard`, both looks, 1280: the section lead says "One square per day, the day's last run" and the tile says "Days with a run 2 of 30", but the strip shows 8 squares between "29 Sep" and "30 Sep", titled "Last 30 days: 2 of 8 runs passed". Expected: `Scorecard.png`: one square per day for the last 30 days (the day's last run), a "No run" square for a day without one, the title and the note counted in days ("N of M days passed"). See: `docs/ops/loop5/scorecard-lab-1280.png`.

## Round 4, loop 5 fixes

From the round 3 check of 2026-10-01 02:14 UTC (`docs/ops/loop5.md`, Round 3). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The Runs note lists every empty day, and calls today missed.** Where: `/scorecard`, both looks, 1280: "No run on 2 Sep, 3 Sep, 4 Sep, ... 28 Sep and 1 Oct: the job did not run.", three lines of dates, published at 02:11 UTC while today's run is due at 04:00 UTC. Expected: `Scorecard.png` ("No run on 17 and 18 Sep: the job did not run."): consecutive days as a range ("No run from 2 to 28 Sep"), and today, before its run time, neither counted nor named as missed: its square and sentence say the run is due at 04:00 UTC. See: `docs/ops/loop5/scorecard-lab-1280.png`.
2. **The Failing steps card is one bare row.** Where: `/scorecard`, both looks, 1280: one row "refusals · state-code", the Fail chip and the observed text. Expected: `Scorecard.png`: the card title "1 of 39 steps failed", the row with "Expected:" and "Observed:" lines, and the closing line "The other 38 steps: 37 passed, 1 skipped." See: `docs/ops/loop5/scorecard-lab-1280.png`.
3. **The banner rates read "91%".** Where: `/scorecard`, both looks, the "Steps, 7 days" and "Steps, 30 days" figures. Expected: `Scorecard.png`: one decimal and a space, "97.0 %", as every other percent on the site; `pct()` rounds to a whole number with no space. See: `docs/ops/loop5/scorecard-lab-1280.png`.

## Round 5, loop 5 fixes

From the round 4 check of 2026-10-01 02:35 UTC (`docs/ops/loop5.md`, Round 4). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

Your round 4 request landed on main: `CheckRow` takes optional `expected` and `observed`, `checkRows()` draws them as the labelled `.finding-line` pair, and `scorecard.tsx` already builds Failing steps through `checkRows()` with your `splitFailDetail()` (the local row builder is gone). Build on that.

1. **The failing step repeats its own words after the labels.** Where: `/scorecard`, both looks, 1280 and 390, the Failing steps card: "Expected: guide: a state abbreviation with no state scope answers HTTP 200 with zero products" and "Observed: observed HTTP 400 with no products array". Expected: `Scorecard.png`: "Expected: Guide, Inventory scope values: a state code with no state scope answers HTTP 200 with zero products." and "Observed: HTTP 400 invalid_argument, and no products array.": `splitFailDetail()` drops a leading "observed " from the second half and capitalises a leading "guide:" to "Guide:" in the first, so no line says its label twice. See: `docs/ops/loop5/scorecard-lab-1280.png`.

## Round 6, loop 5 fixes

From the round 5 check of 2026-10-01 02:44 UTC (`docs/ops/loop5.md`, Round 5). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

Round 5's Expected and Observed lines in the Failing steps card are closed. The two items left are the top of the page.

1. **The FAIL banner pastes the check's raw detail.** Where: `/scorecard`, both looks, 1280 and 390, the verdict banner: "1 of 39 steps failed: guide: a state abbreviation with no state scope answers HTTP 200 with zero products; observed HTTP 400 with no products array". Expected: `Scorecard.png`: one plain sentence, "1 of 39 steps failed: a state code answers HTTP 400 where the guide promises an empty page.": no "guide:" and no "observed" words, no semicolon joint. `verdictOf()` appends `worst.detail` as stored; build the sentence from `splitFailDetail()` (the observed half first, then what the guide promises), and keep the PASS sentence as it is. See: `docs/ops/loop5/scorecard-lab-1280.png`, the banner.
2. **The hero lead is one plain line.** Where: `/scorecard`, both looks, 1280 and 390, the hero: "Last probe run 14 hours ago (2026-09-30 12:23 UTC): fail, 37 passed, 1 failed, 1 skipped." in regular weight, nothing more. Expected: `Scorecard.png`: the counts bold ("**fail, 37 passed, 1 failed, 1 skipped**") and the second sentence "Every day at 04:00 UTC the probe walks the partner journey on production, as an outside builder would." `hero()` takes `lead: { text, strong }` since round 3 (Price truth uses it); pass the counts as `strong`. See: `docs/ops/loop5/scorecard-lab-1280.png`, the top.

## Review round 1, loop 5 fixes

From the CEO review round 1 of 2026-10-01 03:04 to 03:08 UTC (`docs/ops/loop5.md`, CEO review round 1; the answer verbatim in `docs/ops/loop5/ceo-review-1.txt`). Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green; a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The Catalogue sync card does not tell a complete sync from a running, failed or late one, and must say the same as Price truth.** Where: `src/ui/pages/scorecard.tsx`, `nextSyncBox`: `lastRunOfKind` takes the newest run of any status and prints `finishedAt ?? startedAt`; "Delta syncs today" counts every delta run started today, whatever its status. The reviewer: Price truth and the Scorecard "contradict each other about what actually happened"; the first change asked: "distinguish scheduled, completed, stale and missing data ... and test those meanings across pages." Done looks like, in the same words Price truth now uses (its round 1 item 1): Last delta sync = the newest delta run with `status: "complete"`, `finishedAt` as `hh:mm UTC` (short day when not today); a newer `running` delta run adds "Running since hh:mm UTC", `failed` adds "Failed at hh:mm UTC"; when the latest 3 hour boundary is more than 30 minutes past and no delta run started at or after it, "Late: the hh:00 UTC sync has not started"; Delta syncs today = complete delta runs started on today's UTC day; Last full load = the newest complete full run's short day; "none yet" when a kind has no complete run; "Next sync: hh:mm UTC, scheduled". Tests: complete, running, failed, late, none. The integrator adds the cross-page test in `test/app/pages.test.ts` at the merge.

## Review round 2, loop 5 fixes

From the CEO review round 2 of 2026-10-01 03:49 to 03:54 UTC (`docs/ops/loop5.md`, CEO review round 2; the answer verbatim in `docs/ops/loop5/ceo-review-2.txt`, the pages as reviewed in the public snapshot's `review/`). Each item: what is wrong, where, what the reviewer said, what done looks like. Keep every walkthrough check green (a new one on main, "Price truth's Options by gap bands add up to its caption's promo count, or say when they arrive", misses on the live site until the monitor and ui-price-truth items land); a shared file change goes to your `requests/` file. Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

1. **The Last delta sync card's value is a whole sentence.** Where: `src/ui/pages/scorecard.tsx`, the Catalogue sync Schedule card, value "30 Sep, 21:01 UTC. Running since 00:01 UTC. Late: the 03:00 UTC sync has not started" in the narrow value column. The reviewer asks for "readable rendering across all five pages, both looks and both widths". Done looks like: the value is `syncFacts(sync, now).lastDeltaAt` (on main since `4a349fe`) and `lastDeltaNote`, when not null, is a line under the card's rows, the same as Price truth, so `test/app/pages.test.ts` keeps both pages on one figure. Tests: a note when a run is open or late, none when the newest run is complete.
