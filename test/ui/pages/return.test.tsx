/**
 * The designed return page: the waiting screen, the settled "Thank you" screen, the missing-order
 * screen and the read-failure screen.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/return.test.tsx
 * Deps:    bun:test, src/ui/pages/return.tsx
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { renderReturn } from "../../../src/ui/pages/return";

const UUID = "3f2b8c1e-7d4a-4b9f-8e2d-1a2b3c4d5e6f";

describe("renderReturn", () => {
  it("tells the shopper their order link is missing, with the confirmation email fallback", () => {
    const html = renderReturn({ uuid: null, order: null });
    expect(html).toContain("We could not read your order");
    expect(html).toContain("Groupon confirmation email");
    expect(html).toContain("has your voucher");
    expect(html).not.toContain('class="shell-nav"');
  });

  it("shows the waiting page with the polling script and the order id, no nav", () => {
    const html = renderReturn({ uuid: UUID, order: null });
    expect(html).toContain("Thank you");
    expect(html).toContain("Groupon is confirming your order.");
    expect(html).toContain(`<p id="order" data-uuid="${UUID}">`);
    expect(html).toContain('<script src="/static/return.js" defer>');
    expect(html).not.toContain('class="shell-nav"');
  });

  it("shows the waiting page while the order is pending", () => {
    const html = renderReturn({ uuid: UUID, order: { kind: "order", uuid: UUID, status: "PENDING", pending: true, lines: [] } });
    expect(html).toContain("Groupon is confirming your order.");
    expect(html).toContain(`<p id="order" data-uuid="${UUID}">`);
    expect(html).toContain('<script src="/static/return.js" defer>');
  });

  it("shows one voucher row per line once the order settles, with a badge and no link for a cancelled voucher", () => {
    const html = renderReturn({
      uuid: UUID,
      order: {
        kind: "order",
        uuid: UUID,
        status: "CONFIRMED",
        pending: false,
        lines: [
          {
            productId: "p-massage-chi",
            optionId: "o-massage-chi-60",
            title: "Swedish Massage",
            quantity: 2,
            status: "CONFIRMED",
            vouchers: [
              { status: "CONFIRMED", url: "https://www.groupon.com/mygroupons/1" },
              { status: "CANCELLED", url: "https://www.groupon.com/mygroupons/2" },
            ],
          },
        ],
      },
    });
    expect(html).toContain("Thank you");
    expect(html).toContain("Swedish Massage");
    expect(html).toContain("https://www.groupon.com/mygroupons/1");
    expect(html).not.toContain("https://www.groupon.com/mygroupons/2");
    expect(html).toContain("CANCELLED");
    expect(html).not.toContain('<script src="/static/return.js"');
  });

  it("falls back to the option id when a line has no title", () => {
    const html = renderReturn({
      uuid: UUID,
      order: {
        kind: "order",
        uuid: UUID,
        status: "CONFIRMED",
        pending: false,
        lines: [{ productId: null, optionId: "o-massage-chi-60", title: null, quantity: 1, status: "CONFIRMED", vouchers: [] }],
      },
    });
    expect(html).toContain("o-massage-chi-60");
  });

  it("tells the shopper the order cannot be shown right now, not_found after settling", () => {
    const html = renderReturn({ uuid: UUID, order: { kind: "not_found" } });
    expect(html).toContain("We cannot show this order right now.");
    expect(html).toContain("Groupon confirmation email");
    expect(html).toContain(UUID);
  });

  it("tells the shopper the order cannot be shown right now, upstream error", () => {
    const html = renderReturn({ uuid: UUID, order: { kind: "error", code: "INTERNAL_SERVER_ERROR", message: "down" } });
    expect(html).toContain("We cannot show this order right now.");
    expect(html).toContain(UUID);
  });

  it("escapes an order id that reaches the page", () => {
    const html = renderReturn({ uuid: "<script>alert(1)</script>", order: null });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
