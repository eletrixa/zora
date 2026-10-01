/**
 * Fetches the OpenAPI spec and compares its SHA256 hash against the last known value.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/openapi-drift.ts
 * Deps:    src/contracts/ports.ts, src/lib/crypto.ts
 * Tested:  test/probe/checks/openapi-drift.test.ts
 */
import { sha256Hex } from "../../lib/crypto";
import type { ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

export const check: ProbeCheck = {
  name: "openapi-drift",
  run: async (ctx: ProbeContext): Promise<readonly ProbeStepResult[]> => {
    const results: ProbeStepResult[] = [];

    try {
      // Step 1: Fetch openapi.json
      const fetchStart = ctx.clock.now();
      let fetchStatus: number | null = null;
      let body: string = "";

      try {
        const response = await ctx.fetch(ctx.config.openapiUrl, {
          headers: { "user-agent": "ZoraAgentLab/1.0" },
        });
        fetchStatus = response.status;
        body = await response.text();
      } catch (err) {
        results.push({
          check: "openapi-drift",
          step: "fetch",
          verdict: "fail",
          httpStatus: null,
          errorCode: "NETWORK",
          latencyMs: ctx.clock.now() - fetchStart,
          requestId: null,
          detail: `network error: ${err instanceof Error ? err.message : String(err)}`,
        });
        return results;
      }

      if (fetchStatus !== 200) {
        results.push({
          check: "openapi-drift",
          step: "fetch",
          verdict: "fail",
          httpStatus: fetchStatus,
          errorCode: "HTTP_ERROR",
          latencyMs: ctx.clock.now() - fetchStart,
          requestId: null,
          detail: `expected status 200, got ${fetchStatus}`,
        });
        return results;
      }

      // Validate JSON and paths object
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch (err) {
        results.push({
          check: "openapi-drift",
          step: "fetch",
          verdict: "fail",
          httpStatus: fetchStatus,
          errorCode: "UNPARSEABLE",
          latencyMs: ctx.clock.now() - fetchStart,
          requestId: null,
          detail: `response is not valid JSON`,
        });
        return results;
      }

      if (typeof json !== "object" || json === null || !("paths" in json)) {
        results.push({
          check: "openapi-drift",
          step: "fetch",
          verdict: "fail",
          httpStatus: fetchStatus,
          errorCode: "MISSING_PATHS",
          latencyMs: ctx.clock.now() - fetchStart,
          requestId: null,
          detail: `JSON does not have a paths object`,
        });
        return results;
      }

      results.push({
        check: "openapi-drift",
        step: "fetch",
        verdict: "pass",
        httpStatus: fetchStatus,
        errorCode: null,
        latencyMs: ctx.clock.now() - fetchStart,
        requestId: null,
        detail: "openapi.json fetched and valid",
      });

      // Step 2: Hash the body and compare with snapshot
      const hash = await sha256Hex(body);

      // Read the current snapshot
      const snapshot = await ctx.db.prepare("SELECT value FROM contract_snapshots WHERE kind = ?1").bind("openapi").first<{ value: string }>();

      let hashVerdict: "pass" | "fail" = "pass";
      let hashDetail = "no previous snapshot, this is the baseline";

      if (snapshot) {
        if (snapshot.value !== hash) {
          hashVerdict = "fail";
          const oldShort = snapshot.value.slice(0, 12);
          const newShort = hash.slice(0, 12);
          hashDetail = `hash changed from ${oldShort} to ${newShort}`;
        } else {
          hashDetail = "hash matches previous snapshot";
        }
      }

      results.push({
        check: "openapi-drift",
        step: "hash",
        verdict: hashVerdict,
        httpStatus: fetchStatus,
        errorCode: hashVerdict === "fail" ? "DRIFT" : null,
        latencyMs: ctx.clock.now() - fetchStart,
        requestId: null,
        detail: hashDetail,
        observed: { kind: "openapi", value: hash },
      });

      return results;
    } catch (err) {
      return [
        {
          check: "openapi-drift",
          step: "crashed",
          verdict: "fail",
          httpStatus: null,
          errorCode: "CRASH",
          latencyMs: null,
          requestId: null,
          detail: String(err instanceof Error ? err.message : err),
        },
      ];
    }
  },
};
