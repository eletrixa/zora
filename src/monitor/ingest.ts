/**
 * Validates and stores one IngestBatch from the zora collector: public price observations or a
 * guide version check. Matching a public price to the catalogue is best-effort and never fails
 * an otherwise valid observation.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/monitor/ingest.ts
 * Deps:    src/contracts/ingest.ts
 * Tested:  test/monitor/ingest.test.ts
 */
import type { GuideVersionObservation, IngestBatch, IngestReceipt, PublicPriceObservation } from "../contracts/ingest";
import { INGEST_MAX_OBSERVATIONS } from "../contracts/ingest";

export const MAX_BODY_BYTES = 512 * 1024;
const GROUPON_PREFIX = "https://www.groupon.com/";

export type ParseResult = { readonly ok: true; readonly batch: IngestBatch } | { readonly ok: false; readonly code: string; readonly message: string };

function isIsoTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isGrouponUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(GROUPON_PREFIX);
}

function validatePublicPrice(raw: unknown): { readonly ok: true; readonly value: PublicPriceObservation } | { readonly ok: false; readonly reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "not an object" };
  const o = raw as Record<string, unknown>;
  if (!isGrouponUrl(o.sourceUrl)) return { ok: false, reason: "sourceUrl must start with https://www.groupon.com/" };
  if (!isGrouponUrl(o.dealUrl)) return { ok: false, reason: "dealUrl must start with https://www.groupon.com/" };
  if (typeof o.permalink !== "string" || o.permalink.length === 0) return { ok: false, reason: "permalink must be a non-empty string" };
  if (typeof o.title !== "string" || o.title.length === 0) return { ok: false, reason: "title must be a non-empty string" };
  if (o.merchant !== null && typeof o.merchant !== "string") return { ok: false, reason: "merchant must be a string or null" };
  if (typeof o.currency !== "string" || o.currency.length === 0) return { ok: false, reason: "currency must be a non-empty string" };
  if (!Number.isInteger(o.priceMinor)) return { ok: false, reason: "priceMinor must be an integer" };
  if (o.listPriceMinor !== null && !Number.isInteger(o.listPriceMinor)) return { ok: false, reason: "listPriceMinor must be an integer or null" };
  if (!isIsoTime(o.observedAt)) return { ok: false, reason: "observedAt must be an ISO-8601 time" };
  return {
    ok: true,
    value: {
      sourceUrl: o.sourceUrl,
      dealUrl: o.dealUrl,
      permalink: o.permalink,
      title: o.title,
      merchant: (o.merchant ?? null) as string | null,
      currency: o.currency,
      priceMinor: o.priceMinor as number,
      listPriceMinor: (o.listPriceMinor ?? null) as number | null,
      observedAt: o.observedAt,
    },
  };
}

function validateGuideVersion(raw: unknown): { readonly ok: true; readonly value: GuideVersionObservation } | { readonly ok: false; readonly reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "not an object" };
  const o = raw as Record<string, unknown>;
  if (!isGrouponUrl(o.sourceUrl)) return { ok: false, reason: "sourceUrl must start with https://www.groupon.com/" };
  if (o.version !== null && (typeof o.version !== "string" || o.version.length === 0)) return { ok: false, reason: "version must be a non-empty string or null" };
  if (!Number.isInteger(o.httpStatus)) return { ok: false, reason: "httpStatus must be an integer" };
  if (!isIsoTime(o.observedAt)) return { ok: false, reason: "observedAt must be an ISO-8601 time" };
  return { ok: true, value: { sourceUrl: o.sourceUrl, version: (o.version ?? null) as string | null, httpStatus: o.httpStatus as number, observedAt: o.observedAt } };
}

/** Parses the raw JSON body into a validated IngestBatch, or a whole-batch refusal. */
export function parseBatch(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) return { ok: false, code: "invalid_request", message: "body must be a JSON object" };
  const o = body as Record<string, unknown>;
  if (typeof o.collector !== "string" || o.collector.length === 0) return { ok: false, code: "invalid_request", message: "collector must be a non-empty string" };
  if (o.kind === "public_prices") {
    if (!Array.isArray(o.observations)) return { ok: false, code: "invalid_request", message: "observations must be an array" };
    if (o.observations.length > INGEST_MAX_OBSERVATIONS) return { ok: false, code: "too_many_observations", message: `at most ${INGEST_MAX_OBSERVATIONS} observations per batch` };
    return { ok: true, batch: { kind: "public_prices", collector: o.collector, observations: o.observations as readonly PublicPriceObservation[] } };
  }
  if (o.kind === "guide_version") {
    if (typeof o.observation !== "object" || o.observation === null) return { ok: false, code: "invalid_request", message: "observation must be an object" };
    return { ok: true, batch: { kind: "guide_version", collector: o.collector, observation: o.observation as GuideVersionObservation } };
  }
  return { ok: false, code: "invalid_request", message: 'kind must be "public_prices" or "guide_version"' };
}

async function matchOption(db: D1Database, permalink: string, priceMinor: number): Promise<{ readonly productId: string; readonly optionId: string } | null> {
  const exact = await db.prepare("SELECT id FROM products WHERE reference = ?1 LIMIT 1").bind(permalink).first<{ id: string }>();
  const product = exact ?? (await db.prepare("SELECT id FROM products WHERE reference IS NOT NULL AND LOWER(reference) = LOWER(?1) LIMIT 1").bind(permalink).first<{ id: string }>());
  if (!product) return null;
  // The public price is the retail (or promo) of whichever option groupon.com happened to
  // show, not always the default one. Prefer a sellable option whose retail or promo amount
  // equals what was observed; fall back to the default, then the cheapest sellable option.
  const byRetail = await db
    .prepare("SELECT option_id FROM options WHERE product_id = ?1 AND active IS NOT 0 AND retail = ?2 ORDER BY option_id ASC LIMIT 1")
    .bind(product.id, priceMinor)
    .first<{ option_id: string }>();
  const byPromo =
    byRetail ??
    (await db
      .prepare("SELECT option_id FROM options WHERE product_id = ?1 AND active IS NOT 0 AND promo_amount = ?2 ORDER BY option_id ASC LIMIT 1")
      .bind(product.id, priceMinor)
      .first<{ option_id: string }>());
  const preferred =
    byPromo ??
    (await db.prepare("SELECT option_id FROM options WHERE product_id = ?1 AND active IS NOT 0 AND is_default = 1 LIMIT 1").bind(product.id).first<{ option_id: string }>());
  const cheapest =
    preferred ?? (await db.prepare("SELECT option_id FROM options WHERE product_id = ?1 AND active IS NOT 0 ORDER BY retail ASC LIMIT 1").bind(product.id).first<{ option_id: string }>());
  if (!cheapest) return null;
  return { productId: product.id, optionId: cheapest.option_id };
}

async function storePublicPrice(db: D1Database, observation: PublicPriceObservation, collector: string): Promise<void> {
  const match = await matchOption(db, observation.permalink, observation.priceMinor);
  await db
    .prepare(
      `INSERT OR IGNORE INTO public_price_observations
         (permalink, deal_url, source_url, title, merchant, currency, price_minor, list_price_minor, observed_at, collector, matched_product_id, matched_option_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      observation.permalink,
      observation.dealUrl,
      observation.sourceUrl,
      observation.title,
      observation.merchant,
      observation.currency,
      observation.priceMinor,
      observation.listPriceMinor,
      observation.observedAt,
      collector,
      match?.productId ?? null,
      match?.optionId ?? null,
    )
    .run();
}

async function storeGuideVersion(db: D1Database, observation: GuideVersionObservation, collector: string): Promise<void> {
  await db
    .prepare("INSERT INTO guide_observations (source_url, version, http_status, observed_at, collector) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(observation.sourceUrl, observation.version, observation.httpStatus, observation.observedAt, collector)
    .run();
}

/** Validates every field, stores what is valid, and answers a receipt. Never throws on bad input. */
export async function ingestBatch(db: D1Database, batch: IngestBatch): Promise<IngestReceipt> {
  if (batch.kind === "guide_version") {
    const checked = validateGuideVersion(batch.observation);
    if (!checked.ok) return { accepted: 0, rejected: 1, reasons: [checked.reason] };
    await storeGuideVersion(db, checked.value, batch.collector);
    return { accepted: 1, rejected: 0, reasons: [] };
  }
  let accepted = 0;
  const reasons: string[] = [];
  for (const raw of batch.observations) {
    const checked = validatePublicPrice(raw);
    if (!checked.ok) {
      reasons.push(checked.reason);
      continue;
    }
    await storePublicPrice(db, checked.value, batch.collector);
    accepted++;
  }
  return { accepted, rejected: reasons.length, reasons };
}
