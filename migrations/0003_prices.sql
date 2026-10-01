-- Price truth monitor.
-- Project: zorasocial. Module: migrations/0003_prices.sql. Tested: test/contracts/schema.test.ts
-- Writers: catalogue-store (price_changes), monitor (everything else).

CREATE TABLE price_changes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   TEXT NOT NULL,
  option_id    TEXT NOT NULL,
  field        TEXT NOT NULL,                          -- retail | original | promo
  old_minor    INTEGER,                                -- NULL = there was none (promo appeared)
  new_minor    INTEGER,                                -- NULL = it went away (promo ended)
  detected_at  TEXT NOT NULL,
  sync_run_id  TEXT NOT NULL
);
CREATE INDEX price_changes_detected ON price_changes (detected_at);
CREATE INDEX price_changes_option ON price_changes (product_id, option_id);

CREATE TABLE promo_gap_snapshots (
  taken_at           TEXT PRIMARY KEY,
  listable_options   INTEGER NOT NULL,
  options_with_promo INTEGER NOT NULL,
  promo_share        REAL NOT NULL,
  median_gap         REAL NOT NULL,
  p90_gap            REAL NOT NULL,
  total_gap_minor    INTEGER NOT NULL
);

CREATE TABLE cart_samples (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  day                TEXT NOT NULL,                    -- YYYY-MM-DD (UTC)
  product_id         TEXT NOT NULL,
  option_id          TEXT NOT NULL,
  expected_minor     INTEGER NOT NULL,                 -- catalogue retail sent as expectedPrice
  outcome            TEXT NOT NULL,                    -- matched | price_mismatch | unavailable | error
  cart_retail_minor  INTEGER,                          -- retail on the cart line, when a cart came back
  current_minor      INTEGER,                          -- PRICE_MISMATCH currentPrice
  error_code         TEXT,
  request_id         TEXT,
  cart_id            TEXT,
  sampled_at         TEXT NOT NULL
);
CREATE INDEX cart_samples_day ON cart_samples (day);

CREATE TABLE public_price_observations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  permalink           TEXT NOT NULL,
  deal_url            TEXT NOT NULL,
  source_url          TEXT NOT NULL,
  title               TEXT NOT NULL,
  merchant            TEXT,
  currency            TEXT NOT NULL,
  price_minor         INTEGER NOT NULL,
  list_price_minor    INTEGER,
  observed_at         TEXT NOT NULL,
  collector           TEXT NOT NULL,
  matched_product_id  TEXT,                            -- set by the monitor's matcher
  matched_option_id   TEXT,
  UNIQUE (permalink, observed_at)
);
CREATE INDEX public_price_permalink ON public_price_observations (permalink);
CREATE INDEX public_price_observed ON public_price_observations (observed_at);

CREATE TABLE guide_observations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url   TEXT NOT NULL,
  version      TEXT,
  http_status  INTEGER NOT NULL,
  observed_at  TEXT NOT NULL,
  collector    TEXT NOT NULL
);
CREATE INDEX guide_observations_observed ON guide_observations (observed_at);
