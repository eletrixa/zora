<!-- Module: docs/ai-builder/prompts/README.md · Tested: n/a -->
# Prompts

Every prompt that built Zora Agent Lab's two rounds, in order. The lane briefs (05 to 10), the design
prompt (04) and the review prompt (12) were files in the repository before the agent they were for saw
them; the plan (03) and the acceptance list (11) are copies made after launch of texts that existed
earlier, and their rows say so. Round 2 added no copy-after-launch prompt like round 1's plan and
acceptance list: the design brief (14), the eight lane briefs (15) and the site review prompt (16) were
all files in the repository before the agents they were for saw them too; prompt 13, the owner's own
ask, is a cleaned rendering of what was said, like prompts 01 and 02. The lane briefs were each given to
their lane agent with the same spawn line, quoted once here instead of on every row:

> Your complete brief is the file docs/lanes/<lane>.md in your worktree <path>. Read it first with
> cat, then do exactly what it says. Work only inside that directory and run every command from it
> (cd there first; it is a git worktree on branch lane/<lane>). When you are done, answer with the
> structured result: lane, commits (subjects), gates (green or red), changesFile, requests (paths of
> any requests file you wrote), notes (under 120 words).

| # | When (UTC) | From, to | Prompt | Lives at | Cleaned |
|---|---|---|---|---|---|
| 01 | 2026-09-30, pasted at 14:15 | CEO, builder | the ask | `prompts/01-the-ask.md` | English rendering of the Czech original: names removed, grammar tidied, same length |
| 02 | 2026-09-30 14:15 and 15:05 | builder, coding session | the instruction | `prompts/02-the-instruction.md` | names removed, typos tidied, same length |
| 03 | 2026-09-30 about 15:30 (approved); copied into the repo at 20:16 | coding session, builder | the plan (approved) | `prompts/03-plan.md` | a copy, made at 20:16, of the plan file that lived outside the repository (the coding tool keeps plans there); names to roles, private paths and one canvas link to neutral phrases; otherwise the plan as approved |
| 04 | 2026-09-30 15:50 to 19:46 | coding session, Claude Design and three review agents | the design prompt, the builder's turn, the critique panel prompt, the third pass | `prompts/04-design-prompt.md` | verbatim (the builder's turn is quoted with typos tidied) |
| 05 | 2026-09-30 15:36 | integrator, lane agent | lane brief: sync-category | `docs/lanes/sync-category.md` | none |
| 06 | 2026-09-30 15:37 | integrator, lane agent | lane brief: top-deals | `docs/lanes/top-deals.md` | none |
| 07 | 2026-09-30 15:37 | integrator, lane agent | lane brief: ui-components-top-deals | `docs/lanes/ui-components-top-deals.md` | none |
| 08 | 2026-09-30 15:43 | integrator, lane agent | lane brief: ui-top-deals | `docs/lanes/ui-top-deals.md` | none |
| 09 | 2026-09-30 15:43 | integrator, lane agent | lane brief: docs-showcase | `docs/lanes/docs-showcase.md` | none |
| 10 | 2026-09-30 15:44 | integrator, lane agent | lane brief: export-public (the snapshot exporter) | private repository only: the brief lists the private strings the exporter removes, so it cannot ship; what it built is described in `CHANGELOG.md` | withheld, reason stated |
| 11 | 2026-09-30 19:39 (the row and the checks committed), 20:06 to 20:29 (the runs); copied at 20:16 | integrator, the acceptance script | the acceptance list and the check names | `prompts/05-acceptance.md` | a copy, made at 20:16, of the row in `docs/ops/loop4.md` and the check names in `bin/walkthrough.ts`, both committed at 19:39 and 19:49, before the page went live at 20:06 |
| 12 | 2026-09-30 19:43 (written), 20:17 (first run) | integrator, second model (GPT through the codex CLI) | the CEO review prompt | `prompts/12-ceo-review-prompt.md` | verbatim; the answers are in `docs/ops/loop4/ceo-review-N.txt` |
| 13 | 2026-09-30, between 20:45 and 20:53 (committed 20:53) | owner, coding session | the second ask | `prompts/13-the-second-ask.md` | grammar tidied, same length and substance |
| 14 | 2026-09-30 22:00 | integrator, design agents | the design brief: one site, two looks | `docs/lanes/design-unified.md` | none |
| 15 | 2026-09-30 21:10 | integrator, lane agents | the eight lane briefs of loop 5: ui-components-unified, ui-pixel, ui-finder, ui-price-truth, ui-scorecard, ui-deal, and the round 2 sections of ui-top-deals and docs-showcase (this file) | `docs/lanes/ui-components-unified.md`, `ui-pixel.md`, `ui-finder.md`, `ui-price-truth.md`, `ui-scorecard.md`, `ui-deal.md`; round 2 sections of `ui-top-deals.md` and `docs-showcase.md` | none |
| 16 | 2026-09-30 21:10 (written), 2026-10-01 03:04 (first run) | integrator, second model (GPT through the codex CLI) | the CEO review prompt for the whole site | `prompts/16-ceo-review-site.md` | verbatim; the answers are in `docs/ops/loop5/ceo-review-N.txt` |

"Cleaned" says what differs from what was typed: "verbatim" or "none" means the file is the text as given;
the human messages (01, 02, 13) are renderings with names removed (01) and grammar tidied, same length and
substance; the plan (03) has private paths and names replaced. Nothing here is a reconstruction from memory:
every prompt was written before the agent or the person it was for saw it. For the lane briefs (05 to 10),
the design prompt (04), the review prompt (12), the round 2 design brief (14), the round 2 lane briefs (15)
and the round 2 review prompt (16), the commit that added the file precedes the work it produced; for the
plan (03) and the acceptance list (11) the files in this folder are copies made at 20:16, after the page
went live, of texts that existed earlier (the plan file outside the repository, approved at about 15:30;
the loop record and the checks committed at 19:39 and 19:49). The timeline in `docs/ai-builder/evidence.md`
gives the commit times for round 1; round 2's commit times are `git log` on the files above.
