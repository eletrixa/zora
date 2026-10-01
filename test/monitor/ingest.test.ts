/**
 * Ingest validation, storage, matching and dedupe, exercised directly against the D1 fake.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/monitor/ingest.test.ts
 * Deps:    bun:test, src/monitor/ingest.ts, src/monitor/read-model.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { INGEST_MAX_OBSERVATIONS } from "../../src/contracts/ingest";
import { ingestBatch, parseBatch } from "../../src/monitor/ingest";
import { createPriceTruthReadModel } from "../../src/monitor/read-model";
import { createTestDb } from "../fakes/d1";
import { seedCatalogue } from "../fakes/seed";

const validPrice = (over: Record<string, unknown> = {}) => ({
  sourceUrl: "https://www.groupon.com/deals/p-massage-chi-permalink",
  dealUrl: "https://www.groupon.com/deals/p-massage-chi-permalink",
  permalink: "p-massage-chi-permalink",
  title: "Swedish Massage at Foot Smile Spa",
  merchant: "Foot Smile Spa",
  currency: "USD",
  priceMinor: 4900,
  listPriceMinor: 8000,
  observedAt: "2026-10-01T12:00:00.000Z",
  ...over,
});

describe("parseBatch", () => {
  it("accepts a public_prices batch", () => {
    const result = parseBatch({ kind: "public_prices", collector: "c1", observations: [validPrice()] });
    expect(result.ok).toBe(true);
  });

  it("refuses a batch with more than the observation limit", () => {
    const observations = Array.from({ length: INGEST_MAX_OBSERVATIONS + 1 }, () => validPrice());
    const result = parseBatch({ kind: "public_prices", collector: "c1", observations });
    expect(result).toEqual({ ok: false, code: "too_many_observations", message: `at most ${INGEST_MAX_OBSERVATIONS} observations per batch` });
  });

  it("refuses an unknown kind", () => {
    const result = parseBatch({ kind: "nonsense", collector: "c1" });
    expect(result.ok).toBe(false);
  });
});

describe("ingestBatch: public_prices", () => {
  it("accepts a valid observation and matches it to the catalogue's default option", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const receipt = await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [validPrice()] });
    expect(receipt).toEqual({ accepted: 1, rejected: 0, reasons: [] });
    const rows = db.sqlite.query("SELECT matched_product_id, matched_option_id FROM public_price_observations").all() as {
      matched_product_id: string;
      matched_option_id: string;
    }[];
    expect(rows).toEqual([{ matched_product_id: "p-massage-chi", matched_option_id: "o-massage-chi-60" }]);
  });

  it("rejects invalid observations one by one with a reason, keeping the valid ones", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const bad = validPrice({ dealUrl: "https://evil.example/deals/x", observedAt: "2026-10-01T12:05:00.000Z" });
    const good = validPrice({ observedAt: "2026-10-01T12:10:00.000Z" });
    const receipt = await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [bad, good] });
    expect(receipt.accepted).toBe(1);
    expect(receipt.rejected).toBe(1);
    expect(receipt.reasons).toHaveLength(1);
  });

  it("leaves an unmatched permalink with no matched ids, still accepted", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const receipt = await ingestBatch(db.d1, {
      kind: "public_prices",
      collector: "c1",
      observations: [validPrice({ permalink: "no-such-permalink", dealUrl: "https://www.groupon.com/deals/no-such-permalink" })],
    });
    expect(receipt).toEqual({ accepted: 1, rejected: 0, reasons: [] });
    const rows = db.sqlite.query("SELECT matched_product_id FROM public_price_observations").all() as { matched_product_id: string | null }[];
    expect(rows).toEqual([{ matched_product_id: null }]);
  });

  it("matches a price equal to a non-default option's retail to that option", async () => {
    // p-massage-chi's default option (o-massage-chi-60) retails at 4900; the 90-minute
    // option (o-massage-chi-90, not default, no promo) retails at 6900. groupon.com showed 6900.
    const db = createTestDb();
    seedCatalogue(db);
    const receipt = await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [validPrice({ priceMinor: 6900 })] });
    expect(receipt).toEqual({ accepted: 1, rejected: 0, reasons: [] });
    const rows = db.sqlite.query("SELECT matched_product_id, matched_option_id FROM public_price_observations").all() as {
      matched_product_id: string;
      matched_option_id: string;
    }[];
    expect(rows).toEqual([{ matched_product_id: "p-massage-chi", matched_option_id: "o-massage-chi-90" }]);
  });

  it("matches a price equal to a promo amount to that option, and the report counts it as showsPromo", async () => {
    // o-massage-chi-60's promo amount is 3920; its retail (4900) is not what was observed.
    const db = createTestDb();
    seedCatalogue(db);
    const observedAt = "2026-10-01T12:00:00.000Z";
    await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [validPrice({ priceMinor: 3920, observedAt })] });
    const rows = db.sqlite.query("SELECT matched_product_id, matched_option_id FROM public_price_observations").all() as {
      matched_product_id: string;
      matched_option_id: string;
    }[];
    expect(rows).toEqual([{ matched_product_id: "p-massage-chi", matched_option_id: "o-massage-chi-60" }]);
    const readModel = createPriceTruthReadModel(db.d1);
    const report = await readModel.report(7);
    expect(report.publicComparison).toEqual([{ day: "2026-10-01", matchedDeals: 1, showsRetail: 0, showsPromo: 1, showsOther: 0 }]);
  });

  it("falls back to the default option and counts as showsOther when nothing matches", async () => {
    // p-massage-nyc has one option (the default), retail 5900, no promo. 4999 matches neither.
    const db = createTestDb();
    seedCatalogue(db);
    const observedAt = "2026-10-01T12:00:00.000Z";
    await ingestBatch(db.d1, {
      kind: "public_prices",
      collector: "c1",
      observations: [
        validPrice({
          sourceUrl: "https://www.groupon.com/deals/p-massage-nyc-permalink",
          dealUrl: "https://www.groupon.com/deals/p-massage-nyc-permalink",
          permalink: "p-massage-nyc-permalink",
          priceMinor: 4999,
          observedAt,
        }),
      ],
    });
    const rows = db.sqlite.query("SELECT matched_product_id, matched_option_id FROM public_price_observations").all() as {
      matched_product_id: string;
      matched_option_id: string;
    }[];
    expect(rows).toEqual([{ matched_product_id: "p-massage-nyc", matched_option_id: "o-massage-nyc-60" }]);
    const readModel = createPriceTruthReadModel(db.d1);
    const report = await readModel.report(7);
    expect(report.publicComparison).toEqual([{ day: "2026-10-01", matchedDeals: 1, showsRetail: 0, showsPromo: 0, showsOther: 1 }]);
  });

  it("ignores a duplicate (permalink, observedAt) without doubling the row", async () => {
    const db = createTestDb();
    seedCatalogue(db);
    const observation = validPrice();
    await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [observation] });
    const receipt = await ingestBatch(db.d1, { kind: "public_prices", collector: "c1", observations: [observation] });
    expect(receipt).toEqual({ accepted: 1, rejected: 0, reasons: [] });
    const rows = db.sqlite.query("SELECT COUNT(*) AS n FROM public_price_observations").all() as { n: number }[];
    expect(rows[0]?.n).toBe(1);
  });
});

describe("ingestBatch: guide_version", () => {
  it("stores one guide_observations row", async () => {
    const db = createTestDb();
    const receipt = await ingestBatch(db.d1, {
      kind: "guide_version",
      collector: "c1",
      observation: { sourceUrl: "https://www.groupon.com/pages/api", version: "7", httpStatus: 200, observedAt: "2026-10-01T12:00:00.000Z" },
    });
    expect(receipt).toEqual({ accepted: 1, rejected: 0, reasons: [] });
    const rows = db.sqlite.query("SELECT version, http_status FROM guide_observations").all() as { version: string; http_status: number }[];
    expect(rows).toEqual([{ version: "7", http_status: 200 }]);
  });

  it("rejects a guide observation off the groupon.com host", async () => {
    const db = createTestDb();
    const receipt = await ingestBatch(db.d1, {
      kind: "guide_version",
      collector: "c1",
      observation: { sourceUrl: "https://evil.example/pages/api", version: "7", httpStatus: 200, observedAt: "2026-10-01T12:00:00.000Z" },
    });
    expect(receipt.accepted).toBe(0);
    expect(receipt.rejected).toBe(1);
  });
});
