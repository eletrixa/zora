-- The promo gap histogram stored with the daily snapshot it belongs to, so the Price truth caption
-- (promo_gap_snapshots) and the bands under it describe one observation (CEO review 1, loop 5).
-- Project: zorasocial. Module: migrations/0010_promo_gap_bands.sql. Tested: test/contracts/schema.test.ts
-- Writer: lane monitor (the promo-gap job writes the bands in the same run as its snapshot row).

CREATE TABLE promo_gap_bands (
  taken_at  TEXT NOT NULL REFERENCES promo_gap_snapshots (taken_at) ON DELETE CASCADE,
  band      INTEGER NOT NULL,                     -- 0 = 0 to 5 %, 1 = 5 to 10 %, ..., 8 = 40 % and over
  options   INTEGER NOT NULL,                     -- sellable options of listable products in this band
  PRIMARY KEY (taken_at, band)
);
