/**
 * Tests for the page shell: the full HTML document, the lockup with the look switch, nav and footer.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/shell.test.ts
 * Deps:    bun:test, src/ui/components/shell.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { publicShell, shell } from "../../../src/ui/components/shell";

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("shell", () => {
  it("renders a full HTML document with the title, fonts and stylesheet", () => {
    const html = shell({ title: "Find a deal", active: "finder", body: "<p>hi</p>" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Find a deal · Zora Agent Lab</title>");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain('<link rel="stylesheet" href="/static/app.css">');
    expect(html).toContain("<p>hi</p>");
  });

  it("marks the active nav link with aria-current", () => {
    const html = shell({ title: "Price truth", active: "price-truth", body: "" });
    expect(html).toMatch(/<a href="\/price-truth"[^>]*aria-current="page"[^>]*>Price truth<\/a>/);
    expect(html).not.toMatch(/<a href="\/find"[^>]*aria-current="page"/);
  });

  it("marks no nav link active when active is null", () => {
    const html = shell({ title: "Deal", active: null, body: "" });
    expect(html).not.toContain('aria-current="page"');
  });

  it("lists Top deals first at / and Find a deal second at /find, and marks Top deals current on the home page", () => {
    const html = shell({ title: "Top deals", active: "top-deals", body: "" });
    expect(html).toMatch(/<a href="\/"[^>]*aria-current="page"[^>]*>Top deals<\/a><a href="\/find"[^>]*>Find a deal<\/a>/);
    expect(html).not.toMatch(/<a href="\/price-truth"[^>]*aria-current="page"/);
  });

  it("inserts the caller's head string verbatim before the stylesheet closes the head", () => {
    const html = shell({ title: "T", active: null, body: "", head: "<meta name=\"extra\" content=\"1\">" });
    expect(html).toContain('<meta name="extra" content="1">');
  });

  it("escapes the title", () => {
    const html = shell({ title: "<script>alert(1)</script>", active: null, body: "" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("names the price a shopper pays as retail, in the footer", () => {
    const html = shell({ title: "T", active: null, body: "" });
    expect(html).toContain("The price a shopper pays is the retail price.");
  });
});

describe("shell lockup and look switch", () => {
  it("holds both marks inside the brand link to the home page", () => {
    const html = shell({ title: "T", active: "finder", body: "" });
    expect(html).toMatch(/<div class="shell-lockup"><a class="shell-brand" href="\/"><svg class="mark mark--lab"[^>]*>[\s\S]*?<\/svg><svg class="mark mark--pixel"[^>]*>[\s\S]*?<\/svg><span class="shell-brand-name"><span class="shell-wordmark-zora">Zora<\/span> Agent Lab<\/span><\/a>/);
  });

  it("draws the pixel mark snapped to the grid with the board's fills", () => {
    const html = shell({ title: "T", active: null, body: "" });
    const pixel = /<svg class="mark mark--pixel"[^>]*>[\s\S]*?<\/svg>/.exec(html)?.[0] ?? "";
    expect(pixel).toContain('viewBox="0 0 16 16"');
    expect(pixel).toContain('shape-rendering="crispEdges"');
    expect(pixel).toContain('<rect x="7" y="0" width="2" height="6" fill="#F2B33D"></rect>');
    expect(pixel).toContain('<rect x="2" y="9" width="12" height="3" fill="#B9A6F2"></rect>');
  });

  it("posts the switch to /theme with a Lab and a Pixel button, Lab pressed by default", () => {
    const html = shell({ title: "T", active: "finder", body: "" });
    expect(html).toContain('<form class="theme-switch" method="post" action="/theme" aria-label="Look">');
    expect(html).toContain('<button type="submit" name="theme" value="lab" aria-pressed="true">Lab</button>');
    expect(html).toContain('<button type="submit" name="theme" value="pixel" aria-pressed="false">Pixel</button>');
  });

  it("returns the switch to the active page's address", () => {
    const next = (active: Parameters<typeof shell>[0]["active"]): string | undefined =>
      /<input type="hidden" name="next" value="([^"]*)">/.exec(shell({ title: "T", active, body: "" }))?.[1];
    expect(next("finder")).toBe("/find");
    expect(next("top-deals")).toBe("/");
    expect(next("price-truth")).toBe("/price-truth");
    expect(next("scorecard")).toBe("/scorecard");
    expect(next(null)).toBe("/");
  });

  it("closes the lockup before the nav, both inside the header", () => {
    const html = shell({ title: "T", active: "finder", body: "" });
    expect(html).toMatch(/<\/form><\/div><nav class="shell-nav" aria-label="Main">[\s\S]*?<\/nav><\/header>/);
  });

  it("runs the switch script once, right after the header, and stores the look in zal_theme", () => {
    const html = shell({ title: "T", active: "finder", body: "" });
    expect(count(html, "<script>")).toBe(1);
    expect(html).toMatch(/<\/header><script>\(function\(\)\{[\s\S]*?\}\)\(\);<\/script><main/);
    expect(html).toContain('document.cookie="zal_theme="+t+"; Path=/; Max-Age=31536000; SameSite=Lax"');
  });

  it("leaves data-theme out of the document, so only the server marks the chosen look", () => {
    expect(shell({ title: "T", active: "finder", body: "" })).not.toContain("data-theme");
    expect(publicShell({ title: "T", body: "" })).not.toContain("data-theme");
  });

  it("loads Silkscreen and Press Start 2P in the one fonts link", () => {
    const html = shell({ title: "T", active: null, body: "" });
    expect(count(html, "fonts.googleapis.com")).toBe(1);
    expect(html).toContain("family=Silkscreen:wght@400;700");
    expect(html).toContain("family=Press+Start+2P");
  });

  it("links the pixel stylesheet right after the lab one", () => {
    const html = shell({ title: "T", active: null, body: "" });
    expect(html).toContain('<link rel="stylesheet" href="/static/app.css"><link rel="stylesheet" href="/static/pixel.css">');
  });
});

describe("publicShell", () => {
  it("renders the document without the nav", () => {
    const html = publicShell({ title: "Private", body: "<form></form>" });
    expect(html).not.toContain("<nav");
    expect(html).toContain("<form></form>");
    expect(html).toContain("Zora Agent Lab");
  });

  it("carries the same lockup, switch and script, returning home", () => {
    const html = publicShell({ title: "Private", body: "" });
    expect(html).toContain('class="mark mark--pixel"');
    expect(html).toContain('<input type="hidden" name="next" value="/">');
    expect(html).toMatch(/<\/form><\/div><\/header><script>/);
    expect(count(html, "<script>")).toBe(1);
  });

  it("escapes the title", () => {
    const html = publicShell({ title: "<b>x</b>", body: "" });
    expect(html).not.toContain("<b>x</b>");
  });
});
