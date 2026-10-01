/**
 * The POST /checkout body reader: size cap, JSON validity, item and quantity bounds.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/agent/api/checkout-body.test.ts
 * Deps:    bun:test, src/agent/api/checkout-body.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { parseCheckoutBody } from "../../../src/agent/api/checkout-body";

const request = (body: string): Request => new Request("https://zorasocial.asajj.cz/api/v1/checkout", { method: "POST", body });

describe("parseCheckoutBody", () => {
  it("accepts one valid item", async () => {
    const result = await parseCheckoutBody(request(JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 2 }] })));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items).toEqual([{ productId: "p1", optionId: "o1", quantity: 2 }]);
  });

  it("accepts up to 20 items and refuses 21", async () => {
    const line = (i: number) => ({ productId: `p${i}`, optionId: "o1", quantity: 1 });
    const ok = await parseCheckoutBody(request(JSON.stringify({ items: Array.from({ length: 20 }, (_, i) => line(i)) })));
    expect(ok.ok).toBe(true);

    const tooMany = await parseCheckoutBody(request(JSON.stringify({ items: Array.from({ length: 21 }, (_, i) => line(i)) })));
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.error.code).toBe("invalid_items");
  });

  it("refuses an empty items array", async () => {
    const result = await parseCheckoutBody(request(JSON.stringify({ items: [] })));
    expect(result.ok).toBe(false);
  });

  it("refuses quantity outside 1..100", async () => {
    const zero = await parseCheckoutBody(request(JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 0 }] })));
    expect(zero.ok).toBe(false);

    const overHundred = await parseCheckoutBody(request(JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 101 }] })));
    expect(overHundred.ok).toBe(false);

    const fractional = await parseCheckoutBody(request(JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 1.5 }] })));
    expect(fractional.ok).toBe(false);
  });

  it("refuses a missing or empty productId or optionId", async () => {
    const missing = await parseCheckoutBody(request(JSON.stringify({ items: [{ optionId: "o1", quantity: 1 }] })));
    expect(missing.ok).toBe(false);

    const empty = await parseCheckoutBody(request(JSON.stringify({ items: [{ productId: "", optionId: "o1", quantity: 1 }] })));
    expect(empty.ok).toBe(false);
  });

  it("refuses a productId longer than 200 characters", async () => {
    const result = await parseCheckoutBody(
      request(JSON.stringify({ items: [{ productId: "a".repeat(201), optionId: "o1", quantity: 1 }] })),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses malformed JSON with bad_json", async () => {
    const result = await parseCheckoutBody(request("{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_json");
  });

  it("refuses a body over 16 KB with bad_json", async () => {
    const huge = JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 1, filler: "x".repeat(20_000) }] });
    const result = await parseCheckoutBody(request(huge));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_json");
  });

  it("ignores unknown fields on an item", async () => {
    const result = await parseCheckoutBody(
      request(JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 1, extra: "ignored" }] })),
    );
    expect(result.ok).toBe(true);
  });
});
