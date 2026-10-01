/**
 * Probe check "buy-link": creates a cart and checks its buyLink is a well-formed, reachable
 * checkout address on the expected host.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/buy-link.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/buy-link.test.ts
 */
import type { CallMeta, ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

const NAME = "buy-link" as const;
const STEPS = ["present", "host", "reachable"] as const;
const USER_AGENT = "ZoraAgentLab-probe/1.0 (+https://zorasocial.asajj.cz)";

function pass(step: string, meta: CallMeta | null, detail: string): ProbeStepResult {
  return { check: NAME, step, verdict: "pass", httpStatus: meta?.httpStatus ?? null, errorCode: null, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
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
        const created = await ctx.carts.create([{ productId: option.productId, optionId: option.optionId, quantity: 1, expectedPriceMinor: option.retail }], "probe");
        if (created.kind === "error" && created.error.code === "NO_KEY") return skipAll("no API key yet");
        if (created.kind !== "created") {
          results.push(fail("present", created.meta, `expected the cart to be created, got "${created.kind}"`));
          results.push(skip("host", "no cart was created"));
          results.push(skip("reachable", "no cart was created"));
          return results;
        }
        cartId = created.cart.id;
        const buyLink = created.cart.buyLink;

        const present = typeof buyLink === "string" && buyLink.length > 0 && buyLink.startsWith("https://");
        results.push(
          present ? pass("present", created.meta, `buyLink is a non-empty https address`) : fail("present", created.meta, `expected a non-empty https:// buyLink, got ${JSON.stringify(buyLink)}`),
        );
        if (!present) {
          results.push(skip("host", "no valid buyLink to check"));
          results.push(skip("reachable", "no valid buyLink to check"));
          return results;
        }

        let url: URL | null = null;
        try {
          url = new URL(buyLink);
        } catch {
          url = null;
        }
        if (!url) {
          results.push(fail("host", created.meta, `buyLink is not a parseable URL: ${buyLink}`));
          results.push(skip("reachable", "no valid buyLink host to check"));
          return results;
        }

        const registration = await ctx.partner.getPartner();
        const hasCj = registration.ok && registration.value.cjPublisherId !== null;
        const hostOk = hasCj ? url.host !== ctx.config.checkoutHost : url.host === ctx.config.checkoutHost;
        results.push(
          hostOk
            ? pass(
                "host",
                registration.ok ? registration.meta : created.meta,
                hasCj ? `registration has a CJ publisher id; buyLink host ${url.host} is not the direct checkout host` : `buyLink host is ${url.host}, the configured checkout host`,
              )
            : fail(
                "host",
                registration.ok ? registration.meta : created.meta,
                hasCj
                  ? `registration has a CJ publisher id but buyLink host is still ${url.host}, the direct checkout host`
                  : `expected buyLink host ${ctx.config.checkoutHost}, got ${url.host}`,
              ),
        );

        let response: Response;
        try {
          response = await ctx.fetch(buyLink, { redirect: "manual", headers: { "user-agent": USER_AGENT } });
        } catch (thrown) {
          results.push(fail("reachable", null, `fetching buyLink threw: ${String(thrown)}`));
          return results;
        }
        const status = response.status;
        const reachable = status === 200 || (status >= 300 && status < 400);
        results.push(
          reachable
            ? { check: NAME, step: "reachable", verdict: "pass", httpStatus: status, errorCode: null, latencyMs: null, requestId: null, detail: `buyLink answered ${status}` }
            : { check: NAME, step: "reachable", verdict: "fail", httpStatus: status, errorCode: null, latencyMs: null, requestId: null, detail: `expected 200 or a redirect, buyLink answered ${status}` },
        );
      } finally {
        if (cartId) await ctx.carts.abandon(cartId);
      }
      return results;
    } catch (thrown) {
      return [fail("crashed", null, `the check crashed: ${String(thrown)}`)];
    }
  },
};
