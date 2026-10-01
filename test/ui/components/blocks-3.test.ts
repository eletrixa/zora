/**
 * Tests for the Top deals pickers: the select field, the sort toggle, and the third-pass design's
 * sentence picker, panelled stat tiles, podium cards (the loop 5 board: filled winner pill, no "Best
 * deal", the whole card a link) and the ranked-row saving bar.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/blocks-3.test.ts
 * Deps:    bun:test, src/ui/components/blocks.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { podiumCard, savingBar, selectField, sentenceSelect, sortToggle, statTiles } from "../../../src/ui/components/blocks";

const cityOptions = [
  { value: "chicago", label: "Chicago" },
  { value: "denver", label: "Denver" },
];

describe("selectField", () => {
  it("renders a labelled select with one option per entry", () => {
    const html = selectField({ label: "City", name: "city", options: cityOptions });
    expect(html).toContain('<label class="field-label" for="city">City</label>');
    expect(html).toContain('<select id="city" name="city" autocomplete="off">');
    expect(html).toContain('<option value="chicago">Chicago</option>');
    expect(html).toContain('<option value="denver">Denver</option>');
  });

  it("marks the option whose value matches as selected", () => {
    const html = selectField({ label: "City", name: "city", value: "denver", options: cityOptions });
    expect(html).toContain('<option value="denver" selected>Denver</option>');
    expect(html).not.toContain('<option value="chicago" selected>');
  });

  it("selects nothing when the value matches no option", () => {
    const html = selectField({ label: "City", name: "city", value: "miami", options: cityOptions });
    expect(html).not.toContain("selected>");
  });

  it("adds the width class token like formField", () => {
    const html = selectField({ label: "City", name: "city", options: cityOptions, width: "wide" });
    expect(html).toContain('<div class="field field--wide">');
  });

  it("escapes an option value and label that carry HTML", () => {
    const html = selectField({
      label: "City",
      name: "city",
      options: [{ value: '"><script>evil()</script>', label: "<script>evil()</script>" }],
    });
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("sortToggle", () => {
  const options = [
    { key: "rank", label: "Best deal" },
    { key: "savings", label: "Biggest savings" },
  ];
  const hrefFor = (key: string): string => `/top-deals?sort=${key}`;

  it("renders one link per option with the href from hrefFor", () => {
    const html = sortToggle({ options, current: "rank", hrefFor });
    expect(html).toContain('<nav class="sort" aria-label="Sort">');
    expect(html).toContain('<a href="/top-deals?sort=rank"');
    expect(html).toContain('<a href="/top-deals?sort=savings"');
    expect(html).toContain("Best deal");
    expect(html).toContain("Biggest savings");
  });

  it("marks the current option with aria-current and no other", () => {
    const html = sortToggle({ options, current: "savings", hrefFor });
    expect(html).toMatch(/<a href="\/top-deals\?sort=savings"[^>]*aria-current="true"[^>]*>Biggest savings<\/a>/);
    expect(html).not.toMatch(/<a href="\/top-deals\?sort=rank"[^>]*aria-current="true"/);
  });

  it("escapes the href and the label", () => {
    const html = sortToggle({
      options: [{ key: "x", label: "<script>evil()</script>" }],
      current: "x",
      hrefFor: () => '/top-deals?sort=x"><script>evil()</script>',
    });
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("sentenceSelect", () => {
  const options = [
    { value: "things-to-do", label: "Things To Do" },
    { value: "food-and-drink", label: "Food and Drink" },
  ];

  it("renders the label, the select and the chosen option", () => {
    const html = sentenceSelect({ label: "Category", name: "category", value: "food-and-drink", options });
    expect(html).toContain('<label class="sentence-pick">');
    expect(html).toContain('<span class="sentence-pick-label">Category</span>');
    expect(html).toContain('<select class="sentence-select" id="category" name="category" autocomplete="off">');
    expect(html).toContain('<option value="food-and-drink" selected>Food and Drink</option>');
    expect(html).toContain('<option value="things-to-do">Things To Do</option>');
  });

  it("escapes the label, the name and an option carrying HTML", () => {
    const html = sentenceSelect({
      label: "<b>Category</b>",
      name: "category",
      value: "x",
      options: [{ value: '"><script>evil()</script>', label: "<script>evil()</script>" }],
    });
    expect(html).not.toContain("<b>Category</b>");
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("statTiles with options", () => {
  it("keeps the default call unchanged", () => {
    const html = statTiles([{ label: "Pass rate", value: "94%" }]);
    expect(html).toBe('<div class="tiles"><div class="tile"><span class="tile-label">Pass rate</span><span class="tile-value">94%</span></div></div>');
  });

  it("adds tiles--panel on the wrapper when panel is set", () => {
    const html = statTiles([{ label: "L", value: "V" }], { panel: true });
    expect(html).toContain('<div class="tiles tiles--panel">');
  });

  it("adds tile--lead on the first tile only when lead is set", () => {
    const html = statTiles(
      [
        { label: "Biggest saving", value: "$150.00" },
        { label: "Typical saving", value: "45%" },
      ],
      { lead: true },
    );
    expect(html).toContain('<div class="tile tile--lead">');
    expect(html).not.toContain('<div class="tile tile--lead tile--lead">');
    const secondTileIndex = html.indexOf("Typical saving");
    expect(html.slice(0, secondTileIndex)).not.toBe("");
    expect(html).toContain('<div class="tile"><span class="tile-label">Typical saving</span>');
  });
});

describe("podiumCard", () => {
  const base = {
    rank: 2,
    href: "/deal/escape-room",
    title: "Escape Room for Four",
    optionTitle: "Private room, 60 minutes",
    payText: "$79.00",
    originalText: "$140.00",
    saveText: "$61.00",
    sharePct: 43.6,
  };

  it("carries data-rank and the data-label cells for pay, original and save", () => {
    const html = podiumCard(base);
    expect(html).toContain('data-rank="2"');
    expect(html).toContain('<span class="podium-pay" data-label="You pay">$79.00</span>');
    expect(html).toContain('<s class="podium-original" data-label="Original">$140.00</s>');
    expect(html).toContain('data-label="You save"');
  });

  it("shows the monogram with the first letter of the title when no imageUrl is given", () => {
    const html = podiumCard(base);
    expect(html).toContain('<span class="podium-mono" aria-hidden="true">E</span>');
    expect(html).not.toContain("<img");
  });

  it("shows the photo when imageUrl is given", () => {
    const html = podiumCard({ ...base, imageUrl: "https://img.example/deal.jpg" });
    expect(html).toContain('<img class="podium-photo" src="https://img.example/deal.jpg" loading="lazy" alt="">');
    expect(html).not.toContain("podium-mono");
  });

  it("marks the winner with the class and fills its pill, with no Best deal wording", () => {
    const html = podiumCard({ ...base, winner: true });
    expect(html).toContain('class="podium-card podium-card--winner"');
    expect(html).toContain('<span class="podium-save save-pill save-pill--best"><span class="save-pill-amount" data-label="You save">You save $61.00 · 43.6 %</span></span>');
    expect(html).not.toContain("Best deal");
  });

  it("leads the winner's pill with the label of the tile that names it, as its own run", () => {
    const html = podiumCard({ ...base, winner: true, label: "Biggest saving" });
    expect(html).toContain('<span class="save-pill-label">Biggest saving · </span><span class="save-pill-amount" data-label="You save">You save $61.00 · 43.6 %</span>');
  });

  it("keeps a plain pill for a non-winner", () => {
    const html = podiumCard(base);
    expect(html).toContain('<span class="podium-save save-pill"><span class="save-pill-amount" data-label="You save">You save $61.00 · 43.6 %</span></span>');
    expect(html).not.toContain("Best deal");
  });

  it("links the whole card through the title and says You pay before the price", () => {
    const html = podiumCard(base);
    expect(html).toContain('<a class="podium-title" href="/deal/escape-room">Escape Room for Four<span class="card-cover" aria-hidden="true"></span></a>');
    expect(html).toContain('<span class="price-label">You pay</span><span class="podium-pay" data-label="You pay">$79.00</span>');
  });

  it("takes the monogram after a leading Up to N% Off on", () => {
    const html = podiumCard({ ...base, title: "Up to 38% Off on Couples Massage" });
    expect(html).toContain('<span class="podium-mono" aria-hidden="true">C</span>');
  });

  it("draws the promo as one line under the option when promo is set, the promo price only inside it", () => {
    const html = podiumCard({ ...base, promo: { code: "FALL", priceText: "$39.20" } });
    expect(html).toContain('</span><span class="promo-line">Type code FALL at Groupon checkout to pay $39.20.</span></div>');
    expect(html.split("$39.20").length - 1).toBe(1);
  });

  it("omits the promo line when no promo is set", () => {
    const html = podiumCard(base);
    expect(html).not.toContain('class="promo-line"');
  });

  it("escapes the title, the option title and the href", () => {
    const html = podiumCard({
      ...base,
      title: "<script>evil()</script>",
      optionTitle: "<script>evil()</script>",
      href: '"><script>evil()</script>',
    });
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("savingBar", () => {
  it("prints an integer width and a one-decimal percent", () => {
    const html = savingBar(43.6);
    expect(html).toContain('<span class="saving-fill" style="width:44%">');
    expect(html).toContain('<span class="saving-text">43.6 %</span>');
  });

  it("clamps a width above 100 down to 100", () => {
    const html = savingBar(140);
    expect(html).toContain('style="width:100%"');
    expect(html).toContain(">100.0 %<");
  });

  it("clamps a width below 0 up to 0", () => {
    const html = savingBar(-5);
    expect(html).toContain('style="width:0%"');
    expect(html).toContain(">0.0 %<");
  });
});
