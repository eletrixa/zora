<!-- Module: docs/ops/runs/monitor.md · Tested: n/a -->
# monitor lane run evidence

| When (UTC) | What | Lane | Model | Billed cost |
|---|---|---|---|---|
| 2026-10-01 03:24 | Loop 5 CEO review round 1 fix: the promo-gap job writes `promo_gap_bands` under its own `taken_at` in the same run as the snapshot row; the read model's `gapBands` reads that stored histogram instead of recomputing it live, so the caption and the bands can never describe two different moments again | monitor | Claude Opus 5.5 via Claude Code subagent | subscription, no per-run bill |
| 2026-10-01 04:05 | Loop 5 CEO review round 2 fix: `gapBandsAt` answers `[]` when a snapshot has no stored bands (or there is no snapshot), instead of nine zero-count bands read as a real measurement | monitor | Claude Opus 5.5 via Claude Code subagent | subscription, no per-run bill |
