/**
 * Probe check "catalogue-page": one page of GET /products holds up against the guide's shape.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/catalogue-page.ts
 * Deps:    src/contracts/ports.ts, src/contracts/partner.ts
 * Tested:  test/probe/checks/catalogue-page.test.ts
 */
import type { OctoProduct } from "../../contracts/partner";
import type { CallMeta, ProbeCheck, ProbeStepResult } from "../../contracts/ports";

const CHECK = "catalogue-page" as const;
const STEPS = ["read", "count", "shape", "promo", "timestamp"] as const;
const VALID_STATUSES: readonly string[] = ["active", "sold_out", "expired"];

function mk(step: string, verdict: "pass" | "fail" | "skip", meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult {
  return { check: CHECK, step, verdict, httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}
const pass = (step: string, meta: CallMeta | null, detail: string): ProbeStepResult => mk(step, "pass", meta, null, detail);
const fail = (step: string, meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult => mk(step, "fail", meta, errorCode, detail);
const skip = (step: string, detail: string): ProbeStepResult => mk(step, "skip", null, null, detail);
const noKeySkip = (): ProbeStepResult[] => STEPS.map((step) => skip(step, "no API key yet"));
const crashed = (thrown: unknown): ProbeStepResult[] => [mk("crashed", "fail", null, null, thrown instanceof Error ? thrown.message : String(thrown))];

/** The first product/field that breaks the guide's documented shape, or null when none does. */
function firstShapeIssue(products: readonly OctoProduct[]): string | null {
  for (const product of products) {
    if (!product.id) return `a product has an empty id`;
    if (!product.title) return `product ${JSON.stringify(product.id)} has an empty title`;
    if (!VALID_STATUSES.includes(product.status)) {
      return `product ${product.id} has status ${JSON.stringify(product.status)}, expected one of ${VALID_STATUSES.join(", ")}`;
    }
    if (!Array.isArray(product.options)) return `product ${product.id} has no options array`;
    for (const option of product.options) {
      const pricing = option.units[0]?.pricing[0];
      if (!pricing) return `product ${product.id}, option ${option.id} has no pricing entry on its first unit`;
      if (!Number.isInteger(pricing.retail) || pricing.retail < 0) {
        return `product ${product.id}, option ${option.id} has retail ${JSON.stringify(pricing.retail)}, expected a non-negative integer`;
      }
      if (!Number.isInteger(pricing.original) || pricing.original < 0) {
        return `product ${product.id}, option ${option.id} has original ${JSON.stringify(pricing.original)}, expected a non-negative integer`;
      }
      if (!Number.isInteger(pricing.currencyPrecision)) {
        return `product ${product.id}, option ${option.id} has currencyPrecision ${JSON.stringify(pricing.currencyPrecision)}, expected an integer`;
      }
    }
  }
  return null;
}

/** The first promo price that beats its own retail, or null when every promo is honest. */
function firstPromoIssue(products: readonly OctoProduct[]): string | null {
  for (const product of products) {
    for (const option of product.options) {
      const pricing = option.units[0]?.pricing[0];
      const discounted = pricing?.discountedPrice;
      if (discounted == null) continue;
      if (!Number.isInteger(discounted.amount)) {
        return `product ${product.id}, option ${option.id} has a promo amount ${JSON.stringify(discounted.amount)}, expected an integer`;
      }
      if (pricing && discounted.amount > pricing.retail) {
        return `product ${product.id}, option ${option.id} has a promo of ${discounted.amount} above its retail of ${pricing.retail}`;
      }
    }
  }
  return null;
}

export const check: ProbeCheck = {
  name: CHECK,
  run: async (ctx) => {
    try {
      const result = await ctx.partner.listProducts({ limit: 10 });
      if (!result.ok) {
        if (result.error.code === "NO_KEY") return noKeySkip();
        return [fail("read", result.meta, result.error.code, `expected the page to succeed, got ${result.error.code}`)];
      }
      const page = result.value;
      const steps: ProbeStepResult[] = [pass("read", result.meta, `page loaded with ${page.products.length} products`)];

      const count = page.products.length;
      steps.push(
        count >= 1 && count <= 10
          ? pass("count", result.meta, `${count} products on the page`)
          : fail("count", result.meta, null, `expected 1 to 10 products, got ${count}`),
      );

      const shapeIssue = firstShapeIssue(page.products);
      steps.push(shapeIssue ? fail("shape", result.meta, null, shapeIssue) : pass("shape", result.meta, "every product has the documented shape"));

      const promoIssue = firstPromoIssue(page.products);
      steps.push(promoIssue ? fail("promo", result.meta, null, promoIssue) : pass("promo", result.meta, "every promo price is at or below retail"));

      const parsed = Date.parse(page.timestamp);
      steps.push(
        Number.isNaN(parsed)
          ? fail("timestamp", result.meta, null, `expected timestamp to parse as a time, got ${JSON.stringify(page.timestamp)}`)
          : pass("timestamp", result.meta, `timestamp parses to ${new Date(parsed).toISOString()}`),
      );

      return steps;
    } catch (thrown) {
      return crashed(thrown);
    }
  },
};
