<!-- Module: docs/lanes/probe-runner.md · Tested: n/a -->
# Lane probe-runner

**You build:** `src/probe/run.ts` and `src/probe/scorecard.ts`.
**Keep these exports:** `runProbe(ctx: ProbeContext, checks: readonly ProbeCheck[]): Promise<JobSummary>`; `createScorecardReadModel(db): ScorecardReadModel`.
**Read first:** `src/contracts/ports.ts` (ProbeCheck, ProbeContext, ProbeStepResult with `observed`, JobSummary), `src/contracts/reports.ts` (ScorecardReport and its rows), `migrations/0004_probe.sql`, `migrations/0006_ops.sql` (findings).
**Test with:** `makeWorld()` and hand-made checks (objects with `name` and `run`); do not depend on the real checks.

## Behaviour of `runProbe`

1. Runs the checks **one after another** in the given order. A check that throws becomes ONE step: `verdict: "fail"`, `step: "crashed"`, `detail` = the message (at most 300 characters). The run goes on.
2. A check that returns no step counts as one `skip` step (`step: "empty"`).
3. Writes one `probe_runs` row and every step into `probe_steps` (`at` = the time the check finished). Use `db.batch` in chunks of at most 40.
4. **Drift:** for every step with `observed`: read `contract_snapshots` for that kind. No row: insert it (a first observation is not a drift). Different value: insert a `drift_events` row (`from_value`, `to_value`) and update the snapshot. Same value: only `observed_at` moves.
5. Verdict `fail` when any step failed; skips do not fail a run. `JobSummary.ok` is true when the verdict is `pass`. Summary: `"9 passed, 1 failed, 1 skipped; failed: refusals/state-outside-list"` (name at most five failed steps).
6. After the run, **sweep**: every cart in `ctx.carts.listOpen(0)` with source `probe` is abandoned. The probe leaves nothing behind.
7. `detail` and `error_code` are stored as given, cut to 500 and 60 characters. Never store a header value or a key.

## Behaviour of the scorecard

`report(days)`: the latest run; runs of the period newest first; pass rate over 7 and 30 days = passed steps / (passed + failed) (null without data); latency per `(check, step)` with at least 3 samples that have `latency_ms`: nearest-rank p50 and p95; drift events newest first; findings ordered blocker, major, minor then newest; the failing steps of the latest run.

## Tests you must have

Order kept; crash becomes a step; empty check; rows written; first observation no drift; changed value writes drift and moves the snapshot; verdict and summary text; probe carts swept; pass rates; percentiles on a known set; empty database gives an empty report without throwing.
