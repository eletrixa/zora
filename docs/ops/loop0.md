<!-- Module: docs/ops/loop0.md · Tested: n/a -->
# Loop 0: review of the plan and the contracts, 2026-09-29

Two read-only sonnet reviewers attacked the plan and the Wave 0 contracts before any lane started.

## Cloudflare feasibility

| Point | Outcome | Proof |
|---|---|---|
| Account plan | Workers Paid | 25 cron triggers across the account; Free allows 5 per account |
| Workflow size | Fits | Paid: 10,000 steps and 10,000 subrequests per instance; the full load needs about 1,200 pages at 50 per page |
| Step result size | Rule kept in the sync brief | A step returns a summary, never the products (limit 1 MiB) |
| Cron string matching | Works | The 19:15 UTC run of `15 * * * *` wrote its `job_runs` row |
| FTS5 on D1 | Works | Migration applied; a ranked `MATCH` with `porter unicode61 remove_diacritics 2` answered on the live database |
| Cron wall time | Fits | 15 minutes per scheduled run; the probe and the cart sample need under one minute |
| Static assets through the Worker | Correct as written | `run_worker_first` plus `ASSETS.fetch` |
| MCP approach | Reviewer proposed the `agents` package. Not taken | The hand-written stateless JSON-RPC server needs no package and no Durable Object |
| D1 bound parameters | Not verified by the reviewer | The briefs keep the documented limit of 100 per statement and batches of 40 statements |

## Lane collisions

Four findings of the first pass were closed by the lane briefs, the reference seeding (`test/fakes/seed.ts`)
and the `observed` field on probe steps: the MCP package gap, the ingest route, the guide-version wiring, the
20-line cart limit. One new finding: three briefs pointed to a file that does not exist. Fixed.

No change to `src/contracts/` was needed after the review.
