/**
 * The probe registry lists every check exactly once, under its own name.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/contracts/registry.test.ts
 * Deps:    bun:test, src/probe/checks/index.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { ALL_CHECKS } from "../../src/probe/checks";

describe("probe registry", () => {
  it("holds the eleven checks in run order, each once", () => {
    expect(ALL_CHECKS.map((check) => check.name)).toEqual([
      "openapi-drift",
      "guide-version",
      "registration",
      "catalogue-page",
      "catalogue-walk",
      "catalogue-delta",
      "refusals",
      "cart-lifecycle",
      "price-mismatch",
      "buy-link",
      "order-read",
    ]);
  });
});
