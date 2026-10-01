/**
 * Pure parsing for the zora collector: prices out of a listing page's JSON-LD, and the guide
 * version out of the guide page's text. No I/O, no fetch, no clock.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  collector/parse.ts
 * Deps:    src/contracts/ingest.ts
 * Tested:  test/collector/parse.test.ts
 */
import type { PublicPriceObservation } from "../src/contracts/ingest";

const DEAL_PREFIX = "https://www.groupon.com/deals/";
const LD_JSON_BLOCK = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

/** "94.00" -> 9400, "49" -> 4900, "1,299.00" -> 129900. Anything else is not a price. */
export function parsePriceToMinor(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(whole) * 100 + Number(fraction);
}

/** Every `item` object under every ItemList's itemListElement, across all ld+json blocks. */
function extractListedProducts(html: string): unknown[] {
  const products: unknown[] = [];
  for (const match of html.matchAll(LD_JSON_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1] ?? "");
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const doc = parsed as Record<string, unknown>;
    if (doc["@type"] !== "ItemList" || !Array.isArray(doc["itemListElement"])) continue;
    for (const listItem of doc["itemListElement"]) {
      if (listItem && typeof listItem === "object" && "item" in (listItem as Record<string, unknown>)) {
        products.push((listItem as Record<string, unknown>)["item"]);
      }
    }
  }
  return products;
}

/** How many product entries a listing page carries, valid or not. For accepted/rejected counts. */
export function countListedEntries(html: string): number {
  return extractListedProducts(html).length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toObservation(product: unknown, sourceUrl: string, observedAt: string): PublicPriceObservation | null {
  const item = asRecord(product);
  if (!item) return null;
  const dealUrl = typeof item.url === "string" ? item.url : null;
  if (!dealUrl || !dealUrl.startsWith(DEAL_PREFIX)) return null;
  const offer = asRecord(item.offers);
  if (!offer) return null;
  const currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency : null;
  if (currency !== "USD") return null;
  const priceText = typeof offer.price === "string" ? offer.price : null;
  const priceMinor = priceText === null ? null : parsePriceToMinor(priceText);
  if (priceMinor === null) return null;
  const spec = asRecord(offer.priceSpecification);
  const specPrice = spec && typeof spec.price === "string" ? spec.price : null;
  const listPriceMinor = specPrice === null ? null : parsePriceToMinor(specPrice);
  const permalink = dealUrl.slice(DEAL_PREFIX.length).split("/")[0] || dealUrl;
  const brand = asRecord(item.brand);
  const merchant = brand && typeof brand.name === "string" ? brand.name : null;
  const title = typeof item.name === "string" ? item.name : "";
  return { sourceUrl, dealUrl, permalink, title, merchant, currency, priceMinor, listPriceMinor, observedAt };
}

/**
 * The valid public price observations on a listing page. An entry without a URL under
 * https://www.groupon.com/deals/, without a price, or with a currency other than USD is left out;
 * count it against `countListedEntries(html)` to find how many were skipped.
 */
export function parseListing(html: string, sourceUrl: string, observedAt: string): PublicPriceObservation[] {
  const observations: PublicPriceObservation[] = [];
  for (const product of extractListedProducts(html)) {
    const observation = toObservation(product, sourceUrl, observedAt);
    if (observation) observations.push(observation);
  }
  return observations;
}

/** "Version 7. Changes since..." -> "7". null when the page does not say. */
export function parseGuideVersion(text: string): string | null {
  const match = /Version\s+(\d+)\./.exec(text);
  return match ? (match[1] ?? null) : null;
}
