-- Carts we created, orders we saw, requests agents made.
-- Project: zorasocial. Module: migrations/0005_commerce.sql. Tested: test/contracts/schema.test.ts
-- Writers: carts (carts_log), return page + shopping (orders), shopping (agent_requests).

CREATE TABLE carts_log (
  cart_id      TEXT PRIMARY KEY,
  source       TEXT NOT NULL,                          -- agent-api | agent-mcp | web | probe | monitor
  status       TEXT NOT NULL,                          -- open | abandoned | checked_out | expired
  created_at   TEXT NOT NULL,
  closed_at    TEXT,
  line_count   INTEGER NOT NULL,
  total_minor  INTEGER NOT NULL,
  request_id   TEXT
);
CREATE INDEX carts_log_status ON carts_log (status, created_at);

CREATE TABLE orders (
  groupon_order_uuid  TEXT PRIMARY KEY,
  source              TEXT NOT NULL,                   -- return | manual
  first_seen_at       TEXT NOT NULL,
  last_checked_at     TEXT,
  status              TEXT,                            -- OctoBookingStatus, NULL until first read
  raw_json            TEXT
);

CREATE TABLE agent_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  channel       TEXT NOT NULL,                         -- agent-api | agent-mcp | web
  tool          TEXT NOT NULL,                         -- search_deals | get_deal | create_checkout_link | get_order_status
  query_text    TEXT,
  result_count  INTEGER,
  latency_ms    INTEGER NOT NULL,
  outcome       TEXT NOT NULL                          -- ok | empty | price_changed | unavailable | not_found | error
);
CREATE INDEX agent_requests_at ON agent_requests (at);
