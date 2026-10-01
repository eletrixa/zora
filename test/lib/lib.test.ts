/**
 * Shared library: money, crypto helpers, HTML escaping, the not-built placeholder.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/lib/lib.test.ts
 * Deps:    bun:test, src/lib/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { iso, utcDay } from "../../src/lib/clock";
import { hmacHex, isUuid, sha256Hex, timingSafeEqual } from "../../src/lib/crypto";
import { esc, safeNext } from "../../src/lib/html";
import { formatMoney, gapShare } from "../../src/lib/money";
import { NotBuiltError, notBuilt } from "../../src/lib/not-built";
import { STATE_NAME_BY_CODE, stateCode, stateName } from "../../src/lib/us-states";

describe("formatMoney", () => {
  it("formats minor units with the currency symbol", () => {
    expect(formatMoney(4900, "USD", 2)).toBe("$49.00");
    expect(formatMoney(5, "USD", 2)).toBe("$0.05");
    expect(formatMoney(123456789, "USD", 2)).toBe("$1,234,567.89");
    expect(formatMoney(-250, "USD", 2)).toBe("-$2.50");
  });
  it("handles zero precision and unknown currencies", () => {
    expect(formatMoney(1500, "JPY", 0)).toBe("1,500 JPY");
  });
  it("refuses a float, because money is an integer everywhere", () => {
    expect(() => formatMoney(49.5, "USD", 2)).toThrow();
  });
});

describe("gapShare", () => {
  it("is the share of retail a shopper overpays without the code", () => {
    expect(gapShare(4900, 3920)).toBeCloseTo(0.2, 10);
  });
  it("is zero when there is nothing to gain", () => {
    expect(gapShare(4900, 4900)).toBe(0);
    expect(gapShare(4900, 5000)).toBe(0);
    expect(gapShare(0, 0)).toBe(0);
  });
});

describe("crypto helpers", () => {
  it("hashes and signs deterministically", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hmacHex("k", "m")).toBe(await hmacHex("k", "m"));
    expect(await hmacHex("k", "m")).not.toBe(await hmacHex("k2", "m"));
  });
  it("compares in constant time and treats different lengths as unequal", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
  it("accepts only a full UUID", () => {
    expect(isUuid("3f2b8c1e-7d4a-4b9f-8e2d-1a2b3c4d5e6f")).toBe(true);
    expect(isUuid("3f2b8c1e-7d4a-4b9f-8e2d-1a2b3c4d5e6f' OR 1=1")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("html helpers", () => {
  it("escapes the five characters", () => {
    expect(esc(`<a href="x" title='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
  it("keeps only same-site paths as a login target", () => {
    expect(safeNext("/scorecard?x=1")).toBe("/scorecard?x=1");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});

describe("clock helpers", () => {
  it("renders UTC", () => {
    expect(iso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(utcDay(Date.parse("2026-10-01T23:59:59Z"))).toBe("2026-10-01");
  });
});

describe("notBuilt", () => {
  it("rejects every call with the lane and the member", async () => {
    const service = notBuilt<{ search(text: string): Promise<string[]> }>("search");
    await expect(service.search("x")).rejects.toBeInstanceOf(NotBuiltError);
    await expect(service.search("x")).rejects.toThrow('lane "search" is not built yet (called search)');
  });
  it("is not mistaken for a promise when awaited", async () => {
    const service = notBuilt<{ a(): Promise<void> }>("x");
    expect(await Promise.resolve(service)).toBe(service);
  });
});

describe("us states", () => {
  it("knows fifty states", () => {
    expect(Object.keys(STATE_NAME_BY_CODE)).toHaveLength(50);
  });
  it("reads a code or a name in any letter case", () => {
    expect(stateCode("il")).toBe("IL");
    expect(stateCode("Illinois")).toBe("IL");
    expect(stateCode(" new york ")).toBe("NY");
    expect(stateCode("Chicago")).toBeNull();
    expect(stateCode(undefined)).toBeNull();
    expect(stateName("ny")).toBe("New York");
    expect(stateName("ZZ")).toBeNull();
  });
});
