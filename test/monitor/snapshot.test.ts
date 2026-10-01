/**
 * The promo gap snapshot, checked against numbers computed by hand on the fixtures.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/monitor/snapshot.test.ts
 * Deps:    bun:test, src/monitor/snapshot.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { computePromoGapSnapshot, runPromoGapSnapshot } from "../../src/monitor/snapshot";
import { makeEnv, makeWorld } from "../fakes/env";
import { createTestDb } from "../fakes/d1";
import { makeProduct } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

const TAKEN_AT = "2026-10-01T04:30:00.000Z";

describe("computePromoGapSnapshot", () => {
  it("matches the gaps computed by hand on the fixtures", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    // Listable products, sellable options only (active IS NOT 0):
    //   o-massage-chi-60 retail 4900 promo 3920 -> gap (4900-3920)/4900       = 0.2
    //   o-massage-chi-90 retail 6900 no promo
    //   o-massage-nyc-60 retail 5900 no promo
    //   o-oil-chi        retail 4499 promo 3599 -> gap (4499-3599)/4499       = 900/4499
    //   o-bowling-chi    retail 3900 no promo
    //   o-facial-la      retail 9900 promo 8415 -> gap (9900-8415)/9900       = 0.15
    //   o-pizza-chi      retail 2900 no promo
    //   o-yoga-austin    retail 4500 promo 3600 -> gap (4500-3600)/4500       = 0.2
    //   o-escape-nyc     retail 7900 no promo
    //   o-nails-miami    retail 2200 no promo (active = null, still sellable)
    //   o-laser-chi-small retail 9900 no promo (o-laser-chi-old is active=false, excluded)
    // 11 sellable options, 4 with a promo. Sorted gaps: 0.15, 0.2, 0.2, 900/4499 (~0.200044).
    // median (rank ceil(0.5*4)=2): 0.2. p90 (rank ceil(0.9*4)=4): 900/4499.
    // totalGapMinor = 980 + 900 + 1485 + 900 = 4265.
    const snapshot = await computePromoGapSnapshot(db.d1, TAKEN_AT);
    expect(snapshot.listableOptions).toBe(11);
    expect(snapshot.optionsWithPromo).toBe(4);
    expect(snapshot.promoShare).toBeCloseTo(4 / 11, 10);
    expect(snapshot.medianGap).toBeCloseTo(0.2, 10);
    expect(snapshot.p90Gap).toBeCloseTo(900 / 4499, 10);
    expect(snapshot.totalGapMinor).toBe(4265);
    expect(snapshot.takenAt).toBe(TAKEN_AT);
  });

  it("answers all zeros when no listable option has a promo", async () => {
    const db = createTestDb();
    const noPromo = [
      makeProduct({
        id: "p-no-promo",
        title: "No Promo Deal",
        short: "short",
        categories: ["Test"],
        places: [["Place", "Chicago", "IL", "60601"]],
        options: [{ id: "o-no-promo", title: "Option", original: 1000, retail: 900, isDefault: true }],
      }),
    ];
    seedCatalogue(db, noPromo);
    const snapshot = await computePromoGapSnapshot(db.d1, TAKEN_AT);
    expect(snapshot.listableOptions).toBe(1);
    expect(snapshot.optionsWithPromo).toBe(0);
    expect(snapshot.promoShare).toBe(0);
    expect(snapshot.medianGap).toBe(0);
    expect(snapshot.p90Gap).toBe(0);
    expect(snapshot.totalGapMinor).toBe(0);
  });
});

describe("runPromoGapSnapshot", () => {
  it("writes one row per run", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runPromoGapSnapshot(world.deps, env);
    expect(summary.job).toBe("promo-gap");
    expect(summary.ok).toBe(true);
    const rows = world.db.sqlite.query("SELECT COUNT(*) AS n FROM promo_gap_snapshots").all() as { n: number }[];
    expect(rows[0]?.n).toBe(1);
  });

  it("writes no row and reports ok: false for an empty catalogue copy", async () => {
    const world = makeWorld();
    // the D1 copy of the catalogue is untouched: no products table rows at all, distinct from a
    // catalogue with products that simply carry no promo (covered above).
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runPromoGapSnapshot(world.deps, env);
    expect(summary.job).toBe("promo-gap");
    expect(summary.ok).toBe(false);
    expect(summary.summary).toBe("the catalogue copy is empty; no snapshot taken");
    const rows = world.db.sqlite.query("SELECT COUNT(*) AS n FROM promo_gap_snapshots").all() as { n: number }[];
    expect(rows[0]?.n).toBe(0);
  });
});

describe("runPromoGapSnapshot's gap bands (CEO review 1, loop 5: the caption and the histogram must share one observation)", () => {
  it("writes bands under the snapshot's own taken_at that sum to optionsWithPromo", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    await runPromoGapSnapshot(world.deps, env);

    const snapshotRow = world.db.sqlite.query("SELECT taken_at, options_with_promo FROM promo_gap_snapshots").get() as { taken_at: string; options_with_promo: number };
    const bandRows = world.db.sqlite.query("SELECT taken_at, band, options FROM promo_gap_bands").all() as { taken_at: string; band: number; options: number }[];

    expect(bandRows.length).toBeGreaterThan(0);
    for (const row of bandRows) expect(row.taken_at).toBe(snapshotRow.taken_at);
    const total = bandRows.reduce((sum, row) => sum + row.options, 0);
    expect(total).toBe(snapshotRow.options_with_promo);
  });

  it("leaves a run's bands untouched when an option's gap changes before the next run", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    await runPromoGapSnapshot(world.deps, env);
    const firstBands = world.db.sqlite.query("SELECT band, options FROM promo_gap_bands ORDER BY band").all();

    // Deepen an existing promo's gap from 20% to nearly 90%, well past where it started, with no
    // new run: the first run's bands must read exactly as they did the moment they were written.
    world.db.sqlite.query("UPDATE options SET promo_amount = 500 WHERE product_id = 'p-massage-chi' AND option_id = 'o-massage-chi-60'").run();
    const bandsAfterTheChange = world.db.sqlite.query("SELECT band, options FROM promo_gap_bands ORDER BY band").all();
    expect(bandsAfterTheChange).toEqual(firstBands);

    world.clock.advance(60 * 60 * 1000);
    await runPromoGapSnapshot(world.deps, env);
    const takenAts = world.db.sqlite.query("SELECT DISTINCT taken_at FROM promo_gap_bands ORDER BY taken_at").all() as { taken_at: string }[];
    expect(takenAts).toHaveLength(2);
    const secondBands = world.db.sqlite.query("SELECT band, options FROM promo_gap_bands WHERE taken_at = ?1 ORDER BY band").all(takenAts[1]!.taken_at);
    // band 4 (20-25%) loses the option that moved, band 8 (40%+) gains it.
    expect(secondBands).not.toEqual(firstBands);
  });
});
