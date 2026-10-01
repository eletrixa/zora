/**
 * The price truth read model: report shape with and without data.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/monitor/read-model.test.ts
 * Deps:    bun:test, src/monitor/read-model.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { runPromoGapSnapshot } from "../../src/monitor/snapshot";
import { createPriceTruthReadModel } from "../../src/monitor/read-model";
import { createTestDb } from "../fakes/d1";
import { makeEnv, makeWorld } from "../fakes/env";
import { seedCatalogue } from "../fakes/seed";

describe("createPriceTruthReadModel", () => {
  it("answers an empty shape when nothing has run yet", async () => {
    const db = createTestDb();
    const report = await createPriceTruthReadModel(db.d1).report(30);
    expect(report).toEqual({ latest: null, history: [], worst: [], cartSamples: [], publicComparison: [], priceChangesPerDay: [], gapBands: [] });
  });

  it("still reports latest: null after a promo-gap run over an empty catalogue copy", async () => {
    const world = makeWorld();
    // no seedCatalogue(): the D1 copy is empty, so runPromoGapSnapshot refuses and writes no row
    const summary = await runPromoGapSnapshot(world.deps, makeEnv({ DB: world.db.d1 }));
    expect(summary.ok).toBe(false);

    const report = await createPriceTruthReadModel(world.db.d1).report(30);
    expect(report.latest).toBeNull();
    expect(report.history).toEqual([]);
  });

  it("reports the latest snapshot, one history row per day, and the worst gaps", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const insertSnapshot = db.sqlite.query(
      "INSERT INTO promo_gap_snapshots (taken_at, listable_options, options_with_promo, promo_share, median_gap, p90_gap, total_gap_minor) VALUES (?1, 11, 4, 0.36, 0.2, 0.2, 4265)",
    );
    // two snapshots the same day: only the newer one should represent that day in history
    insertSnapshot.run("2026-10-01T04:00:00.000Z");
    insertSnapshot.run("2026-10-01T10:00:00.000Z");
    insertSnapshot.run("2026-10-02T04:00:00.000Z");

    const report = await createPriceTruthReadModel(db.d1).report(30);

    expect(report.latest?.takenAt).toBe("2026-10-02T04:00:00.000Z");
    expect(report.history.map((row) => row.takenAt)).toEqual(["2026-10-02T04:00:00.000Z", "2026-10-01T10:00:00.000Z"]);
    // Worst first: o-oil-chi has the largest gap ((4499-3599)/4499) among the fixture's promo options.
    expect(report.worst[0]).toEqual({ productId: "p-oil-chi", optionId: "o-oil-chi", title: "Full Synthetic Oil Change at Lakeview Auto", retailMinor: 4499, promoMinor: 3599, gap: 900 / 4499, promoCode: "AUTO20" });
  });

  it("groups cart samples and public price comparison by day, leaving days without data out", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const insertSample = db.sqlite.query(
      "INSERT INTO cart_samples (day, product_id, option_id, expected_minor, outcome, cart_retail_minor, current_minor, error_code, request_id, cart_id, sampled_at) VALUES (?1,'p-massage-chi','o-massage-chi-60',4900,?2,?3,?4,NULL,'r1','c1','2026-10-01T05:00:00.000Z')",
    );
    insertSample.run("2026-10-01", "matched", 4900, null);
    insertSample.run("2026-10-01", "price_mismatch", null, 5200);

    const insertPublic = db.sqlite.query(
      "INSERT INTO public_price_observations (permalink, deal_url, source_url, title, merchant, currency, price_minor, list_price_minor, observed_at, collector, matched_product_id, matched_option_id) VALUES (?1,?2,?2,'t',NULL,'USD',?3,NULL,?4,'c1','p-massage-chi','o-massage-chi-60')",
    );
    insertPublic.run("p1", "https://www.groupon.com/deals/p1", 4900, "2026-10-01T06:00:00.000Z");
    insertPublic.run("p2", "https://www.groupon.com/deals/p2", 3920, "2026-10-01T06:05:00.000Z");
    insertPublic.run("p3", "https://www.groupon.com/deals/p3", 1, "2026-10-01T06:10:00.000Z");

    const report = await createPriceTruthReadModel(db.d1).report(30);

    expect(report.cartSamples).toEqual([{ day: "2026-10-01", sampled: 2, matched: 1, priceMismatch: 1, unavailable: 0, errors: 0 }]);
    expect(report.publicComparison).toEqual([{ day: "2026-10-01", matchedDeals: 3, showsRetail: 1, showsPromo: 1, showsOther: 1 }]);
  });

  it("answers an empty gap bands list when the latest snapshot has no stored bands (CEO review 2, loop 5: a missing histogram is not nine measured zeros)", async () => {
    const db = createTestDb();
    // A snapshot row with no matching promo_gap_bands rows, the way one taken before migration
    // 0010 reads today: the histogram never arrived for this snapshot, so the list is empty, not
    // nine zero-count bands that would print as a measurement that was never taken.
    db.sqlite
      .query(
        "INSERT INTO promo_gap_snapshots (taken_at, listable_options, options_with_promo, promo_share, median_gap, p90_gap, total_gap_minor) VALUES (?1, 11, 4, 0.36, 0.2, 0.2, 4265)",
      )
      .run("2026-10-01T04:00:00.000Z");

    const report = await createPriceTruthReadModel(db.d1).report(30);

    expect(report.latest).not.toBeNull();
    expect(report.gapBands).toEqual([]);
  });

  it("buckets the latest snapshot's promo gaps into 5-point bands, capped at 40 and over", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    // fixture already carries 4 promo options: facial at 15% (band 15-20), massage, oil and yoga
    // at ~20% (band 20-25). Add one option deep in the open-ended 40%+ band before the run, so the
    // promo-gap job's own bands (not a live query) are what the report answers.
    const insertOption = world.db.sqlite.query(
      "INSERT INTO options (product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at, updated_at) VALUES ('p-pizza-chi','o-pizza-chi-deep','Deep Discount Pizza',1,0,'USD',2,10000,10000,1000,'DEEP',NULL,'2026-10-01T00:00:00.000Z')",
    );
    insertOption.run();
    const summary = await runPromoGapSnapshot(world.deps, makeEnv({ DB: world.db.d1 }));
    expect(summary.ok).toBe(true);

    const report = await createPriceTruthReadModel(world.db.d1).report(30);

    expect(report.gapBands).toHaveLength(9);
    expect(report.gapBands[0]).toEqual({ fromPct: 0, toPct: 5, options: 0 });
    expect(report.gapBands[8]).toEqual({ fromPct: 40, toPct: null, options: 1 });
    expect(report.gapBands.reduce((sum, band) => sum + band.options, 0)).toBe(5);
  });

  it("keeps the gap bands as they were at the latest snapshot even after the catalogue changes", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    await runPromoGapSnapshot(world.deps, env);
    const firstReport = await createPriceTruthReadModel(world.db.d1).report(30);

    // A deep new promo lands in the live catalogue, but no new run has taken a snapshot of it:
    // the caption (optionsWithPromo) and the histogram (gapBands) must still agree with each
    // other and with the moment they were taken, not with the catalogue as it stands now.
    world.db.sqlite
      .query(
        "INSERT INTO options (product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at, updated_at) VALUES ('p-pizza-chi','o-pizza-chi-deep','Deep Discount Pizza',1,0,'USD',2,10000,10000,1000,'DEEP',NULL,'2026-10-01T00:00:00.000Z')",
      )
      .run();

    const secondReport = await createPriceTruthReadModel(world.db.d1).report(30);
    expect(secondReport.gapBands).toEqual(firstReport.gapBands);
    expect(secondReport.latest).not.toBeNull();
    const total = secondReport.gapBands.reduce((sum, band) => sum + band.options, 0);
    expect(total).toBe(secondReport.latest!.optionsWithPromo);
  });

  it("lists the worst gap once per product, not once per option", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    // p-oil-chi already has one promo option (o-oil-chi, 20% gap). Give it a second, steeper one:
    // the product must still contribute only its single worst row to worstGaps.
    const insertOption = db.sqlite.query(
      "INSERT INTO options (product_id, option_id, title, active, is_default, currency, precision, original, retail, promo_amount, promo_code, promo_ends_at, updated_at) VALUES ('p-oil-chi','o-oil-chi-2','Deluxe Oil Change',1,0,'USD',2,9999,4999,999,'AUTO60',NULL,'2026-10-01T00:00:00.000Z')",
    );
    insertOption.run();

    const report = await createPriceTruthReadModel(db.d1).report(30);

    const oilRows = report.worst.filter((row) => row.productId === "p-oil-chi");
    expect(oilRows).toHaveLength(1);
    expect(oilRows[0]).toEqual({ productId: "p-oil-chi", optionId: "o-oil-chi-2", title: "Full Synthetic Oil Change at Lakeview Auto", retailMinor: 4999, promoMinor: 999, gap: 4000 / 4999, promoCode: "AUTO60" });
  });

  it("limits history to the requested number of days with data", async () => {
    const db = createTestDb();
    const insertSnapshot = db.sqlite.query(
      "INSERT INTO promo_gap_snapshots (taken_at, listable_options, options_with_promo, promo_share, median_gap, p90_gap, total_gap_minor) VALUES (?1, 1, 0, 0, 0, 0, 0)",
    );
    insertSnapshot.run("2026-09-28T04:00:00.000Z");
    insertSnapshot.run("2026-09-29T04:00:00.000Z");
    insertSnapshot.run("2026-09-30T04:00:00.000Z");
    insertSnapshot.run("2026-10-01T04:00:00.000Z");

    const report = await createPriceTruthReadModel(db.d1).report(2);
    expect(report.history.map((row) => row.takenAt)).toEqual(["2026-10-01T04:00:00.000Z", "2026-09-30T04:00:00.000Z"]);
  });
});
