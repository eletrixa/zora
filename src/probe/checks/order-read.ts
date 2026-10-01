/**
 * Reads a known test order and validates its status and items.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/order-read.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/order-read.test.ts
 */
import type { ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

const VALID_STATUSES = ["ON_HOLD", "CONFIRMED", "REDEEMED", "CANCELLED", "EXPIRED", "REJECTED", "PENDING"];

export const check: ProbeCheck = {
  name: "order-read",
  run: async (ctx: ProbeContext): Promise<readonly ProbeStepResult[]> => {
    const results: ProbeStepResult[] = [];

    try {
      if (!ctx.config.knownOrderUuid) {
        return [
          {
            check: "order-read",
            step: "skip",
            verdict: "skip",
            httpStatus: null,
            errorCode: null,
            latencyMs: null,
            requestId: null,
            detail: "no test order yet",
          },
        ];
      }

      // Step 1: Read booking
      const bookingResult = await ctx.partner.getBooking(ctx.config.knownOrderUuid);
      if (!bookingResult.ok) {
        results.push({
          check: "order-read",
          step: "read",
          verdict: "fail",
          httpStatus: bookingResult.meta.httpStatus,
          errorCode: bookingResult.error.code,
          latencyMs: bookingResult.meta.latencyMs,
          requestId: bookingResult.meta.requestId,
          detail: `${bookingResult.error.code}: ${bookingResult.error.message}`,
        });
        return results;
      }

      const booking = bookingResult.value;

      results.push({
        check: "order-read",
        step: "read",
        verdict: "pass",
        httpStatus: bookingResult.meta.httpStatus,
        errorCode: null,
        latencyMs: bookingResult.meta.latencyMs,
        requestId: bookingResult.meta.requestId,
        detail: "booking read successfully",
      });

      // Step 2: Check status is one of seven documented statuses
      const statusValid = VALID_STATUSES.includes(booking.status);
      results.push({
        check: "order-read",
        step: "status",
        verdict: statusValid ? "pass" : "fail",
        httpStatus: bookingResult.meta.httpStatus,
        errorCode: statusValid ? null : "INVALID_STATUS",
        latencyMs: bookingResult.meta.latencyMs,
        requestId: bookingResult.meta.requestId,
        detail: statusValid ? `status is ${booking.status}` : `expected one of [${VALID_STATUSES.join(", ")}], got ${booking.status}`,
      });

      // Step 3: Check items structure
      const itemsValid =
        booking.items.length > 0 &&
        booking.items.every(
          (item) =>
            item.optionId &&
            item.optionId.length > 0 &&
            item.unitItems &&
            item.unitItems.length > 0 &&
            item.unitItems.some((unitItem) => unitItem.myGrouponUrl && unitItem.myGrouponUrl.startsWith("https://"))
        );

      let itemsDetail = "items structure is valid";
      if (booking.items.length === 0) {
        itemsDetail = "no items in booking";
      } else {
        const badItem = booking.items.find((item) => !item.optionId || item.optionId.length === 0);
        if (badItem) {
          itemsDetail = `item has no optionId`;
        } else {
          const badItemUnits = booking.items.find((item) => !item.unitItems || item.unitItems.length === 0);
          if (badItemUnits) {
            itemsDetail = `item has no unit items`;
          } else {
            const badItemUrl = booking.items.find(
              (item) => !item.unitItems.some((unitItem) => unitItem.myGrouponUrl && unitItem.myGrouponUrl.startsWith("https://"))
            );
            if (badItemUrl) {
              itemsDetail = `item has no HTTPS myGrouponUrl`;
            }
          }
        }
      }

      results.push({
        check: "order-read",
        step: "items",
        verdict: itemsValid ? "pass" : "fail",
        httpStatus: bookingResult.meta.httpStatus,
        errorCode: itemsValid ? null : "INVALID_ITEMS",
        latencyMs: bookingResult.meta.latencyMs,
        requestId: bookingResult.meta.requestId,
        detail: itemsDetail,
      });

      return results;
    } catch (err) {
      return [
        {
          check: "order-read",
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
