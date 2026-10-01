/**
 * Reads the partner registration and validates partner and supplier data.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/registration.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/registration.test.ts
 */
import type { ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

export const check: ProbeCheck = {
  name: "registration",
  run: async (ctx: ProbeContext): Promise<readonly ProbeStepResult[]> => {
    const results: ProbeStepResult[] = [];

    try {
      // Step 1: Read partner registration
      const partnerResult = await ctx.partner.getPartner();
      if (!partnerResult.ok) {
        const error = partnerResult.error;
        if (error.code === "NO_KEY") {
          return [
            { check: "registration", step: "read", verdict: "skip", httpStatus: null, errorCode: "NO_KEY", latencyMs: null, requestId: null, detail: "no API key yet" },
            { check: "registration", step: "name", verdict: "skip", httpStatus: null, errorCode: "NO_KEY", latencyMs: null, requestId: null, detail: "no API key yet" },
            { check: "registration", step: "active", verdict: "skip", httpStatus: null, errorCode: "NO_KEY", latencyMs: null, requestId: null, detail: "no API key yet" },
            { check: "registration", step: "urls", verdict: "skip", httpStatus: null, errorCode: "NO_KEY", latencyMs: null, requestId: null, detail: "no API key yet" },
            { check: "registration", step: "supplier", verdict: "skip", httpStatus: null, errorCode: "NO_KEY", latencyMs: null, requestId: null, detail: "no API key yet" },
          ];
        }
        results.push({
          check: "registration",
          step: "read",
          verdict: "fail",
          httpStatus: partnerResult.meta.httpStatus,
          errorCode: error.code,
          latencyMs: partnerResult.meta.latencyMs,
          requestId: partnerResult.meta.requestId,
          detail: `${error.code}: ${error.message}`,
        });

        // Still check supplier even if partner read failed
        const supplierResult = await ctx.partner.getSupplier();
        results.push({
          check: "registration",
          step: "name",
          verdict: "fail",
          httpStatus: partnerResult.meta.httpStatus,
          errorCode: "SKIPPED",
          latencyMs: null,
          requestId: null,
          detail: "skipped due to read failure",
        });
        results.push({
          check: "registration",
          step: "active",
          verdict: "fail",
          httpStatus: partnerResult.meta.httpStatus,
          errorCode: "SKIPPED",
          latencyMs: null,
          requestId: null,
          detail: "skipped due to read failure",
        });
        results.push({
          check: "registration",
          step: "urls",
          verdict: "fail",
          httpStatus: partnerResult.meta.httpStatus,
          errorCode: "SKIPPED",
          latencyMs: null,
          requestId: null,
          detail: "skipped due to read failure",
        });

        if (!supplierResult.ok) {
          results.push({
            check: "registration",
            step: "supplier",
            verdict: "fail",
            httpStatus: supplierResult.meta.httpStatus,
            errorCode: supplierResult.error.code,
            latencyMs: supplierResult.meta.latencyMs,
            requestId: supplierResult.meta.requestId,
            detail: `${supplierResult.error.code}: ${supplierResult.error.message}`,
          });
        } else {
          const supplier = supplierResult.value;
          const supplierPass = supplier.id && supplier.id.length > 0;
          results.push({
            check: "registration",
            step: "supplier",
            verdict: supplierPass ? "pass" : "fail",
            httpStatus: supplierResult.meta.httpStatus,
            errorCode: supplierPass ? null : "NO_ID",
            latencyMs: supplierResult.meta.latencyMs,
            requestId: supplierResult.meta.requestId,
            detail: supplierPass ? "supplier id is set" : "supplier id is empty",
          });
        }

        return results;
      }

      const partner = partnerResult.value;

      // Step 1b: Read step passed
      results.push({
        check: "registration",
        step: "read",
        verdict: "pass",
        httpStatus: partnerResult.meta.httpStatus,
        errorCode: null,
        latencyMs: partnerResult.meta.latencyMs,
        requestId: partnerResult.meta.requestId,
        detail: "partner registration read successfully",
      });

      // Step 2: Check displayName
      const namePass = partner.displayName === ctx.config.expectedDisplayName;
      results.push({
        check: "registration",
        step: "name",
        verdict: namePass ? "pass" : "fail",
        httpStatus: partnerResult.meta.httpStatus,
        errorCode: namePass ? null : "MISMATCH",
        latencyMs: partnerResult.meta.latencyMs,
        requestId: partnerResult.meta.requestId,
        detail: namePass ? "displayName matches expected" : `expected "${ctx.config.expectedDisplayName}", got "${partner.displayName}"`,
      });

      // Step 3: Check status
      const activePass = partner.status === "active";
      results.push({
        check: "registration",
        step: "active",
        verdict: activePass ? "pass" : "fail",
        httpStatus: partnerResult.meta.httpStatus,
        errorCode: activePass ? null : "INACTIVE",
        latencyMs: partnerResult.meta.latencyMs,
        requestId: partnerResult.meta.requestId,
        detail: activePass ? "status is active" : `expected status "active", got "${partner.status}"`,
      });

      // Step 4: Check URLs
      const hasLogoUrl = partner.logoUrl && partner.logoUrl.startsWith("https://");
      const hasRedirectUrl = partner.redirectUrl && partner.redirectUrl.startsWith("https://");
      const urlsPass = hasLogoUrl && hasRedirectUrl;
      results.push({
        check: "registration",
        step: "urls",
        verdict: urlsPass ? "pass" : "fail",
        httpStatus: partnerResult.meta.httpStatus,
        errorCode: urlsPass ? null : "MISSING_URLS",
        latencyMs: partnerResult.meta.latencyMs,
        requestId: partnerResult.meta.requestId,
        detail: urlsPass ? "logoUrl and redirectUrl are HTTPS" : `logoUrl: ${partner.logoUrl}, redirectUrl: ${partner.redirectUrl}`,
      });

      // Step 5: Read supplier
      const supplierResult = await ctx.partner.getSupplier();
      if (!supplierResult.ok) {
        results.push({
          check: "registration",
          step: "supplier",
          verdict: "fail",
          httpStatus: supplierResult.meta.httpStatus,
          errorCode: supplierResult.error.code,
          latencyMs: supplierResult.meta.latencyMs,
          requestId: supplierResult.meta.requestId,
          detail: `${supplierResult.error.code}: ${supplierResult.error.message}`,
        });
      } else {
        const supplier = supplierResult.value;
        const supplierPass = supplier.id && supplier.id.length > 0;
        results.push({
          check: "registration",
          step: "supplier",
          verdict: supplierPass ? "pass" : "fail",
          httpStatus: supplierResult.meta.httpStatus,
          errorCode: supplierPass ? null : "NO_ID",
          latencyMs: supplierResult.meta.latencyMs,
          requestId: supplierResult.meta.requestId,
          detail: supplierPass ? "supplier id is set" : "supplier id is empty",
        });
      }

      return results;
    } catch (err) {
      return [
        {
          check: "registration",
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
