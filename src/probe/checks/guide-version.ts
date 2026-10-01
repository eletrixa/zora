/**
 * Reads the latest guide observation and compares its version against the last known value.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/guide-version.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/guide-version.test.ts
 */
import type { ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

const FRESHNESS_MS = 48 * 3600_000; // 48 hours in milliseconds

export const check: ProbeCheck = {
  name: "guide-version",
  run: async (ctx: ProbeContext): Promise<readonly ProbeStepResult[]> => {
    const results: ProbeStepResult[] = [];

    try {
      // Step 1: Check freshness of observations
      const observation = await ctx.db
        .prepare("SELECT version, http_status FROM guide_observations ORDER BY observed_at DESC LIMIT 1")
        .first<{ version: string | null; http_status: number }>();

      if (!observation) {
        results.push({
          check: "guide-version",
          step: "fresh",
          verdict: "skip",
          httpStatus: null,
          errorCode: "NO_DATA",
          latencyMs: null,
          requestId: null,
          detail: "no guide reading in the last 48 hours",
        });
        return results;
      }

      // Check if the observation is fresh (within 48 hours)
      const observationTime = await ctx.db
        .prepare("SELECT observed_at FROM guide_observations ORDER BY observed_at DESC LIMIT 1")
        .first<{ observed_at: string }>();

      if (!observationTime) {
        results.push({
          check: "guide-version",
          step: "fresh",
          verdict: "skip",
          httpStatus: null,
          errorCode: "NO_DATA",
          latencyMs: null,
          requestId: null,
          detail: "no guide reading in the last 48 hours",
        });
        return results;
      }

      const obsTimeMs = new Date(observationTime.observed_at).getTime();
      const nowMs = ctx.clock.now();
      const ageMs = nowMs - obsTimeMs;

      if (ageMs > FRESHNESS_MS) {
        results.push({
          check: "guide-version",
          step: "fresh",
          verdict: "skip",
          httpStatus: null,
          errorCode: "STALE",
          latencyMs: null,
          requestId: null,
          detail: "no guide reading in the last 48 hours",
        });
        return results;
      }

      results.push({
        check: "guide-version",
        step: "fresh",
        verdict: "pass",
        httpStatus: null,
        errorCode: null,
        latencyMs: null,
        requestId: null,
        detail: "guide observation is fresh",
      });

      // Step 2: Check version
      if (observation.version === null) {
        results.push({
          check: "guide-version",
          step: "version",
          verdict: "fail",
          httpStatus: observation.http_status,
          errorCode: "READ_FAILED",
          latencyMs: null,
          requestId: null,
          detail: `the guide page could not be read, HTTP ${observation.http_status}`,
        });
        return results;
      }

      const version = observation.version;

      // Read the current snapshot
      const snapshot = await ctx.db.prepare("SELECT value FROM contract_snapshots WHERE kind = ?1").bind("guide").first<{ value: string }>();

      let versionVerdict: "pass" | "fail" = "pass";
      let versionDetail = "no previous snapshot, this is the baseline";

      if (snapshot) {
        if (snapshot.value !== version) {
          versionVerdict = "fail";
          versionDetail = `version changed from ${snapshot.value} to ${version}`;
        } else {
          versionDetail = "version matches previous snapshot";
        }
      }

      results.push({
        check: "guide-version",
        step: "version",
        verdict: versionVerdict,
        httpStatus: null,
        errorCode: versionVerdict === "fail" ? "DRIFT" : null,
        latencyMs: null,
        requestId: null,
        detail: versionDetail,
        observed: { kind: "guide", value: version },
      });

      return results;
    } catch (err) {
      return [
        {
          check: "guide-version",
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
