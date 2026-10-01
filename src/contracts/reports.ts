/**
 * Read models the pages and the JSON endpoints show. FROZEN after Wave 0.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/contracts/reports.ts
 * Deps:    src/contracts/ports.ts (PromoNote)
 * Tested:  n/a (types only)
 */
import type { PromoNote } from "./ports";

// ---------------------------------------------------------------- price truth (lane: monitor)

export interface PromoGapSnapshot {
  readonly takenAt: string;
  readonly listableOptions: number;
  readonly optionsWithPromo: number;
  /** optionsWithPromo / listableOptions, 0..1 */
  readonly promoShare: number;
  /** (retail - promo) / retail over options with a promo, 0..1 */
  readonly medianGap: number;
  readonly p90Gap: number;
  /** Sum over options with a promo of (retail - promo), minor units: what shoppers overpay per one purchase of each. */
  readonly totalGapMinor: number;
}

export interface WorstGapDeal {
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  readonly retailMinor: number;
  readonly promoMinor: number;
  readonly gap: number;
  readonly promoCode: string | null;
}

export interface CartSampleDay {
  readonly day: string; // YYYY-MM-DD
  readonly sampled: number;
  readonly matched: number;
  readonly priceMismatch: number;
  readonly unavailable: number;
  readonly errors: number;
}

export interface PublicPriceComparison {
  readonly day: string;
  readonly matchedDeals: number;
  /** Public page shows exactly the API `retail`. */
  readonly showsRetail: number;
  /** Public page shows exactly the API promo price. */
  readonly showsPromo: number;
  readonly showsOther: number;
}

export interface PriceTruthReport {
  readonly latest: PromoGapSnapshot | null;
  readonly history: readonly PromoGapSnapshot[];
  readonly worst: readonly WorstGapDeal[];
  readonly cartSamples: readonly CartSampleDay[];
  readonly publicComparison: readonly PublicPriceComparison[];
  /** Price changes seen by the delta sync, per day. */
  readonly priceChangesPerDay: readonly { readonly day: string; readonly changes: number }[];
  /**
   * Distribution of (retail - promo) / retail over every sellable option that carries a promo,
   * in bands of 5 percentage points: fromPct inclusive, toPct exclusive, null = open ended.
   * Taken with `latest` (promo_gap_bands at latest.takenAt), so the bands sum to latest.optionsWithPromo.
   */
  readonly gapBands: readonly GapBand[];
}

export interface GapBand {
  readonly fromPct: number;
  readonly toPct: number | null;
  readonly options: number;
}

export interface PriceTruthReadModel {
  report(days: number): Promise<PriceTruthReport>;
}

// ---------------------------------------------------------------- scorecard (lane: probe-runner)

export interface ProbeRunRow {
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly verdict: "pass" | "fail";
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface EndpointLatency {
  readonly check: string;
  readonly step: string;
  readonly samples: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
}

export interface DriftEvent {
  readonly at: string;
  readonly kind: "openapi" | "guide";
  readonly from: string;
  readonly to: string;
}

export interface Finding {
  readonly id: string;
  readonly at: string;
  readonly area: string;
  /** What the guide says, or "not stated". */
  readonly expected: string;
  readonly observed: string;
  readonly severity: "blocker" | "major" | "minor";
  readonly status: "open" | "reported" | "fixed";
}

export interface ScorecardReport {
  readonly latestRun: ProbeRunRow | null;
  readonly runs: readonly ProbeRunRow[];
  readonly passRate7d: number | null;
  readonly passRate30d: number | null;
  readonly latency: readonly EndpointLatency[];
  readonly drift: readonly DriftEvent[];
  readonly findings: readonly Finding[];
  /** Latest failing steps, newest first. */
  readonly failingSteps: readonly { readonly runId: string; readonly check: string; readonly step: string; readonly detail: string }[];
}

export interface ScorecardReadModel {
  report(days: number): Promise<ScorecardReport>;
}

// ---------------------------------------------------------------- sync status (lane: sync)

export interface SyncRunRow {
  readonly runId: string;
  readonly kind: "full" | "delta";
  readonly status: "running" | "complete" | "failed";
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly pages: number;
  readonly products: number;
  readonly errors: number;
}

export interface SyncStatus {
  readonly lastRefreshAt: string | null;
  readonly runs: readonly SyncRunRow[];
  readonly totalProducts: number;
  readonly listableProducts: number;
}

// ---------------------------------------------------------------- top deals (lane: top-deals)

export type TopDealsSort = "amount" | "percent";

export interface TopDealsQuery {
  /** As stored on locations: "New York", "NY". Empty strings mean the first city of the list. */
  readonly city: string;
  readonly state: string;
  /** Groupon category1 permalink, e.g. "things-to-do". Absent = every category. */
  readonly category1?: string;
  /** A leaf label from products.category_labels, matched case-insensitive. Absent = every label. */
  readonly label?: string;
  readonly sort: TopDealsSort;
}

export interface TopCity {
  readonly city: string;
  readonly state: string;
  readonly listableProducts: number;
}

export interface TopCategory {
  readonly category1: string;
  /** Listable products tagged with it in the chosen city. */
  readonly products: number;
}

export interface TopLabel {
  readonly label: string;
  readonly products: number;
}

export interface TopDealRow {
  /** 1..20 under the chosen sort. */
  readonly rank: number;
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  readonly optionTitle: string;
  /** The product's first location in the chosen city. */
  readonly city: string | null;
  readonly state: string | null;
  readonly imageUrl: string | null;
  readonly currency: string;
  readonly precision: number;
  /** The strike-through price, minor units (options.original). */
  readonly originalMinor: number;
  /** THE PRICE THE SHOPPER PAYS, minor units (= retail). */
  readonly payMinor: number;
  /** originalMinor - payMinor, minor units. */
  readonly discountMinor: number;
  /** discountMinor / originalMinor, 0..1. */
  readonly discountShare: number;
  /** Footnote only, never a column and never the price: present when the promo is below retail. Same rule and sentences as the shopping service. */
  readonly promo: PromoNote | null;
}

export interface TopDealsReport {
  /** The query answered, city and state filled in when the request named none. null = no city known yet. */
  readonly query: TopDealsQuery | null;
  /** Top cities by listable products, rank order, at most 50. */
  readonly cities: readonly TopCity[];
  /** Categories with tagged products in the chosen city, things-to-do first. */
  readonly categories: readonly TopCategory[];
  /** Leaf labels in the chosen city and category, by size. */
  readonly labels: readonly TopLabel[];
  /** At most 20, one per product. */
  readonly rows: readonly TopDealRow[];
  /** When the newest complete category walk finished; null before the first. */
  readonly taggedAt: string | null;
  /** When the city list was last refreshed; null before the first refresh. */
  readonly citiesRefreshedAt: string | null;
}

/** The picker lists Top deals and the finder share, over the whole catalogue. */
export interface TopDealsPickers {
  readonly cities: readonly TopCity[];
  /** Categories with tagged products anywhere, things-to-do first, then by size. */
  readonly categories: readonly TopCategory[];
  readonly citiesRefreshedAt: string | null;
  readonly taggedAt: string | null;
}

export interface TopDealsReadModel {
  report(query: TopDealsQuery): Promise<TopDealsReport>;
  pickers(): Promise<TopDealsPickers>;
}

// ---------------------------------------------------------------- composition

export interface Reports {
  readonly priceTruth: PriceTruthReadModel;
  readonly scorecard: ScorecardReadModel;
  readonly topDeals: TopDealsReadModel;
  syncStatus(): Promise<SyncStatus>;
}
