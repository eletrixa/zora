/**
 * The promo gap snapshot: one row per run over every listable product's sellable options, with
 * the gap histogram (promo_gap_bands) written under the same taken_at in the same run, so the
 * two can never describe different moments of the catalogue (CEO review 1, loop 5).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/monitor/snapshot.ts
 * Deps:    src/contracts/ports.ts, src/contracts/reports.ts, src/lib/clock.ts
 * Tested:  test/monitor/snapshot.test.ts
 */
import type { Deps, Job } from "../contracts/ports";
import type { PromoGapSnapshot } from "../contracts/reports";
import { iso } from "../lib/clock";

/** listable products, sellable options only: active IS NOT 0 keeps NULL (unknown = sellable). */
const SELLABLE_LISTABLE = "FROM options o JOIN products p ON p.id = o.product_id WHERE p.listable = 1 AND o.active IS NOT 0";
const WITH_PROMO = `${SELLABLE_LISTABLE} AND o.promo_amount IS NOT NULL AND o.promo_amount < o.retail`;

interface Counts {
  readonly listableOptions: number;
  readonly optionsWithPromo: number;
  readonly totalGapMinor: number;
}

async function counts(db: D1Database): Promise<Counts> {
  const listable = await db.prepare(`SELECT COUNT(*) AS n ${SELLABLE_LISTABLE}`).first<number>("n");
  const promo = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(o.retail - o.promo_amount), 0) AS total ${WITH_PROMO}`).first<{ n: number; total: number }>();
  return { listableOptions: listable ?? 0, optionsWithPromo: promo?.n ?? 0, totalGapMinor: promo?.total ?? 0 };
}

/**
 * Nearest-rank percentile: for a sorted ascending list of n values, the p-th percentile is the
 * value at 1-based rank ceil(p * n). Fetched with ORDER BY ... LIMIT 1 OFFSET (rank - 1), so the
 * database never has to hand back the whole option table.
 */
async function nthGap(db: D1Database, n: number, p: number): Promise<number> {
  if (n <= 0) return 0;
  const rank = Math.ceil(p * n);
  const offset = Math.min(Math.max(rank, 1), n) - 1;
  const row = await db
    .prepare(`SELECT CAST(o.retail - o.promo_amount AS REAL) / o.retail AS gap ${WITH_PROMO} ORDER BY gap ASC LIMIT 1 OFFSET ?1`)
    .bind(offset)
    .first<number>("gap");
  return row ?? 0;
}

export async function computePromoGapSnapshot(db: D1Database, takenAt: string): Promise<PromoGapSnapshot> {
  const { listableOptions, optionsWithPromo, totalGapMinor } = await counts(db);
  const medianGap = await nthGap(db, optionsWithPromo, 0.5);
  const p90Gap = await nthGap(db, optionsWithPromo, 0.9);
  return {
    takenAt,
    listableOptions,
    optionsWithPromo,
    promoShare: listableOptions > 0 ? optionsWithPromo / listableOptions : 0,
    medianGap,
    p90Gap,
    totalGapMinor,
  };
}

interface BandCount {
  readonly band: number;
  readonly options: number;
}

/**
 * Same join, same options and the same five-point bucketing rule as the snapshot row: the bands
 * always describe exactly the options `counts()` found, never a later catalogue state. Bands with
 * no option (e.g. none past 40%) are simply absent here; the read model fills them in as zero.
 */
async function computeGapBands(db: D1Database): Promise<readonly BandCount[]> {
  const rows = await db
    .prepare(`SELECT MIN(CAST(((o.retail - o.promo_amount) * 100 / o.retail) / 5 AS INTEGER), 8) AS band, COUNT(*) AS options ${WITH_PROMO} GROUP BY band`)
    .all<BandCount>();
  return rows.results;
}

function snapshotStatement(db: D1Database, snapshot: PromoGapSnapshot): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO promo_gap_snapshots (taken_at, listable_options, options_with_promo, promo_share, median_gap, p90_gap, total_gap_minor)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(snapshot.takenAt, snapshot.listableOptions, snapshot.optionsWithPromo, snapshot.promoShare, snapshot.medianGap, snapshot.p90Gap, snapshot.totalGapMinor);
}

function bandStatement(db: D1Database, takenAt: string, band: BandCount): D1PreparedStatement {
  return db.prepare("INSERT INTO promo_gap_bands (taken_at, band, options) VALUES (?1, ?2, ?3)").bind(takenAt, band.band, band.options);
}

export const runPromoGapSnapshot: Job = async (deps: Deps) => {
  const startedAt = iso(deps.clock.now());
  const snapshot = await computePromoGapSnapshot(deps.db, startedAt);
  // Zero listable options means the catalogue copy is empty (sync hasn't run, or every product
  // is unlistable), not a measured 0% promo share. A snapshot row of zeros would read on the
  // dashboard as "we checked and nothing has a promo" -- write nothing instead.
  if (snapshot.listableOptions === 0) {
    return {
      job: "promo-gap",
      ok: false,
      startedAt,
      finishedAt: iso(deps.clock.now()),
      summary: "the catalogue copy is empty; no snapshot taken",
    };
  }
  // The histogram under the snapshot's caption is written with it, in the same run and over the
  // same options, so the two can never drift apart the way they did in CEO review 1, loop 5.
  const bands = await computeGapBands(deps.db);
  await deps.db.batch([snapshotStatement(deps.db, snapshot), ...bands.map((band) => bandStatement(deps.db, startedAt, band))]);
  return {
    job: "promo-gap",
    ok: true,
    startedAt,
    finishedAt: iso(deps.clock.now()),
    summary: `${snapshot.optionsWithPromo}/${snapshot.listableOptions} listable options carry a promo, median gap ${(snapshot.medianGap * 100).toFixed(1)}%, p90 ${(snapshot.p90Gap * 100).toFixed(1)}%`,
  };
};
