/**
 * Guards the pixel stylesheet: every rule scoped to [data-theme="pixel"], every lab token
 * redefined with its LANGUAGE.md pixel value, the marks swapped, square corners on cards,
 * sections, tiles, fields, buttons and the switch, Silkscreen on the nav and section titles,
 * Press Start 2P on the h1, IBM Plex Mono on the body, the hard shadow on cards and buttons,
 * the size budget, and no addition that could widen the page.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pixel/pixel-css.test.ts
 * Deps:    bun:test, node:fs
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(join(import.meta.dir, "../../../public/static/pixel.css"), "utf8");
/** Comments never style anything; strip them before any scope, colour or selector check. */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every top-level rule's selector list, so each one can be checked for the theme scope. */
function selectorLists(source: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let selector = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") {
      if (depth === 0 && selector.trim()) out.push(selector.trim());
      depth++;
      selector = "";
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      selector += ch;
    }
  }
  return out;
}

/** Walks into every media block too, so a rule hidden inside one is still checked. */
function allSelectorLists(source: string): string[] {
  const top = selectorLists(source);
  const mediaSelectors = top.filter((s) => s.startsWith("@media"));
  const rest = top.filter((s) => !s.startsWith("@media"));
  const inner: string[] = [];
  for (const m of source.matchAll(/@media[^{]*\{/g)) {
    const start = m.index! + m[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < source.length) {
      if (source[end] === "{") depth++;
      else if (source[end] === "}") depth--;
      end++;
    }
    inner.push(...selectorLists(source.slice(start, end - 1)));
  }
  return [...rest.filter((s) => !mediaSelectors.includes(s)), ...inner];
}

/** The rule body that starts with exactly this selector list. */
const rule = (selector: string, source = css): string => {
  const at = source.indexOf(`${selector}{`);
  return at === -1 ? "" : source.slice(at, source.indexOf("}", at) + 1);
};

describe("pixel.css scope", () => {
  it("scopes every single rule, including inside media blocks, to [data-theme=\"pixel\"]", () => {
    const selectors = allSelectorLists(css);
    expect(selectors.length).toBeGreaterThan(20);
    const unscoped = selectors.filter((s) => !s.includes('[data-theme="pixel"]'));
    expect(unscoped).toEqual([]);
  });
});

describe("pixel.css tokens", () => {
  it("redefines every token the lab stylesheet declares on :root, with the pixel values named in LANGUAGE.md", () => {
    const lab = readFileSync(join(import.meta.dir, "../../../public/static/app.css"), "utf8");
    const labRoot = lab.slice(lab.indexOf(":root{"), lab.indexOf("}") + 1);
    const labTokens = [...labRoot.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
    expect(labTokens.length).toBeGreaterThan(30);
    const pixelRoot = rule(':root[data-theme="pixel"]');
    for (const token of labTokens) {
      expect(pixelRoot).toContain(`${token}:`);
    }
  });

  it("retints ground, panels, lines and ink dark, amber as the accent, mint for pass, lavender as the second accent, and the fail red", () => {
    const pixelRoot = rule(':root[data-theme="pixel"]');
    expect(pixelRoot).toContain("--ground:#14151C");
    expect(pixelRoot).toContain("--surface:#1B1D26");
    expect(pixelRoot).toContain("--bar:#0F1016");
    expect(pixelRoot).toContain("--line:#3A3D4D");
    expect(pixelRoot).toContain("--row-line:#2E3140");
    expect(pixelRoot).toContain("--ink:#E8E4D8");
    expect(pixelRoot).toContain("--muted:#A8A5B8");
    expect(pixelRoot).toContain("--accent:#F2B33D");
    expect(pixelRoot).toContain("--pass:#7FE0A6");
    expect(pixelRoot).toContain("--eyebrow:#B9A6F2");
    expect(pixelRoot).toContain("--fail-ink:#FF7A6B");
  });

  it("swaps the fonts: Silkscreen for the head role, IBM Plex Mono for body and figures", () => {
    const pixelRoot = rule(':root[data-theme="pixel"]');
    expect(pixelRoot).toContain("--font-head:'Silkscreen'");
    expect(pixelRoot).toContain("--font-body:'IBM Plex Mono'");
    expect(pixelRoot).toContain("--font-mono:'IBM Plex Mono'");
  });

  it("draws the picker select's chevron as a stepped pixel arrow, not the lab's smooth one", () => {
    const pixelRoot = rule(':root[data-theme="pixel"]');
    expect(pixelRoot).toContain("--chevron:url(");
    expect(pixelRoot).toContain("shape-rendering='crispEdges'");
  });

  it("draws the home page skyline as a pixel building silhouette, not a repeating stripe", () => {
    const pixelRoot = rule(':root[data-theme="pixel"]');
    expect(pixelRoot).toContain("--skyline:url(");
    expect(pixelRoot).toContain("shape-rendering='crispEdges'");
  });
});

describe("pixel.css header: the skyline is the home page's own mark", () => {
  it("gives every page the quiet 24 px band with the 2 px line rule, flush under the header, full width", () => {
    const quiet = rule('[data-theme="pixel"] .shell-header::after');
    expect(quiet).toContain("height:24px");
    expect(quiet).toMatch(/border-bottom:2px solid var\(--line\)/);
    expect(quiet).toContain("flex-shrink:0");
    expect(quiet).toContain("background:var(--bar)");
    expect(quiet).not.toContain("--accent");
  });

  it("swaps in the 56 px skyline, with its 4 px accent rule, only when the current nav link is home", () => {
    const skyline = rule('[data-theme="pixel"] .shell-header:has(.shell-nav a[href="/"][aria-current="page"])::after');
    expect(skyline).toContain("height:56px");
    expect(skyline).toMatch(/border-bottom:4px solid var\(--accent\)/);
    expect(skyline).toContain("var(--skyline)");
  });

  it("keeps the band in flow (not an overlay) so it never widens the page at 390 px", () => {
    expect(css).not.toMatch(/\.shell-header::after\{[^}]*position:absolute/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.shell-header::after\{[^}]*margin:0 -56px/);
    expect(css).toMatch(/@media \(max-width:480px\)\{[^]*\[data-theme="pixel"\] \.shell-header::after\{flex-basis:100%;margin:0\}/);
  });

  it("widens the band's flex-basis by the 56 px gutter on each side, so it reaches the padded edge", () => {
    const quiet = rule('[data-theme="pixel"] .shell-header::after');
    expect(quiet).toContain("flex-basis:calc(100% + 112px)");
  });

  it("drops the header's own bottom border, so the strip's rule is the only line under it", () => {
    const header = rule('[data-theme="pixel"] .shell-header');
    expect(header).not.toMatch(/border-bottom:\d/);
  });
});

describe("pixel.css the lockup and the switch", () => {
  it("hides the lab mark and shows the pixel mark", () => {
    expect(css).toMatch(/\[data-theme="pixel"\] \.mark--lab\{[^}]*display:none/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.mark--pixel\{[^}]*display:(?!none)/);
  });

  it("fills the current segment amber and squares the switch track and pills", () => {
    expect(css).toMatch(/\[data-theme="pixel"\] \.theme-switch::before\{[^}]*border-radius:0/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.theme-switch button\[value="pixel"\]::after\{[^}]*background:var\(--action\)/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.theme-switch button\[value="lab"\]::after\{[^}]*background:transparent/);
  });

  it("draws the wordmark in Silkscreen, uppercase, with Zora in amber", () => {
    expect(css).toMatch(/\[data-theme="pixel"\] \.shell-brand-name\{[^}]*font-family:var\(--font-head\)/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.shell-brand-name\{[^}]*text-transform:uppercase/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.shell-wordmark-zora\{[^}]*color:var\(--accent\)/);
  });

  it("sets the switch labels in Silkscreen capitals, not the body font", () => {
    const button = rule('[data-theme="pixel"] .theme-switch button');
    expect(button).toContain("font-family:var(--font-head)");
    expect(button).toContain("text-transform:uppercase");
  });

  it("confines the divider between the segments inside the 32 px track, not the 44 px hit box", () => {
    expect(rule('[data-theme="pixel"] .theme-switch button[value="pixel"]')).not.toContain("border-left");
    expect(rule('[data-theme="pixel"] .theme-switch button[value="pixel"]::after')).toMatch(/border-left:2px solid var\(--line\)/);
  });
});

describe("pixel.css shape: square corners, 2 px borders, the hard shadow", () => {
  it("squares every card, section, tile, field, button and the switch", () => {
    expect(rule('[data-theme="pixel"] .card,[data-theme="pixel"] .podium-card')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .box')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .picker-card')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .tile')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .field input,[data-theme="pixel"] .field select')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .sentence-select,[data-theme="pixel"] .sentence-input')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .btn')).toContain("border-radius:0");
    expect(rule('[data-theme="pixel"] .theme-switch::before')).toContain("border-radius:0");
  });

  it("draws the hard shadow on cards and buttons", () => {
    expect(rule('[data-theme="pixel"] .card,[data-theme="pixel"] .podium-card')).toContain("box-shadow:4px 4px 0 #000");
    expect(rule('[data-theme="pixel"] .btn')).toMatch(/box-shadow:4px 4px 0 var\(--accent-shadow\)/);
  });

  it("squares the verdict banner too, on Price truth and on the Scorecard alike", () => {
    expect(rule('[data-theme="pixel"] .verdict')).toContain("border-radius:0");
  });

  it("keeps the lead tile's top rule amber, not the grey every tile border takes", () => {
    expect(rule('[data-theme="pixel"] .tile--lead')).toMatch(/border-top:4px solid var\(--accent\)/);
  });

  it("widens card, box, tile and field borders to 2 px", () => {
    expect(rule('[data-theme="pixel"] .card,[data-theme="pixel"] .podium-card')).toMatch(/border(-width)?:2px/);
    expect(rule('[data-theme="pixel"] .box')).toMatch(/border(-width)?:2px/);
    expect(rule('[data-theme="pixel"] .tile')).toMatch(/border(-width)?:2px/);
  });

  it("dots the row rules at 2 px and keeps a plain head rule solid at 2 px", () => {
    expect(rule('[data-theme="pixel"] .rank-row,[data-theme="pixel"] .option-row,[data-theme="pixel"] .labelled-list>div,[data-theme="pixel"] .check-row,[data-theme="pixel"] .table td')).toMatch(/border-bottom:2px dotted var\(--row-line\)/);
    expect(rule('[data-theme="pixel"] .rank-head,[data-theme="pixel"] .table th')).toMatch(/border-bottom:2px solid var\(--line\)/);
  });

  it("sets shape-rendering:crispEdges and image-rendering:pixelated for the pixel-only chrome", () => {
    expect(css).toMatch(/\[data-theme="pixel"\] svg\.glyph\{[^}]*shape-rendering:crispEdges/);
    expect(css).toMatch(/\[data-theme="pixel"\] \.card-image,\[data-theme="pixel"\] \.podium-photo\{[^}]*image-rendering:pixelated/);
  });

  it("segments the saving bar and squares the day strip", () => {
    expect(rule('[data-theme="pixel"] .saving-fill')).toMatch(/repeating-linear-gradient\(90deg,var\(--accent\) 0 6px,transparent 6px 8px\)/);
    expect(rule('[data-theme="pixel"] .day')).toContain("border-radius:0");
  });
});

describe("pixel.css type", () => {
  it("sets Silkscreen for the nav and section titles", () => {
    expect(rule('[data-theme="pixel"] .shell-nav a')).toContain("font-family:var(--font-head)");
    expect(rule('[data-theme="pixel"] .section-title--rule,[data-theme="pixel"] .section-title')).toContain("font-family:var(--font-head)");
  });

  it("sets the eyebrow in Silkscreen capitals, not the figure's Plex Mono", () => {
    const eyebrow = rule('[data-theme="pixel"] .eyebrow');
    expect(eyebrow).toContain("font-family:var(--font-head)");
    expect(eyebrow).toContain("text-transform:uppercase");
  });

  it("sets Press Start 2P for the h1, with the accent colour and a black text shadow", () => {
    const h1 = rule('[data-theme="pixel"] h1');
    expect(h1).toContain("Press Start 2P");
    expect(h1).toContain("color:var(--accent)");
    expect(h1).toContain("text-shadow:4px 4px 0 #000");
  });

  it("sets IBM Plex Mono for the lead and the figures (tile value, price to pay, figure value)", () => {
    expect(rule('[data-theme="pixel"] .lead')).toContain("font-family:var(--font-mono)");
    expect(rule('[data-theme="pixel"] .tile-value,[data-theme="pixel"] .tiles--panel .tile-value')).toContain("font-family:var(--font-mono)");
    expect(rule('[data-theme="pixel"] .price-pay,[data-theme="pixel"] .podium-pay')).toContain("font-family:var(--font-mono)");
    expect(rule('[data-theme="pixel"] .figure-value')).toContain("font-family:var(--font-mono)");
  });

  it("spends the one display figure on the h1 and the deal page's big price, not on a saving", () => {
    expect(rule('[data-theme="pixel"] .price--large .price-pay')).toContain("Press Start 2P");
    expect(css).not.toMatch(/save-pill[^{]*\{[^}]*Press Start 2P/);
  });
});

describe("pixel.css budget and safety", () => {
  it("stays under 20 KB", () => {
    expect(Buffer.byteLength(css, "utf8")).toBeLessThan(20 * 1024);
  });

  it("adds no fixed width wider than the 390 px phone board and no nowrap on wrapping text", () => {
    const widths = [...css.matchAll(/(?<!min-|max-)width:(\d+)px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w).toBeLessThan(390);
    expect(css).not.toMatch(/white-space:nowrap/);
  });

  it("never sets a colour outside the :root token block, so every colour stays a token", () => {
    const pixelRootBlock = rule(':root[data-theme="pixel"]');
    const outsideRoot = css.replace(pixelRootBlock, "");
    expect(outsideRoot).not.toMatch(/#[0-9A-Fa-f]{6}\b(?!'|"|\))/);
  });
});
