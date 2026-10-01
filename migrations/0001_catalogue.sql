-- Catalogue copy of the Partner Storefront API.
-- Project: zorasocial. Module: migrations/0001_catalogue.sql. Tested: test/contracts/schema.test.ts
-- Writer: lane catalogue-store (src/catalogue/). Readers: search, shopping, monitor.
-- Money is INTEGER minor units. Time is TEXT ISO-8601 UTC. Booleans are INTEGER 0/1.
-- Option price rule: the pricing row of the option's FIRST unit, first pricing entry.

CREATE TABLE products (
  id                    TEXT PRIMARY KEY,
  reference             TEXT,
  title                 TEXT NOT NULL,
  short_description     TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL,                 -- active | sold_out | expired
  availability_required INTEGER NOT NULL DEFAULT 0,
  listable              INTEGER NOT NULL DEFAULT 0,    -- the guide's rule, computed at write time
  category_labels       TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  image_url             TEXT,
  raw_json              TEXT NOT NULL,                 -- the product exactly as received
  content_hash          TEXT NOT NULL,                 -- sha-256 hex of raw_json; equal hash = unchanged
  first_seen_at         TEXT NOT NULL,
  updated_at            TEXT NOT NULL,                 -- last time content_hash changed
  last_seen_at          TEXT NOT NULL,
  last_seen_run_id      TEXT NOT NULL
);
CREATE INDEX products_listable ON products (listable);
CREATE INDEX products_last_seen_run ON products (last_seen_run_id);

CREATE TABLE options (
  product_id     TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  option_id      TEXT NOT NULL,
  title          TEXT NOT NULL DEFAULT '',
  active         INTEGER,                              -- NULL = unknown, treated as sellable
  is_default     INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL,
  precision      INTEGER NOT NULL,
  original       INTEGER NOT NULL,
  retail         INTEGER NOT NULL,
  promo_amount   INTEGER,
  promo_code     TEXT,
  promo_ends_at  TEXT,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (product_id, option_id)
);
CREATE INDEX options_retail ON options (retail);
CREATE INDEX options_promo ON options (promo_amount) WHERE promo_amount IS NOT NULL;

CREATE TABLE locations (
  product_id   TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  name         TEXT,
  street       TEXT,
  city         TEXT,
  state        TEXT,                                   -- two-letter code, e.g. IL
  postal_code  TEXT,
  latitude     REAL,
  longitude    REAL,
  PRIMARY KEY (product_id, idx)
);
CREATE INDEX locations_state_city ON locations (state, city);

-- Full-text index. One row per LISTABLE product, written by catalogue-store in the same batch
-- as the product (delete by product_id, then insert). Non-listable products have no row.
--   places     = location names, cities, state codes and full state names, space separated
--   categories = category labels, space separated
CREATE VIRTUAL TABLE products_fts USING fts5 (
  product_id UNINDEXED,
  title,
  short_description,
  description,
  categories,
  places,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
