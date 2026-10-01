/**
 * Probe check "price-mismatch": sends expectedPrice one cent above the catalogue's retail and
 * checks the API refuses the cart with PRICE_MISMATCH and reports the live price.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/price-mismatch.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/price-mismatch.test.ts
 */
import type { CallMeta, ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

const NAME = "price-mismatch" as const;
const STEPS = ["refused", "current-price"] as const;

function pass(step: string, meta: CallMeta, detail: string): ProbeStepResult {
  return { check: NAME, step, verdict: "pass", httpStatus: meta.httpStatus, errorCode: null, latencyMs: meta.latencyMs, requestId: meta.requestId, detail };
}

function fail(step: string, meta: CallMeta | null, detail: string, errorCode: string | null = null): ProbeStepResult {
  return { check: NAME, step, verdict: "fail", httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}

function skip(step: string, detail: string): ProbeStepResult {
  return { check: NAME, step, verdict: "skip", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail };
}

function skipAll(detail: string): readonly ProbeStepResult[] {
  return STEPS.map((step) => skip(step, detail));
}

export const check: ProbeCheck = {
  name: NAME,
  async run(ctx: ProbeContext): Promise<readonly ProbeStepResult[]> {
    try {
      const day = new Date(ctx.clock.now()).toISOString().slice(0, 10);
      const options = await ctx.catalogue.sampleListableOptions(2, `${NAME}:${day}`);
      const option = options[0];
      if (!option) return skipAll("the catalogue copy is empty");

      const results: ProbeStepResult[] = [];
      let cartId: string | null = null;
      try {
        const wrongPrice = option.retail + 1;
        const created = await ctx.partner.createCart([{ productId: option.productId, optionId: option.optionId, quantity: 1, expectedPrice: wrongPrice }], "probe");
        if (!created.ok && created.error.code === "NO_KEY") return skipAll("no API key yet");

        if (created.ok) {
          cartId = created.value.id;
          results.push(fail("refused", created.meta, `expected the call to be refused with PRICE_MISMATCH, but a cart was created`));
          results.push(skip("current-price", "the call was not refused, so there is no error to read"));
          return results;
        }

        const error = created.error;
        if (error.code !== "PRICE_MISMATCH") {
          results.push(fail("refused", created.meta, `expected PRICE_MISMATCH, got ${error.code}`, error.code));
          results.push(skip("current-price", "the call was not refused with PRICE_MISMATCH"));
          return results;
        }
        results.push(pass("refused", created.meta, `refused with PRICE_MISMATCH after sending expectedPrice ${wrongPrice}, one cent above retail`));

        if (typeof error.currentPrice !== "number" || !Number.isInteger(error.currentPrice)) {
          results.push(fail("current-price", created.meta, `expected error.currentPrice to be an integer, got ${JSON.stringify(error.currentPrice)}`));
        } else if (error.currentPrice === option.retail) {
          results.push(pass("current-price", created.meta, `error.currentPrice ${error.currentPrice} matches the catalogue retail`));
        } else {
          results.push(pass("current-price", created.meta, `catalogue copy is stale: catalogue retail ${option.retail}, live currentPrice ${error.currentPrice}`));
        }
      } finally {
        if (cartId) await ctx.carts.abandon(cartId);
      }
      return results;
    } catch (thrown) {
      return [fail("crashed", null, `the check crashed: ${String(thrown)}`)];
    }
  },
};
