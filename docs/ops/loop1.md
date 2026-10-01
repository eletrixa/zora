<!-- Module: docs/ops/loop1.md · Tested: n/a -->
# Review loop 1, 2026-09-29

Four read-only sonnet reviewers on the merged Wave 1 code. Every finding below was confirmed by
reading the code path; each has an owner and a state.

| # | Severity | Finding | Where | Owner | State |
|---|---|---|---|---|---|
| S1 | High | The public return page made the Worker call Groupon on every request, and pacing was per request | `src/return/routes.ts`, `src/container.ts` | integrator | Fixed: stored view, one read per 3 s per order, 30 reads a minute over all, shared pacer |
| S2 | Medium | Fifty wrong PINs from anywhere locked the owner out | `src/auth.ts` | integrator | Fixed: lockout per address only |
| F1 | High | A catalogue write split across batches could leave a product without options for good | `src/catalogue/` | catalogue-store | Fixed and merged |
| F2 | High | A failed abandon of an unavailable cart was dropped without a trace | `src/carts/index.ts` | carts | Fixed and merged |
| F3 | High | The daily cart sample dropped a failed abandon and still reported ok | `src/monitor/sample.ts` | monitor | Fixed and merged |
| F4 | Medium | The probe's own cart sweep dropped failures | `src/probe/run.ts` | probe-runner | Fixed and merged |
| F5 | Medium | The cart sweep counted failures without saying which cart or why | `src/carts/index.ts` | carts | Fixed and merged |
| F6 | Low | A broken error log in `sync_runs` was reset without a word | `src/sync/walk.ts` | sync | Fixed and merged |
| G1 | Medium | Order reads retried with 2, 4, 8, 16 s; the guide says 2, 4, 8, 15, 30 s | `src/partner/index.ts` | partner-client | Fixed and merged |
| G2 | Medium | An option Groupon refused in a cart stayed on offer | contracts, `src/catalogue/`, `src/shopping/`, `src/monitor/` | integrator, then lanes | Fixed and merged: `markUnavailable`, called by shopping and the cart sample |
| A1 | High | `zal search --max 50` asked for deals up to $5,000 | `bin/zal.ts` | cli | Fixed and merged |
| A2 | Medium | Every search ranked the options of the whole table | `src/search/index.ts` | search | Fixed and merged |
| A3 | Low | The scorecard counts its 7 and 30 days back from the last run, not from today | `src/probe/scorecard.ts` | integrator | Open: the scorecard page will show the age of the last run (Wave 3) |

Checked and found sound by the reviewers: HTML escaping, bound SQL including the full-text query,
constant-time token and PIN comparison, fail-closed gates, the key never in a log or an error,
`bin/register` key handling, the retry split per error, the watermark rule, `buyLink` verbatim,
integer money throughout, the MCP message shapes.

Added during the loop, seen on the live site: a promo gap snapshot of zeros was written for an empty catalogue. Fixed in the monitor lane: an empty catalogue produces no snapshot and no sample.

## Review loop 2, on the fix diff only

One read-only sonnet reviewer re-tested every fix. Eleven findings confirmed fixed. Two new findings:

| # | Severity | Finding | Owner | State |
|---|---|---|---|---|
| R1 | Medium | The search fix cut the candidates to 200 before the price filter: with 250 dear matches ranked first, ten cheap ones were never returned (proved by a test) | search | Fixed and merged; the proved case is a permanent test |
| R2 | Medium | The shared pacer had no upper bound on the wait: a burst could queue requests for minutes | integrator, partner-client | Fixed and merged. Proved with callers that really arrive together (`test/app/pacing.test.ts`): of fifty at once, sixteen are sent one second apart and thirty-four answer BUSY |

One claim of the reviewer was wrong and is not acted on: `POST /checkout` is behind the PIN gate, and a checkout link needs one partner call, not three.

Found while closing R2: `FakeClock.sleep` moves time at once, so a burst never queued in the lane tests. `QueueClock` was added for tests of things that happen at the same time.
