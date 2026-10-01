<!-- Run evidence for lane sync-category. Module: docs/ops/runs/sync-category.md · Tested: n/a -->

| When (UTC) | What | Lane | Model | Billed cost |
|---|---|---|---|---|
| 2026-09-30 15:53 | Built the daily category walk: category runs in `src/sync/walk.ts`, tags in `src/sync/tags.ts`, the 38 run cycle in `src/sync/category.ts`, `startCategoryWalk`, the Workflow cycle branch, category runs left out of the sync status; 15 tests in `test/sync/category.test.ts` | sync-category | opus (Claude Code subagent, Max subscription) | subscription, no per-run bill |
| 2026-10-01 04:38 | Loop 5 CEO review round 3 item 1: a delta call whose walk throws fails its run with `CRASH` and the next call opens a fresh run; 3 tests in `test/sync/sync.test.ts` | sync-category | opus (Claude Code subagent, Max subscription) | subscription, no per-run bill |
