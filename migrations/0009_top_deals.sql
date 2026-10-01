-- Top deals: Groupon's top category (category1) per product, filled by the daily category walk, and the
-- top cities by listable products, refreshed daily.
-- Project: zorasocial. Module: migrations/0009_top_deals.sql. Tested: test/contracts/schema.test.ts
-- Writers: lane sync (sync_runs.category1, product_categories via src/sync/tags.ts),
--          lane top-deals (top_cities via src/top-deals/cities.ts).

-- kind 'category' walks send this filter on every page; NULL for full and delta walks.
ALTER TABLE sync_runs ADD COLUMN category1 TEXT;

CREATE TABLE product_categories (
  product_id  TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  category1   TEXT NOT NULL,                        -- Groupon category1 permalink, e.g. things-to-do
  run_id      TEXT NOT NULL,                        -- the category walk (sync_runs.run_id) that last saw the product here
  tagged_at   TEXT NOT NULL,
  PRIMARY KEY (product_id, category1)
);
-- The top deals filter is `product_id IN (SELECT product_id FROM product_categories WHERE category1 = ?)`;
-- this covering index answers it without touching the table.
CREATE INDEX product_categories_category ON product_categories (category1, product_id);

CREATE TABLE top_cities (
  city               TEXT NOT NULL,                 -- as stored on locations.city
  state              TEXT NOT NULL,                 -- two-letter code as stored on locations.state
  listable_products  INTEGER NOT NULL,
  rank               INTEGER NOT NULL,              -- 1 = most listable products
  refreshed_at       TEXT NOT NULL,
  PRIMARY KEY (city, state)
);
