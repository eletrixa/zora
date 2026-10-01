/**
 * Probe check "catalogue-delta": a delta pull against sync_state.last_refresh_at, sent without
 * `active` per the guide's "Syncing the catalog" step 2.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/catalogue-delta.ts
 * Deps:    src/contracts/ports.ts, migrations/0002_sync.sql (sync_state)
 * Tested:  test/probe/checks/catalogue-delta.test.ts
 */
import type { CallMeta, ProbeCheck, ProbeStepResult } from "../../contracts/ports";

const CHECK = "catalogue-delta" as const;

function mk(step: string, verdict: "pass" | "fail" | "skip", meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult {
  return { check: CHECK, step, verdict, httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}
const pass = (step: string, meta: CallMeta | null, detail: string): ProbeStepResult => mk(step, "pass", meta, null, detail);
const fail = (step: string, meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult => mk(step, "fail", meta, errorCode, detail);
const skip = (step: string, detail: string): ProbeStepResult => mk(step, "skip", null, null, detail);
const noKeySkip = (): ProbeStepResult[] => ["read", "shape"].map((step) => skip(step, "no API key yet"));
const crashed = (thrown: unknown): ProbeStepResult[] => [mk("crashed", "fail", null, null, thrown instanceof Error ? thrown.message : String(thrown))];

export const check: ProbeCheck = {
  name: CHECK,
  run: async (ctx) => {
    try {
      const watermark = await ctx.db.prepare("SELECT value FROM sync_state WHERE key = ?1").bind("last_refresh_at").first<{ value: string }>();
      if (!watermark) return [skip("watermark", "no full load yet")];

      const result = await ctx.partner.listProducts({ limit: 10, updatedSince: watermark.value });
      if (!result.ok) {
        if (result.error.code === "NO_KEY") return noKeySkip();
        return [fail("read", result.meta, result.error.code, `expected the delta page to succeed, got ${result.error.code}`)];
      }

      const page = result.value;
      const steps: ProbeStepResult[] = [pass("read", result.meta, `delta page loaded since ${watermark.value}`)];
      steps.push(
        Array.isArray(page.products)
          ? pass("shape", result.meta, `${page.products.length} product(s) changed on the first page`)
          : fail("shape", result.meta, null, `expected products to be an array, got ${typeof page.products}`),
      );
      return steps;
    } catch (thrown) {
      return crashed(thrown);
    }
  },
};
