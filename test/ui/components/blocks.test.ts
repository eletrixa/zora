/**
 * Tests for the section, stat tiles, data table, empty state, badge, button and form field.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/blocks.test.ts
 * Deps:    bun:test, src/ui/components/blocks.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { badge, button, dataTable, emptyState, formField, section, statTiles } from "../../../src/ui/components/blocks";

describe("section", () => {
  it("renders a heading and body", () => {
    const html = section({ title: "Price history", body: "<p>x</p>" });
    expect(html).toContain("Price history");
    expect(html).toContain("<p>x</p>");
  });

  it("renders the lead sentence when given", () => {
    expect(section({ title: "T", lead: "A lead sentence.", body: "" })).toContain("A lead sentence.");
  });

  it("escapes the title and lead", () => {
    const html = section({ title: "<i>x</i>", lead: "<i>y</i>", body: "" });
    expect(html).not.toContain("<i>x</i>");
    expect(html).not.toContain("<i>y</i>");
  });
});

describe("statTiles", () => {
  it("renders one tile per entry with label and value", () => {
    const html = statTiles([{ label: "Pass rate", value: "94%", hint: "72 of 77" }]);
    expect(html).toContain("Pass rate");
    expect(html).toContain("94%");
    expect(html).toContain("72 of 77");
  });

  it("escapes a script tag in a tile value", () => {
    const html = statTiles([{ label: "L", value: "<script>evil()</script>" }]);
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("dataTable", () => {
  it("renders the head and rows", () => {
    const html = dataTable(["Day", "Count"], [["2026-10-05", "20"]]);
    expect(html).toContain("Day");
    expect(html).toContain("2026-10-05");
    expect(html).toContain("20");
  });

  it("renders nothing for no rows", () => {
    expect(dataTable(["Day"], [])).toBe("");
  });

  it("right-aligns numeric columns in mono", () => {
    const html = dataTable(["Day", "Count"], [["2026-10-05", "20"]], { numeric: [1] });
    expect(html).toContain('class="num"');
  });

  it("escapes a script tag in a cell", () => {
    const html = dataTable(["Day"], [["<script>evil()</script>"]]);
    expect(html).not.toContain("<script>evil()</script>");
  });

  it("wraps the table so it scrolls instead of overflowing the page at phone width", () => {
    const html = dataTable(["Day"], [["2026-10-05"]]);
    expect(html).toContain('<div class="table-wrap">');
    expect(html).toContain("</div>");
  });
});

describe("emptyState", () => {
  it("renders the given sentence", () => {
    expect(emptyState("No snapshot yet. It runs at 04:30 UTC.")).toContain("No snapshot yet. It runs at 04:30 UTC.");
  });

  it("escapes the sentence", () => {
    expect(emptyState("<script>evil()</script>")).not.toContain("<script>evil()</script>");
  });
});

describe("badge", () => {
  it("renders the text and the tone class", () => {
    const html = badge("Pass", "pass");
    expect(html).toContain("Pass");
    expect(html).toContain("badge--pass");
  });

  it("escapes the text", () => {
    expect(badge("<script>evil()</script>", "fail")).not.toContain("<script>evil()</script>");
  });
});

describe("button", () => {
  it("renders an anchor when href is given", () => {
    const html = button({ label: "Search", href: "/" });
    expect(html).toContain("<a ");
    expect(html).toContain('href="/"');
    expect(html).toContain("Search");
  });

  it("renders a button element when href is not given", () => {
    const html = button({ label: "Open" });
    expect(html).toContain("<button");
    expect(html).toContain("Open");
  });

  it("uses the secondary tone class when asked", () => {
    expect(button({ label: "Back", href: "/x", tone: "secondary" })).toContain("btn--secondary");
  });

  it("escapes the label", () => {
    expect(button({ label: "<script>evil()</script>" })).not.toContain("<script>evil()</script>");
  });

  it("emits rel on the anchor when given", () => {
    const html = button({ label: "Buy now at Groupon", href: "https://www.groupon.com/x", rel: "noopener" });
    expect(html).toContain('rel="noopener"');
  });

  it("omits rel when not given", () => {
    expect(button({ label: "Search", href: "/" })).not.toContain("rel=");
  });

  it("escapes rel", () => {
    expect(button({ label: "x", href: "/", rel: '"><script>evil()</script>' })).not.toContain("<script>evil()</script>");
  });
});

describe("formField", () => {
  it("renders the label, name and value", () => {
    const html = formField({ label: "City", name: "city", value: "Chicago" });
    expect(html).toContain("City");
    expect(html).toContain('name="city"');
    expect(html).toContain('value="Chicago"');
  });

  it("always adds the password-manager-off attributes", () => {
    const html = formField({ label: "PIN", name: "pin" });
    expect(html).toContain('autocomplete="off"');
    expect(html).toContain("data-1p-ignore");
    expect(html).toContain('data-lpignore="true"');
    expect(html).toContain('data-bwignore="true"');
    expect(html).toContain('data-form-type="other"');
  });

  it("never emits a password field, even when asked for one", () => {
    // "password" is not a value the type accepts; a caller forcing it through still gets text.
    const html = formField({ label: "PIN", name: "pin", type: "password" as never });
    expect(html).not.toContain('type="password"');
  });

  it("escapes the value", () => {
    const html = formField({ label: "L", name: "n", value: "<script>evil()</script>" });
    expect(html).not.toContain("<script>evil()</script>");
  });
});
