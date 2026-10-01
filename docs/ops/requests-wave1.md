<!-- Module: docs/ops/requests-wave1.md · Tested: n/a -->
# Requests from Wave 1 lanes and what was decided

| Request | From | Decision |
|---|---|---|
| `bin/lane-check.ts` misreads unstaged paths (trims before cutting the status columns) | 13 lanes | Fixed on main after the first report, with a test (`porcelainPath`) |
| `allowImportingTsExtensions` in `tsconfig.scripts.json` | cli | Declined: the gates pass without it |
| The job crash test depended on a lane being unbuilt | monitor | Fixed on main before the lane finished: the test passes its own crashing job |
