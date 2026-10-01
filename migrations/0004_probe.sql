-- Partner experience daily probe.
-- Project: zorasocial. Module: migrations/0004_probe.sql. Tested: test/contracts/schema.test.ts
-- Writer: lane probe-runner (src/probe/run.ts). Checks return rows; only the runner writes.

CREATE TABLE probe_runs (
  run_id       TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL,
  finished_at  TEXT NOT NULL,
  verdict      TEXT NOT NULL,                          -- pass | fail
  passed       INTEGER NOT NULL,
  failed       INTEGER NOT NULL,
  skipped      INTEGER NOT NULL
);
CREATE INDEX probe_runs_started ON probe_runs (started_at);

CREATE TABLE probe_steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       TEXT NOT NULL REFERENCES probe_runs (run_id) ON DELETE CASCADE,
  check_name   TEXT NOT NULL,
  step         TEXT NOT NULL,
  verdict      TEXT NOT NULL,                          -- pass | fail | skip
  http_status  INTEGER,
  error_code   TEXT,
  latency_ms   INTEGER,
  request_id   TEXT,
  detail       TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX probe_steps_run ON probe_steps (run_id);
CREATE INDEX probe_steps_check ON probe_steps (check_name, step, at);

-- Latest known value per kind. The openapi-drift and guide-version checks compare against it;
-- the runner updates it and writes a drift_events row when a check reports a change.
CREATE TABLE contract_snapshots (
  kind         TEXT PRIMARY KEY,                       -- openapi | guide
  value        TEXT NOT NULL,                          -- openapi: sha-256 hex; guide: version string
  observed_at  TEXT NOT NULL
);

CREATE TABLE drift_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL,                           -- openapi | guide
  from_value  TEXT NOT NULL,
  to_value    TEXT NOT NULL
);
