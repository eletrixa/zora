/**
 * Tests for the second batch of blocks: option row, breadcrumb, two-column layout, voucher row,
 * histogram, share bar, check rows, finding card and pill.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/blocks-2.test.ts
 * Deps:    bun:test, src/ui/components/blocks.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import {
  breadcrumb,
  checkRows,
  findingCard,
  findingList,
  histogram,
  optionList,
  optionRow,
  pill,
  shareBar,
  twoColumn,
  voucherRow,
} from "../../../src/ui/components/blocks";

const sellableOption = {
  optionId: "o1",
  title: "60-Minute Swedish Massage",
  payText: "$49.00",
  listPriceMinor: 8000,
  payMinor: 4900,
  currency: "USD",
  precision: 2,
  promo: null as null | { priceMinor: number; priceText: string; code: string | null; endsAt: string | null; instruction: string },
  sellable: true,
  productId: "p1",
};

describe("optionRow", () => {
  it("renders a form posting to /checkout with the productId, optionId and quantity", () => {
    const html = optionRow(sellableOption);
    expect(html).toContain('method="post" action="/checkout"');
    expect(html).toContain('name="productId" value="p1"');
    expect(html).toContain('name="optionId" value="o1"');
    expect(html).toContain('name="quantity" value="1"');
    expect(html).toContain("Get checkout link");
  });

  it("shows Not available right now for a non-sellable option, with no form", () => {
    const html = optionRow({ ...sellableOption, sellable: false });
    expect(html).not.toContain("<form");
    expect(html).toContain("Not available right now");
  });

  it("shows the promo note only as the instruction sentence when a promo exists", () => {
    const html = optionRow({
      ...sellableOption,
      promo: { priceMinor: 3920, priceText: "$39.20", code: "SAVE20", endsAt: null, instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00." },
    });
    expect(html).toContain("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.");
    expect(html.replace("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.", "")).not.toContain("$39.20");
  });

  it("escapes the title", () => {
    expect(optionRow({ ...sellableOption, title: "<script>evil()</script>" })).not.toContain("<script>evil()</script>");
  });
});

describe("optionList", () => {
  it("wraps the given rows", () => {
    const html = optionList([optionRow(sellableOption)]);
    expect(html).toContain("Get checkout link");
  });
});

describe("breadcrumb", () => {
  it("links every item that has an href and leaves the rest as text", () => {
    const html = breadcrumb([{ label: "Find deals", href: "/" }, { label: "Swedish Massage" }]);
    expect(html).toContain('href="/"');
    expect(html).toContain("Find deals");
    expect(html).toContain("Swedish Massage");
  });

  it("escapes a label", () => {
    expect(breadcrumb([{ label: "<script>evil()</script>" }])).not.toContain("<script>evil()</script>");
  });

  it("marks the item without an href as the current one, so a long title can wrap", () => {
    const html = breadcrumb([{ label: "Find deals", href: "/" }, { label: "A very long deal title" }]);
    expect(html).toContain('<span class="breadcrumb-current">A very long deal title</span>');
  });
});

describe("twoColumn", () => {
  it("renders both panes", () => {
    const html = twoColumn("<p>main</p>", "<p>aside</p>");
    expect(html).toContain("<p>main</p>");
    expect(html).toContain("<p>aside</p>");
  });
});

describe("voucherRow", () => {
  const base = {
    title: "Swedish Massage at Foot Smile Spa",
    quantity: 2,
    status: "Confirmed",
    vouchers: [
      { status: "CONFIRMED", url: "https://www.groupon.com/mygroupons/1" },
      { status: "CANCELLED", url: "https://www.groupon.com/mygroupons/2" },
    ],
  };

  it("renders a view button for a confirmed voucher", () => {
    const html = voucherRow(base);
    expect(html).toContain("View voucher 1 on Groupon");
    expect(html).toContain('href="https://www.groupon.com/mygroupons/1"');
  });

  it("renders a badge instead of a button for a cancelled voucher", () => {
    const html = voucherRow(base);
    expect(html).not.toContain('href="https://www.groupon.com/mygroupons/2"');
    expect(html).toContain("CANCELLED");
  });

  it("escapes the title", () => {
    expect(voucherRow({ ...base, title: "<script>evil()</script>" })).not.toContain("<script>evil()</script>");
  });
});

describe("histogram", () => {
  it("renders a bar per row with the label and value", () => {
    const html = histogram([{ label: "0 to 5%", value: 18, share: 0.12 }]);
    expect(html).toContain("0 to 5%");
    expect(html).toContain("18");
  });

  it("escapes the label", () => {
    expect(histogram([{ label: "<script>evil()</script>", value: 1, share: 0.1 }])).not.toContain("<script>evil()</script>");
  });

  it("groups a count's thousands with commas, like every other count on the page", () => {
    expect(histogram([{ label: "0 to 5%", value: 95401, share: 0.6 }])).toContain('<span class="histogram-value">95,401</span>');
  });
});

describe("shareBar", () => {
  it("renders a legend entry per part", () => {
    const html = shareBar([
      { label: "Shows the price you pay", share: 0.71, tone: "pass" },
      { label: "Shows the promo price", share: 0.24, tone: "fail" },
    ]);
    expect(html).toContain("Shows the price you pay");
    expect(html).toContain("Shows the promo price");
  });

  it("escapes a label", () => {
    expect(shareBar([{ label: "<script>evil()</script>", share: 1, tone: "neutral" }])).not.toContain("<script>evil()</script>");
  });
});

describe("checkRows", () => {
  it("renders a badge per row matching its verdict", () => {
    const html = checkRows([
      { name: "Cart lifecycle", verdict: "pass", detail: "Create, add, change, read, remove, abandon" },
      { name: "Refusals", verdict: "fail", detail: "Expected FORBIDDEN, got an empty page" },
      { name: "Order read", verdict: "skip", detail: "No test order yet" },
    ]);
    expect(html).toContain("badge--pass");
    expect(html).toContain("badge--fail");
    expect(html).toContain("badge--neutral");
    expect(html).toContain("Cart lifecycle");
  });

  it("shows latency when given", () => {
    expect(checkRows([{ name: "List products", verdict: "pass", detail: "d", latencyMs: 412 }])).toContain("412");
  });

  it("draws a failing step's expected and observed halves as labelled lines in place of the detail", () => {
    const html = checkRows([{ name: "n", verdict: "fail", detail: "a; b", expected: "a <x>", observed: "b" }]);
    expect(html).toContain('<span class="finding-line-label">Expected: </span>a &lt;x&gt;');
    expect(html).toContain('<span class="finding-line-label">Observed: </span>b');
    expect(html).not.toContain("a; b");
  });

  it("escapes the detail", () => {
    expect(checkRows([{ name: "n", verdict: "pass", detail: "<script>evil()</script>" }])).not.toContain("<script>evil()</script>");
  });
});

describe("findingCard", () => {
  it("renders the severity, area, expected and observed lines", () => {
    const html = findingCard({ id: "f1", severity: "major", area: "Page size", expected: "The guide says 100.", observed: "Walk with 50.", status: "Open" });
    expect(html).toContain("Page size");
    expect(html).toContain("The guide says 100.");
    expect(html).toContain("Walk with 50.");
    expect(html).toContain("Open");
  });

  it("escapes the observed text", () => {
    expect(findingCard({ id: "f1", severity: "minor", area: "a", expected: "e", observed: "<script>evil()</script>", status: "" })).not.toContain("<script>evil()</script>");
  });
});

describe("findingList", () => {
  it("wraps the given cards", () => {
    const html = findingList([findingCard({ id: "f1", severity: "blocker", area: "a", expected: "e", observed: "o", status: "" })]);
    expect(html).toContain("a");
  });
});

describe("pill", () => {
  it("renders the given text", () => {
    expect(pill("run-42")).toContain("run-42");
  });

  it("escapes the text", () => {
    expect(pill("<script>evil()</script>")).not.toContain("<script>evil()</script>");
  });
});
