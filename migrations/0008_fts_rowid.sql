-- The search row of a product lives at the product's rowid, so it can be found without a scan.
-- Project: zorasocial. Module: migrations/0008_fts_rowid.sql. Tested: test/app/fts-rowid.test.ts
-- Why: product_id is UNINDEXED in the FTS5 table, so `DELETE FROM products_fts WHERE product_id = ?`
-- read the whole table for every product written. At 47,000 products one catalogue page took a
-- minute and then D1 killed it ("exceeded its CPU time limit"). A delete by rowid is one seek.
-- Writer: src/catalogue/index.ts. Rows are copied with rowid = products.rowid; text is unchanged.

CREATE VIRTUAL TABLE products_fts_new USING fts5 (
  product_id UNINDEXED,
  title,
  short_description,
  description,
  categories,
  places,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

INSERT INTO products_fts_new (rowid, product_id, title, short_description, description, categories, places)
  SELECT p.rowid, f.product_id, f.title, f.short_description, f.description, f.categories, f.places
  FROM products_fts f JOIN products p ON p.id = f.product_id;

DROP TABLE products_fts;
ALTER TABLE products_fts_new RENAME TO products_fts;
