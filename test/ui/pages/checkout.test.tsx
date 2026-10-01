/**
 * Tests for the checkout hand-off page: the Groupon link, the price-changed notice, and the
 * unavailable, not-found and error branches.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/checkout.test.tsx
 * Deps:    bun:test, src/ui/pages/checkout.tsx
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { renderCheckout } from "../../../src/ui/pages/checkout";
import type { CheckoutResult } from "../../../src/contracts/ports";

const linkResult: CheckoutResult = {
  kind: "link",
  cartId: "cart-1",
  buyLink: "https://partner.groupon.com/checkout/cart-1?token=abc",
  currency: "USD",
  precision: 2,
  totalMinor: 4900,
  totalText: "$49.00",
  lines: [
    {
      productId: "prod-1",
      optionId: "opt-1",
      title: "Swedish Massage at Foot Smile Spa",
      quantity: 1,
      unitPayMinor: 4900,
      lineTotalMinor: 4900,
    },
  ],
  expiresAt: "2026-09-30T18:00:00Z",
};

describe("renderCheckout, kind link", () => {
  it("shows the ready-to-pay heading", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain("Ready to pay at Groupon");
  });

  it("shows the line title, quantity, unit price and line total", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain("Swedish Massage at Foot Smile Spa");
    expect(html).toContain("$49.00");
  });

  it("shows the total before tax as the result's totalText", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain("Total before tax");
    expect(html).toContain("$49.00");
  });

  it("has exactly one button whose href is the buyLink verbatim", async () => {
    const html = await renderCheckout({ result: linkResult });
    const matches = html.match(/href="https:\/\/partner\.groupon\.com[^"]*"/g) ?? [];
    expect(matches.length).toBe(1);
    expect(matches[0]).toBe(`href="${linkResult.buyLink}"`);
  });

  it("labels the button Pay at Groupon and marks it rel=noopener", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain("Pay at Groupon");
    expect(html).toContain('rel="noopener"');
  });

  it("notes the link expires and the cart is Groupon's, when expiresAt is present", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain("2026-09-30T18:00:00Z");
    expect(html.toLowerCase()).toContain("expire");
    expect(html).toContain("Groupon's");
  });

  it("still notes the cart is Groupon's when expiresAt is null", async () => {
    const html = await renderCheckout({ result: { ...linkResult, expiresAt: null } });
    expect(html).toContain("Groupon's");
  });

  it("links back to the deal by the first line's productId", async () => {
    const html = await renderCheckout({ result: linkResult });
    expect(html).toContain('href="/deals/prod-1"');
    expect(html).toContain("Back to the deal");
  });

  it("escapes a title that carries HTML", async () => {
    const html = await renderCheckout({
      result: { ...linkResult, lines: [{ ...linkResult.lines[0]!, title: '<script>alert(1)</script>' }] },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderCheckout, kind price_changed", () => {
  const result: CheckoutResult = {
    kind: "price_changed",
    productId: "prod-1",
    optionId: "opt-1",
    wasMinor: 4900,
    nowMinor: 5900,
    nowText: "$59.00",
  };

  it("shows the price-changed heading and the new price only", async () => {
    const html = await renderCheckout({ result });
    expect(html).toContain("The price changed");
    expect(html).toContain("It is now $59.00");
  });

  it("has a secondary button back to the deal and no Groupon link", async () => {
    const html = await renderCheckout({ result });
    expect(html).toContain('href="/deals/prod-1"');
    expect(html).toContain("See the deal again");
    expect(html).not.toContain("partner.groupon.com");
  });
});

describe("renderCheckout, kind unavailable", () => {
  it("shows the reason and links back to the home page", async () => {
    const html = await renderCheckout({ result: { kind: "unavailable", reason: "This option sold out." } });
    expect(html).toContain("Not available");
    expect(html).toContain("This option sold out.");
    expect(html).toContain('href="/"');
  });
});

describe("renderCheckout, kind not_found", () => {
  it("shows the deal-not-found message and links back to the home page", async () => {
    const html = await renderCheckout({ result: { kind: "not_found", productId: "prod-9", optionId: "opt-9" } });
    expect(html).toContain("Deal not found");
    expect(html).toContain('href="/"');
  });
});

describe("renderCheckout, kind error", () => {
  it("shows the error sentence and the code, and links back to the home page", async () => {
    const html = await renderCheckout({ result: { kind: "error", code: "INTERNAL_SERVER_ERROR", message: "boom" } });
    expect(html).toContain("Checkout is not possible right now");
    expect(html).toContain("INTERNAL_SERVER_ERROR");
    expect(html).toContain('href="/"');
  });
});
