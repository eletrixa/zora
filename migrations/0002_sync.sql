-- Catalogue sync bookkeeping.
-- Project: zorasocial. Module: migrations/0002_sync.sql. Tested: test/contracts/schema.test.ts
-- Writer: lane sync (src/sync/).

CREATE TABLE sync_runs (
  run_id               TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL,                  -- full | delta
  status               TEXT NOT NULL,                  -- running | complete | failed
  started_at           TEXT NOT NULL,
  finished_at          TEXT,
  page_size            INTEGER NOT NULL,
  updated_since        TEXT,                           -- delta only: the watermark sent
  cursor               TEXT,                           -- next cursor to fetch; NULL before page 1 and after the last
  pages                INTEGER NOT NULL DEFAULT 0,
  products             INTEGER NOT NULL DEFAULT 0,
  errors               INTEGER NOT NULL DEFAULT 0,
  last_page_timestamp  TEXT,                           -- `timestamp` of the newest page received
  error_log            TEXT NOT NULL DEFAULT '[]'      -- JSON array of {at, code, message, requestId}, newest last, max 50
);
CREATE INDEX sync_runs_started ON sync_runs (started_at);

-- key 'last_refresh_at': watermark for the next delta. Written ONLY after a complete walk,
-- value = final page timestamp minus 10 minutes.
CREATE TABLE sync_state (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
