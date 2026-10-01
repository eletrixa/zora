/**
 * The GET /search query reader: criteria requirement, clamping, dollars to minor units.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/agent/api/query.test.ts
 * Deps:    bun:test, src/agent/api/query.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { parseSearchQuery } from "../../../src/agent/api/query";

describe("parseSearchQuery", () => {
  it("refuses when none of the five criteria are given", () => {
    const result = parseSearchQuery({ limit: "5" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("missing_criteria");
  });

  it("accepts q alone", () => {
    const result = parseSearchQuery({ q: "massage" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query.text).toBe("massage");
  });

  it("accepts state, city, category or maxPrice alone", () => {
    expect(parseSearchQuery({ state: "IL" }).ok).toBe(true);
    expect(parseSearchQuery({ city: "Chicago" }).ok).toBe(true);
    expect(parseSearchQuery({ category: "Spa" }).ok).toBe(true);
    expect(parseSearchQuery({ maxPrice: "49.5" }).ok).toBe(true);
  });

  it("converts maxPrice dollars to minor units", () => {
    const result = parseSearchQuery({ maxPrice: "49.5" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query.maxPriceMinor).toBe(4950);
  });

  it("ignores a maxPrice that is not a positive number", () => {
    const result = parseSearchQuery({ q: "spa", maxPrice: "not-a-number" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query.maxPriceMinor).toBeUndefined();
  });

  it("clamps text to 200 characters", () => {
    const long = "a".repeat(500);
    const result = parseSearchQuery({ q: long });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.query.text.length).toBe(200);
  });

  it("defaults limit to 10 and caps it at 50", () => {
    const noLimit = parseSearchQuery({ q: "spa" });
    expect(noLimit.ok).toBe(true);
    if (noLimit.ok) expect(noLimit.query.limit).toBe(10);

    const bigLimit = parseSearchQuery({ q: "spa", limit: "500" });
    expect(bigLimit.ok).toBe(true);
    if (bigLimit.ok) expect(bigLimit.query.limit).toBe(50);
  });

  it("ignores unknown fields", () => {
    const result = parseSearchQuery({ q: "spa", bogus: "yes" });
    expect(result.ok).toBe(true);
  });
});
