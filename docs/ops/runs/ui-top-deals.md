<!--
Run evidence for lane ui-top-deals.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  docs/ops/runs/ui-top-deals.md
Deps:    n/a
Tested:  n/a
-->
| When (UTC) | What | Lane | Model | Billed cost |
|---|---|---|---|---|
| 2026-09-30 20:30 | Re-cut Top deals onto the shared loop 5 round 2 blocks (hero, pickerCard, resultsHead, rankList/rankRow, footnotes, pageFoot) per docs/lanes/ui-top-deals.md round 2 | ui-top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |
| 2026-10-01 01:30 | Round 2 fix: results head, sort and podium flush on the page via pageSection, only the ranked list boxed (item 8, docs/ops/loop5.md Round 1) | ui-top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |
| 2026-10-01 02:30 | Round 4 fix: Typical saving tile keeps its decimal, toFixed(1) instead of Math.round (item 1, docs/ops/loop5.md Round 3) | ui-top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |
| 2026-10-01 04:39 | CEO review round 3 fix: picker note names the city-scoped category count instead of claiming "Groupon's top categories" (item 12, docs/ops/loop5.md CEO review round 3) | ui-top-deals | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |
