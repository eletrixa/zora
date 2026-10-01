-- Findings, login attempts, job history.
-- Project: zorasocial. Module: migrations/0006_ops.sql. Tested: test/contracts/schema.test.ts
-- Writers: integrator (auth_attempts via src/auth.ts, job_runs via src/cron.ts), probe-runner (findings).

CREATE TABLE findings (
  id        TEXT PRIMARY KEY,
  at        TEXT NOT NULL,
  area      TEXT NOT NULL,
  expected  TEXT NOT NULL,
  observed  TEXT NOT NULL,
  severity  TEXT NOT NULL,                             -- blocker | major | minor
  status    TEXT NOT NULL DEFAULT 'open'               -- open | reported | fixed
);

CREATE TABLE auth_attempts (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  ip  TEXT NOT NULL,
  ok  INTEGER NOT NULL,
  at  INTEGER NOT NULL                                 -- epoch ms
);
CREATE INDEX auth_attempts_ip_at ON auth_attempts (ip, at);

CREATE TABLE job_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job          TEXT NOT NULL,
  ok           INTEGER NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT NOT NULL,
  summary      TEXT NOT NULL
);
CREATE INDEX job_runs_job ON job_runs (job, started_at);
