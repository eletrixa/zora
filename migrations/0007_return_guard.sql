-- Guards for the public return page: a cached order view and request counters per minute.
-- Project: zorasocial. Module: migrations/0007_return_guard.sql. Tested: test/app/return.test.ts
-- Writer: src/return/routes.ts (integrator) through src/lib/rate.ts.

-- The last OrderStatusResult shown for this order, as JSON. Served again while it is fresh,
-- so a public page cannot make the Worker call Groupon on every request.
ALTER TABLE orders ADD COLUMN view_json TEXT;
ALTER TABLE orders ADD COLUMN view_at INTEGER;          -- epoch ms of view_json

CREATE TABLE rate_windows (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,                       -- epoch ms, start of the minute
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
