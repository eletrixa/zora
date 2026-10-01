/**
 * Guards the lab stylesheet: the table overflow chain (a flex or grid item defaults to
 * min-width:auto, so every level that can hold a wide table must be allowed to shrink), the Top
 * deals pickers, podium and ranked rows, and the loop 5 rules: tokens for every colour, the lockup
 * with both marks and the look switch, the picker card, tiles and rank list at phone width, every
 * class kept from before, and the size budget.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/app-css.test.ts
 * Deps:    bun:test, node:fs
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "../../../public/static/app.css"), "utf8");
const phone = css.slice(css.indexOf("@media (max-width:480px){"));
/** The rule that starts a line with exactly this selector list. */
const rule = (selector: string, source = css): string => {
  const at = source.indexOf(`\n${selector}{`);
  return at === -1 ? "" : source.slice(at + 1, source.indexOf("}", at) + 1);
};

describe("app.css table overflow guards", () => {
  it("lets every direct child of the main shell shrink below its content width", () => {
    expect(css).toContain(".shell-main > *{min-width:0}");
  });

  it("lets a section shrink so its table-wrap can scroll instead of widening the page", () => {
    expect(css).toMatch(/\.section\{[^}]*min-width:0/);
    expect(css).toMatch(/\.page-section\{[^}]*min-width:0/);
    expect(css).toMatch(/\.box\{[^}]*min-width:0/);
  });

  it("lets the two-column deal layout's panes shrink", () => {
    expect(css).toMatch(/\.two-column-main,\.two-column-aside\{[^}]*min-width:0/);
  });

  it("makes table-wrap itself the element that scrolls, at the full width of its container", () => {
    expect(css).toMatch(/\.table-wrap\{[^}]*overflow-x:auto/);
    expect(css).toMatch(/\.table-wrap\{[^}]*width:100%/);
    expect(css).toMatch(/\.table-wrap\{[^}]*min-width:0/);
  });

  it("keeps the breadcrumb's current item wrapping, unlike its links", () => {
    expect(css).toMatch(/\.breadcrumb a,\.breadcrumb-sep\{[^}]*white-space:nowrap/);
    expect(css).toContain(".breadcrumb-current{");
    expect(css).not.toMatch(/\.breadcrumb-current\{[^}]*white-space:nowrap/);
  });
});

describe("app.css budget and tokens", () => {
  it("stays under 32 KB, raised from 30 KB for round 3's save pill runs, rank row rewrite and the column chart", () => {
    expect(Buffer.byteLength(css, "utf8")).toBeLessThan(32 * 1024);
  });

  it("draws every colour through a token on :root, so the pixel stylesheet can retint by redefining them", () => {
    const root = rule(":root");
    for (const token of ["--ground", "--surface", "--panel", "--bar", "--field", "--track", "--line", "--row-line", "--field-line", "--ink", "--muted", "--action", "--on-action", "--accent", "--figure", "--eyebrow", "--save", "--save-tint", "--save-line", "--promo", "--promo-tint", "--promo-line", "--pass", "--pass-tint", "--pass-line", "--fail", "--fail-ink", "--fail-tint", "--fail-line", "--fail-hatch", "--neutral", "--monogram", "--panel-stripe"]) {
      expect(root).toContain(`${token}:`);
    }
    const outsideRoot = css.replace(root, "");
    expect(outsideRoot).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
    expect(outsideRoot).not.toMatch(/rgba?\(/);
  });

  it("keeps every class it styled before loop 5, because pages not rebuilt this round still use them", () => {
    const kept = [
      "badge", "badge--fail", "badge--neutral", "badge--pass", "badge--warn", "breadcrumb", "breadcrumb-current", "breadcrumb-sep", "btn", "btn--secondary",
      "card", "card-body", "card-image", "card-location", "card-option", "card-title", "check-row", "check-row-badge", "check-row-detail", "check-row-name", "check-rows",
      "city", "empty", "eyebrow", "field", "field-label", "field--medium", "field--narrow", "field--wide", "finding-area", "finding-body", "finding-card", "finding-head",
      "finding-line", "finding-line-label", "finding-list", "finding-status", "form-row", "freshness", "grid", "histogram", "histogram-bar",
      "histogram-label", "histogram-row", "histogram-track", "histogram-value", "lead", "num", "option-list", "option-row", "option-row-form", "option-row-list",
      "option-row-pay", "option-row-prices", "option-row-title", "option-row-top", "option-row-unavailable", "page-foot", "pay", "picker-card", "picker-note",
      "picker-sentence", "pill", "pill-row", "pin", "podium", "podium-body", "podium-card", "podium-card--winner", "podium-mono", "podium-option", "podium-original",
      "podium-pay", "podium-photo", "podium-price", "podium-rank", "podium-save", "podium-title", "price", "price-label", "price--large", "price-list", "price-pay",
      "price-row", "promo", "promo-icon", "promo-text", "rank", "rank-deal", "ranked", "rank-head", "rank-list", "rank-no", "rank-pay", "rank-row", "rank-save",
      "results-head", "saving", "saving-fill", "saving-track", "section", "section-head", "section-lead", "section-title", "section-title--rule", "sentence-pick",
      "sentence-pick-label", "sentence-select", "sentence-word", "share-bar", "share-bar-legend", "share-bar-legend-item", "share-bar-seg--fail",
      "share-bar-seg--neutral", "share-bar-seg--pass", "share-bar-seg--warn", "share-bar-swatch", "share-bar-swatch--fail", "share-bar-swatch--neutral",
      "share-bar-swatch--pass", "share-bar-swatch--warn", "share-bar-track", "shell-brand", "shell-brand-name", "shell-footer", "shell-header", "shell-main",
      "shell-nav", "sort", "sort-wrap", "sort-wrap-label", "table", "table-option", "table-wrap", "tile", "tile--fail", "tile-hint", "tile-label", "tile--lead",
      "tile--pass", "tiles", "tiles--panel", "tile-value", "tile--warn", "top-deals-hero", "two-column", "two-column-aside", "two-column-main", "voucher-card",
      "voucher-card-head", "voucher-card-meta", "voucher-card-title", "voucher-item", "voucher-item-info", "voucher-item-label", "voucher-item-status", "voucher-list",
    ];
    const missing = kept.filter((name) => !new RegExp(`\\.${name}(?![\\w-])`).test(css));
    expect(missing).toEqual([]);
  });
});

describe("app.css lockup and look switch", () => {
  it("hides the pixel mark by default; the pixel stylesheet swaps the marks", () => {
    expect(css).toContain(".mark--pixel{display:none}");
  });

  it("gives each switch button a 44 px hit area over a 32 px track", () => {
    expect(rule(".theme-switch button")).toContain("height:44px");
    expect(rule(".theme-switch::before")).toContain("inset:6px 0");
    expect(rule(".theme-switch")).toContain("height:44px");
  });

  it("fills the Lab segment in the action colour by default, with text on it in the on-action colour", () => {
    expect(rule('.theme-switch button[value="lab"]::after')).toContain("background:var(--action)");
    expect(rule('.theme-switch button[value="lab"]')).toContain("color:var(--on-action)");
  });

  it("draws a round glyph before Lab and a square one before Pixel, in the text colour", () => {
    expect(rule(".theme-switch button::before")).toContain("background:currentColor");
    expect(rule('.theme-switch button[value="pixel"]::before')).toContain("border-radius:0");
  });

  it("rings the visible pill, not the hit box, when a button has keyboard focus", () => {
    expect(rule(".theme-switch button:focus-visible::after")).toContain("outline:2px solid var(--action)");
  });

  it("keeps the mark and the switch on the phone's first header row, the switch at the right edge, the nav under them", () => {
    expect(rule(".shell-header", phone)).toContain("flex-direction:column");
    expect(rule(".shell-lockup", phone)).toContain("justify-content:space-between");
    expect(rule(".shell-lockup::after", phone)).toContain("display:none");
    expect(rule(".shell-nav", phone)).toContain("border-top:1px solid var(--line)");
  });
});

describe("app.css Top deals pickers and ranked table", () => {
  it("draws the select like the text field, 48px tall, with the stylesheet's own chevron", () => {
    expect(css).toMatch(/\.field input,\.field select\{[^}]*min-height:48px/);
    expect(rule(".field select")).toContain("appearance:none");
  });

  it("turns the ranked table into a labelled list at phone width and hides the city there", () => {
    expect(css).toContain(".ranked thead{display:none}");
    expect(css).toMatch(/\.ranked tr\{[^}]*36px minmax\(0,1fr\)/);
    expect(css).toMatch(/\.ranked td\[data-label\]::before\{content:attr\(data-label\)/);
    expect(css).toContain(".ranked td.city{display:none}");
  });
});

describe("app.css sentence picker card", () => {
  it("draws a slot in the action colour on the accent underline, 44 tall, the chevron at right 2px", () => {
    expect(rule(".sentence-select,.sentence-input")).toContain("color:var(--action)");
    expect(rule(".sentence-select,.sentence-input")).toContain("border-bottom:3px solid var(--accent)");
    expect(rule(".sentence-select,.sentence-input")).toContain("height:44px");
    expect(rule(".sentence-select")).toContain("right 2px center");
  });

  it("keeps a word's group on one line on the desktop and starts a new line at a break", () => {
    expect(rule(".picker-group")).toContain("display:inline-flex");
    expect(rule(".picker-break")).toContain("flex-basis:100%");
  });

  it("sizes a select to its chosen value, not its longest option, so a wide tag list cannot push the sentence onto two lines", () => {
    expect(rule(".sentence-select")).toContain("field-sizing:content");
  });

  it("stacks the picker at phone width: words in one column, every slot at one x, the button full width", () => {
    expect(rule(".picker-sentence", phone)).toContain("grid-template-columns:max-content minmax(0,1fr)");
    expect(phone).toContain(".picker-group{display:contents}");
    expect(phone).toContain(".picker-break{display:none}");
    expect(phone).toContain(".sentence-pick{grid-column:2}");
    expect(phone).toContain(".sentence-word--row,.picker-sentence .btn{grid-column:1/-1}");
  });
});

describe("app.css section heads and boxes", () => {
  it("puts the results note on its own line under the title, uncapped, so flex-basis 100% can wrap it", () => {
    expect(rule(".results-note")).toContain("flex-basis:100%");
    expect(rule(".results-note")).not.toContain("max-width");
  });

  it("sets a table flush with its box and drops the rule under its last row, so the box edge is never doubled", () => {
    expect(css).toContain(".data-table :is(th,td):first-child{padding-left:0}");
    expect(css).toContain(".box .data-table tr:last-child>*{border-bottom:0}");
  });

  it("keeps the results head from wrapping into a second column on the phone, so the note stays under the title", () => {
    expect(rule(".results-head", phone)).toContain("flex-wrap:nowrap");
    expect(rule(".results-note", phone)).toContain("flex-basis:auto");
  });

  it("zeroes a plain paragraph's browser margin inside a box, since .box already spaces children with gap", () => {
    expect(rule(".box p")).toContain("margin:0");
  });
});

describe("app.css podium, tiles and rank rows", () => {
  it("lays the podium out as 1.5fr 1fr 1fr and marks the winner with an accent top border", () => {
    expect(css).toMatch(/\.podium\{[^}]*1\.5fr 1fr 1fr/);
    expect(css).toMatch(/\.podium-card--winner\{[^}]*border-top:4px solid var\(--accent\)/);
  });

  it("grids the rank row 44px minmax(0,1fr) 110px 120px 120px 150px, and four columns for a list of four", () => {
    expect(css).toMatch(/\.rank-head,\.rank-row\{[^}]*44px minmax\(0,1fr\) 110px 120px 120px 150px/);
    expect(css).toContain('.rank-list[data-cols="4"]>*{grid-template-columns:44px minmax(0,1fr) 130px 180px}');
  });

  it("draws the saving bar track at 72 by 8 on the track tone with an action fill", () => {
    expect(rule(".saving-track")).toContain("width:72px");
    expect(rule(".saving-track")).toContain("height:8px");
    expect(rule(".saving-fill")).toContain("background:var(--action)");
  });

  it("sets the tiles on one row with the lead spanning two, and two per row at phone width", () => {
    expect(rule(".tiles")).toContain("grid-auto-flow:column");
    expect(rule(".tile--lead")).toContain("grid-column:span 2");
    expect(rule(".tiles", phone)).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  });

  it("stacks the podium into one column at phone width", () => {
    expect(rule(".podium", phone)).toContain("grid-template-columns:1fr");
  });

  it("hides the rank-row header and turns each row into a labelled card at phone width", () => {
    expect(phone).toContain(".rank-head{display:none}");
    expect(phone).toContain(".rank-row{grid-template-columns:36px minmax(0,1fr)}");
    expect(phone).toMatch(/\.rank-row \[data-label\]::before[^{]*\{content:attr\(data-label\)/);
  });

  it("lays Top deals' phone rows out in two lines under the title: pay beside the original, save beside the bar", () => {
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row{grid-template-columns:36px minmax(0,1fr) max-content;align-items:baseline;column-gap:8px;row-gap:4px}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row .rank-pay,.rank-list[data-cols="6"] .rank-row .rank-save{grid-column:2;white-space:nowrap}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row .rank-pay{grid-row:2}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row .rank-save{grid-row:3}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row s{grid-column:3;grid-row:2}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row [data-label="Saved"]{grid-column:3;grid-row:3}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row s::before,.rank-list[data-cols="6"] .rank-row [data-label="Saved"]::before{content:none}');
  });

  it("gives the rank-pay and rank-save phone labels no colon, small and muted", () => {
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row .rank-pay::before{content:"You pay "}');
    expect(phone).toContain('.rank-list[data-cols="6"] .rank-row .rank-save::before{content:"You save "}');
  });

  it("draws the promo line under the deal at the option's size, never bold", () => {
    expect(rule(".promo-line")).toContain("font-weight:400");
  });

  it("wraps a save pill only between its label and its saving, never inside either", () => {
    expect(rule(".save-pill,.podium-save")).toContain("display:inline-flex");
    expect(rule(".save-pill,.podium-save")).toContain("flex-wrap:wrap");
    expect(rule(".save-pill-label,.save-pill-amount")).toContain("white-space:nowrap");
  });

  it("draws the column chart's bars from the data, bottom aligned", () => {
    expect(rule(".column-chart-bars")).toContain("align-items:flex-end");
    expect(rule(".column-chart-bar")).toContain("background:var(--action)");
  });

  it("keeps the four-column grid of a list of four off the phone", () => {
    const at = css.indexOf('.rank-list[data-cols="4"]');
    expect(css.slice(0, at)).toMatch(/@media \(min-width:481px\)\{$/);
  });

  it("turns a data table into a labelled list at phone width", () => {
    expect(phone).toContain(".data-table thead{display:none}");
    expect(rule(".data-table td::before", phone)).toContain("content:attr(data-label)");
  });

  it("folds the day strip into two rows of 15 at phone width", () => {
    expect(rule(".day-strip-days", phone)).toContain("grid-template-columns:repeat(15,minmax(0,1fr))");
  });

  it("draws the promo line as its own muted line under the deal, in the promo colour", () => {
    expect(css).toMatch(/\.promo-line\{[^}]*display:block[^}]*color:var\(--promo\)/);
    expect(css).not.toContain(".footnotes");
  });
});

describe("app.css verdict banner", () => {
  it("wraps the figure row under the sentence instead of squeezing the sentence to one word a line", () => {
    expect(rule(".verdict")).toContain("flex-wrap:wrap");
  });

  it("keeps the sentence at least 32 characters wide before it gives way to the figures", () => {
    expect(rule(".verdict-text")).toContain("min-width:32ch");
  });
});
