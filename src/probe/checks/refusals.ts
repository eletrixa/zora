/**
 * Probe check "refusals": the API's documented refusals still hold — no key, a Bearer header,
 * a state outside scope, a bad cursor. Talks to the raw endpoint, bypassing the client's own
 * error mapping, so the probe sees exactly what the guide promises.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/refusals.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/refusals.test.ts
 */
import type { CallMeta, ProbeCheck, ProbeStepResult, RawRequest } from "../../contracts/ports";

const CHECK = "refusals" as const;
const STEPS = ["no-key", "bearer", "state-code", "bad-cursor"] as const;
const PRODUCTS_PATH = "/octo-gateway/v1/products";

function mk(step: string, verdict: "pass" | "fail" | "skip", meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult {
  return { check: CHECK, step, verdict, httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}
const pass = (step: string, meta: CallMeta | null, detail: string): ProbeStepResult => mk(step, "pass", meta, null, detail);
const fail = (step: string, meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult => mk(step, "fail", meta, errorCode, detail);
const skip = (step: string, detail: string): ProbeStepResult => mk(step, "skip", null, null, detail);
const noKeySkip = (): ProbeStepResult[] => STEPS.map((step) => skip(step, "no API key yet"));
const crashed = (thrown: unknown): ProbeStepResult[] => [mk("crashed", "fail", null, null, thrown instanceof Error ? thrown.message : String(thrown))];

/** grouponErrorCode from the guide's "Handling errors" section: the one place that reads a body's code. */
function bodyErrorCode(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const details = record.details as Record<string, unknown> | undefined;
  const code = (record.error ?? details?.error ?? record.code) as unknown;
  return typeof code === "string" ? code : null;
}

function bodyProducts(body: unknown): readonly unknown[] | null {
  if (body === null || typeof body !== "object") return null;
  const products = (body as Record<string, unknown>).products;
  return Array.isArray(products) ? products : null;
}

export const check: ProbeCheck = {
  name: CHECK,
  run: async (ctx) => {
    try {
      const steps: ProbeStepResult[] = [];
      let noKeyHit = false;

      // no-key: guide, Shape C — a missing key answers 401 with code "unauthenticated".
      {
        const request: RawRequest = { method: "GET", path: PRODUCTS_PATH, query: { limit: "1" }, auth: "none" };
        const result = await ctx.partner.raw(request);
        if (!result.ok) {
          noKeyHit ||= result.error.code === "NO_KEY";
          steps.push(fail("no-key", result.meta, result.error.code, `guide: no key answers HTTP 401 code "unauthenticated"; the call itself failed with ${result.error.code}`));
        } else {
          const code = bodyErrorCode(result.value.body);
          steps.push(
            result.value.httpStatus === 401 && code === "unauthenticated"
              ? pass("no-key", result.meta, "no key answered HTTP 401 with code \"unauthenticated\"")
              : fail(
                  "no-key",
                  result.meta,
                  code,
                  `guide: no key answers HTTP 401 code "unauthenticated"; observed HTTP ${result.value.httpStatus} code ${JSON.stringify(code)}`,
                ),
          );
        }
      }

      // bearer: guide — "It is not a Bearer token. Authorization: Bearer ... returns 401."
      {
        const request: RawRequest = { method: "GET", path: PRODUCTS_PATH, query: { limit: "1" }, auth: "bearer" };
        const result = await ctx.partner.raw(request);
        if (!result.ok) {
          noKeyHit ||= result.error.code === "NO_KEY";
          steps.push(fail("bearer", result.meta, result.error.code, `guide: a Bearer header answers HTTP 401; the call itself failed with ${result.error.code}`));
        } else {
          steps.push(
            result.value.httpStatus === 401
              ? pass("bearer", result.meta, "a Bearer header answered HTTP 401")
              : fail("bearer", result.meta, bodyErrorCode(result.value.body), `guide: a Bearer header answers HTTP 401; observed HTTP ${result.value.httpStatus}`),
          );
        }
      }

      // state-code: guide, Inventory scope values — a state outside scope returns an empty page
      // (FORBIDDEN only when the partner HAS a state scope; this partner has none).
      {
        const request: RawRequest = { method: "GET", path: PRODUCTS_PATH, query: { limit: "10", state: "IL" }, auth: "key" };
        const result = await ctx.partner.raw(request);
        if (!result.ok) {
          noKeyHit ||= result.error.code === "NO_KEY";
          steps.push(fail("state-code", result.meta, result.error.code, `guide: a state abbreviation with no state scope answers HTTP 200 with zero products; the call itself failed with ${result.error.code}`));
        } else {
          const products = bodyProducts(result.value.body);
          steps.push(
            result.value.httpStatus === 200 && products !== null && products.length === 0
              ? pass("state-code", result.meta, "state=IL answered HTTP 200 with zero products")
              : fail(
                  "state-code",
                  result.meta,
                  bodyErrorCode(result.value.body),
                  `guide: a state abbreviation with no state scope answers HTTP 200 with zero products; observed HTTP ${result.value.httpStatus} with ${products === null ? "no products array" : `${products.length} products`}`,
                ),
          );
        }
      }

      // bad-cursor: guide — a malformed cursor is an error; a 200 with products is a fail.
      {
        const request: RawRequest = { method: "GET", path: PRODUCTS_PATH, query: { limit: "10", cursor: "not-a-cursor" }, auth: "key" };
        const result = await ctx.partner.raw(request);
        if (!result.ok) {
          noKeyHit ||= result.error.code === "NO_KEY";
          steps.push(
            result.error.code === "NO_KEY"
              ? fail("bad-cursor", result.meta, result.error.code, "guide: a bad cursor answers with an error code; the call itself failed with NO_KEY")
              : pass("bad-cursor", result.meta, `a bad cursor answered with error code ${result.error.code}`),
          );
        } else {
          const products = bodyProducts(result.value.body);
          if (result.value.httpStatus === 200 && products !== null && products.length > 0) {
            steps.push(fail("bad-cursor", result.meta, null, `guide: a bad cursor answers with an error code, never products; observed HTTP 200 with ${products.length} products`));
          } else {
            const code = bodyErrorCode(result.value.body);
            steps.push(
              code !== null
                ? pass("bad-cursor", result.meta, `a bad cursor answered with error code ${code}`)
                : fail("bad-cursor", result.meta, null, `guide: a bad cursor answers with an error code; observed HTTP ${result.value.httpStatus} with no error code`),
            );
          }
        }
      }

      return noKeyHit ? noKeySkip() : steps;
    } catch (thrown) {
      return crashed(thrown);
    }
  },
};
