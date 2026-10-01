/**
 * The price truth read model: latest snapshot, history, worst gaps, cart samples and public
 * price comparison, one section per day. A "day" here is a calendar day that has data, never a
 * wall-clock window — the read model gets no clock, only the database. gapBands is read from
 * promo_gap_bands at the latest snapshot's own taken_at, never recomputed live over the current
 * catalogue, so the histogram and its caption always describe the same observation. No stored
 * bands for that moment (or no snapshot at all) answers an empty list, never nine measured zeros
 * (CEO review round 2, loop 5): a missing measurement is not the same as a measured zero.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/monitor/read-model.ts
 * Deps:    src/contracts/reports.ts
 * Tested:  test/monitor/read-model.test.ts
 */
import type { CartSampleDay, GapBand, PriceTruthReadModel, PriceTruthReport, PromoGapSnapshot, PublicPriceComparison, WorstGapDeal } from "../contracts/reports";

interface SnapshotRow {
  readonly taken_at: string;
  readonly listable_options: number;
  readonly options_with_promo: number;
  readonly promo_share: number;
  readonly median_gap: number;
  readonly p90_gap: number;
  readonly total_gap_minor: number;
}

const toSnapshot = (row: SnapshotRow): PromoGapSnapshot => ({
  takenAt: row.taken_at,
  listableOptions: row.listable_options,
  optionsWithPromo: row.options_with_promo,
  promoShare: row.promo_share,
  medianGap: row.median_gap,
  p90Gap: row.p90_gap,
  totalGapMinor: row.total_gap_minor,
});

async function latestSnapshot(db: D1Database): Promise<PromoGapSnapshot | null> {
  const row = await db.prepare("SELECT * FROM promo_gap_snapshots ORDER BY taken_at DESC LIMIT 1").first<SnapshotRow>();
  return row ? toSnapshot(row) : null;
}

async function history(db: D1Database, days: number): Promise<readonly PromoGapSnapshot[]> {
  const rows = await db
    .prepare(
      `SELECT s.* FROM promo_gap_snapshots s
       JOIN (SELECT date(taken_at) AS d, MAX(taken_at) AS mx FROM promo_gap_snapshots GROUP BY d ORDER BY d DESC LIMIT ?1) latest
         ON s.taken_at = latest.mx
       ORDER BY s.taken_at DESC`,
    )
    .bind(days)
    .all<SnapshotRow>();
  return rows.results.map(toSnapshot);
}

interface WorstRow {
  readonly product_id: string;
  readonly option_id: string;
  readonly title: string;
  readonly retail: number;
  readonly promo_amount: number;
  readonly promo_code: string | null;
}

async function worstGaps(db: D1Database): Promise<readonly WorstGapDeal[]> {
  const rows = await db
    .prepare(
      `SELECT product_id, option_id, title, retail, promo_amount, promo_code
       FROM (
         SELECT p.id AS product_id, o.option_id, p.title, o.retail, o.promo_amount, o.promo_code,
                CAST(o.retail - o.promo_amount AS REAL) / o.retail AS gap,
                ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY CAST(o.retail - o.promo_amount AS REAL) / o.retail DESC) AS rn
         FROM options o JOIN products p ON p.id = o.product_id
         WHERE p.listable = 1 AND o.active IS NOT 0 AND o.promo_amount IS NOT NULL AND o.promo_amount < o.retail
       )
       WHERE rn = 1
       ORDER BY gap DESC
       LIMIT 50`,
    )
    .all<WorstRow>();
  return rows.results.map((row) => ({
    productId: row.product_id,
    optionId: row.option_id,
    title: row.title,
    retailMinor: row.retail,
    promoMinor: row.promo_amount,
    gap: (row.retail - row.promo_amount) / row.retail,
    promoCode: row.promo_code,
  }));
}

interface GapBandRow {
  readonly band: number;
  readonly options: number;
}

const GAP_BAND_COUNT = 9;

/**
 * The histogram stored with one snapshot (promo_gap_bands at that snapshot's taken_at), never
 * recomputed live: a later catalogue change must not move a caption that already printed a number
 * (CEO review 1, loop 5, where the live bands and the stored caption disagreed). No snapshot yet,
 * or that snapshot has no stored band rows (taken before migration 0010, say): an empty list, so
 * the page can say the histogram has not arrived rather than print nine zeros as if they were
 * measured (CEO review 2, loop 5). A band absent from an otherwise-stored set is still 0, since
 * the job writes every one of the nine bands in the same run as the snapshot it belongs to.
 */
async function gapBandsAt(db: D1Database, takenAt: string | null): Promise<readonly GapBand[]> {
  if (takenAt === null) return [];
  const rows = await db.prepare("SELECT band, options FROM promo_gap_bands WHERE taken_at = ?1").bind(takenAt).all<GapBandRow>();
  if (rows.results.length === 0) return [];
  const counts = new Array<number>(GAP_BAND_COUNT).fill(0);
  for (const row of rows.results) counts[row.band] = row.options;
  return counts.map((options, band) => ({
    fromPct: band * 5,
    toPct: band === GAP_BAND_COUNT - 1 ? null : (band + 1) * 5,
    options,
  }));
}

interface CartSampleRow {
  readonly day: string;
  readonly sampled: number;
  readonly matched: number;
  readonly price_mismatch: number;
  readonly unavailable: number;
  readonly errors: number;
}

async function cartSamples(db: D1Database, days: number): Promise<readonly CartSampleDay[]> {
  const rows = await db
    .prepare(
      `SELECT day,
              COUNT(*) AS sampled,
              SUM(CASE WHEN outcome = 'matched' THEN 1 ELSE 0 END) AS matched,
              SUM(CASE WHEN outcome = 'price_mismatch' THEN 1 ELSE 0 END) AS price_mismatch,
              SUM(CASE WHEN outcome = 'unavailable' THEN 1 ELSE 0 END) AS unavailable,
              SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS errors
       FROM cart_samples
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?1`,
    )
    .bind(days)
    .all<CartSampleRow>();
  return rows.results.map((row) => ({
    day: row.day,
    sampled: row.sampled,
    matched: row.matched,
    priceMismatch: row.price_mismatch,
    unavailable: row.unavailable,
    errors: row.errors,
  }));
}

interface PublicComparisonRow {
  readonly day: string;
  readonly matched_deals: number;
  readonly shows_retail: number;
  readonly shows_promo: number;
  readonly shows_other: number;
}

async function publicComparison(db: D1Database, days: number): Promise<readonly PublicPriceComparison[]> {
  const rows = await db
    .prepare(
      `SELECT date(po.observed_at) AS day,
              COUNT(*) AS matched_deals,
              SUM(CASE WHEN po.price_minor = o.retail THEN 1 ELSE 0 END) AS shows_retail,
              SUM(CASE WHEN o.promo_amount IS NOT NULL AND po.price_minor = o.promo_amount THEN 1 ELSE 0 END) AS shows_promo,
              SUM(CASE WHEN po.price_minor != o.retail AND (o.promo_amount IS NULL OR po.price_minor != o.promo_amount) THEN 1 ELSE 0 END) AS shows_other
       FROM public_price_observations po
       JOIN options o ON o.product_id = po.matched_product_id AND o.option_id = po.matched_option_id
       WHERE po.matched_product_id IS NOT NULL
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?1`,
    )
    .bind(days)
    .all<PublicComparisonRow>();
  return rows.results.map((row) => ({ day: row.day, matchedDeals: row.matched_deals, showsRetail: row.shows_retail, showsPromo: row.shows_promo, showsOther: row.shows_other }));
}

interface PriceChangeDayRow {
  readonly day: string;
  readonly changes: number;
}

async function priceChangesPerDay(db: D1Database, days: number): Promise<readonly { readonly day: string; readonly changes: number }[]> {
  const rows = await db
    .prepare("SELECT date(detected_at) AS day, COUNT(*) AS changes FROM price_changes GROUP BY day ORDER BY day DESC LIMIT ?1")
    .bind(days)
    .all<PriceChangeDayRow>();
  return rows.results.map((row) => ({ day: row.day, changes: row.changes }));
}

export function createPriceTruthReadModel(db: D1Database): PriceTruthReadModel {
  return {
    async report(days: number): Promise<PriceTruthReport> {
      // The bands' own query is keyed by latest's taken_at, so it runs after latest resolves.
      const latest = await latestSnapshot(db);
      const [historyRows, worst, samples, comparison, changes, bands] = await Promise.all([
        history(db, days),
        worstGaps(db),
        cartSamples(db, days),
        publicComparison(db, days),
        priceChangesPerDay(db, days),
        gapBandsAt(db, latest?.takenAt ?? null),
      ]);
      return { latest, history: historyRows, worst, cartSamples: samples, publicComparison: comparison, priceChangesPerDay: changes, gapBands: bands };
    },
  };
}
