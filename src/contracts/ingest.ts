/**
 * Payloads the zora collector posts to POST /ingest/observations. FROZEN after Wave 0.
 * Both sides (collector lane, monitor lane) validate against these shapes.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/contracts/ingest.ts
 * Deps:    none
 * Tested:  n/a (types only)
 */

export interface PublicPriceObservation {
  /** Listing page the price was read from. */
  readonly sourceUrl: string;
  /** https://www.groupon.com/deals/<permalink> */
  readonly dealUrl: string;
  /** Last path segment of dealUrl. */
  readonly permalink: string;
  readonly title: string;
  readonly merchant: string | null;
  readonly currency: string;
  /** schema.org Offer.price, minor units. */
  readonly priceMinor: number;
  /** schema.org ListPrice, minor units, when present. */
  readonly listPriceMinor: number | null;
  readonly observedAt: string;
}

export interface GuideVersionObservation {
  readonly sourceUrl: string;
  /** e.g. "7", read from "Version 7." on the hub page. null when the page was unreadable. */
  readonly version: string | null;
  readonly httpStatus: number;
  readonly observedAt: string;
}

export type IngestBatch =
  | { readonly kind: "public_prices"; readonly collector: string; readonly observations: readonly PublicPriceObservation[] }
  | { readonly kind: "guide_version"; readonly collector: string; readonly observation: GuideVersionObservation };

/** At most this many observations per batch. */
export const INGEST_MAX_OBSERVATIONS = 500;

export interface IngestReceipt {
  readonly accepted: number;
  readonly rejected: number;
  readonly reasons: readonly string[];
}
