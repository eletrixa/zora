<!-- Module: docs/lanes/sync.md · Tested: n/a -->
# Lane sync

**You build:** `src/sync/` — the full catalogue load, the delta refresh and the sync status.
**Keep these exports:** in `src/sync/index.ts` `startFullSync: Job`, `runDeltaSync: Job`, `getSyncStatus(db, catalogue): Promise<SyncStatus>`; in `src/sync/workflow.ts` `class CatalogueSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams>` and `interface SyncParams`.
**Hard rule:** only `src/sync/workflow.ts` may import `cloudflare:workers`. Everything else, including `index.ts`, must load under `bun test`. Put the logic in a pure module (`src/sync/walk.ts`) that takes `Deps` and a step runner; the Workflow class is a thin shell that builds `Deps` with `buildDeps(this.env)` from `src/container.ts`.
**Read first:** `src/contracts/ports.ts` (Job, JobSummary, Deps, PartnerClient.listProducts, CatalogueStore), `src/contracts/reports.ts` (SyncStatus, SyncRunRow), `migrations/0002_sync.sql`, guide lines 484-566 (Syncing the catalog, Keeping your catalog fresh, Rules for every walk).
**Test with:** `makeWorld()` from `test/fakes/env.ts` (fake partner with paging, fake catalogue, in-memory D1, fake clock).

## Behaviour

1. **Walk:** pages in order, the same query on every page, cursor sent back unchanged, until `hasMore` is false. Page size from `env.SYNC_PAGE_SIZE` (default 50). Each page: `catalogue.upsertProducts(products, runId, now)`, then update `sync_runs` (`pages`, `products`, `cursor`, `last_page_timestamp`).
2. **Resume:** a walk that stops (crash, step retry) continues from the `cursor` stored in `sync_runs`, never from page 1. A page already stored must not be counted twice after a retry.
3. **Errors:** the partner client already retries. When it still fails: `TIMEOUT` or `INTERNAL_SERVER_ERROR` on a page halves the page size (not below 10) and restarts the WALK from page 1 with the new size (the guide requires identical parameters across one walk). Any other error fails the run: `status = failed`, the error appended to `error_log` (keep the newest 50).
4. **Completion of a full load:** `catalogue.retireUnseen(runId)`, then `sync_state.last_refresh_at` = timestamp of the FINAL page minus 10 minutes. Never write the watermark after an incomplete walk.
5. **Delta:** `updatedSince` = the stored watermark; **never send `active`**. No watermark yet: do nothing, return `ok: false` with summary "no full load yet". A delta may return the whole catalogue; that is legal. A delta never calls `retireUnseen`. On completion move the watermark the same way.
6. **Delta budget:** cron invocations are short. `runDeltaSync` handles at most 40 pages per call; when more remain it leaves the run `running` with its cursor and the next call continues it (cursor lifetime is 24 hours; an older run is marked failed and a new one starts).
7. **`startFullSync`:** refuses when a full run is `running` and younger than 6 hours. Otherwise inserts the `sync_runs` row and creates the Workflow instance (`env.SYNC_WORKFLOW.create({ id: runId, params })`). Returns at once; `ok: true` means started.
8. **Workflow:** one `step.do` per page, named `page-<n>`. A step returns only a small summary (cursor, count, timestamp), never the products: a step result is limited to 1 MiB.
9. **`getSyncStatus`:** last 20 runs newest first, the watermark, product counts from `catalogue.countProducts()`.

## Tests you must have

Full walk over the fixtures with page size 5 (3 pages, 13 products, watermark = final timestamp minus 10 minutes); resume after a failure on page 2 without double counting; page size halves after a timeout and the walk restarts; watermark untouched after a failed run; delta sends `updatedSince` and no `active`; delta without watermark does nothing; delta budget continues on the next call; second full sync refused while one runs; retireUnseen called only after a complete full load.
