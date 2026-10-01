/**
 * Tests for the loop 5 shared blocks of one site: hero, the sentence picker card and its parts, the
 * results head and page section, box, labelled list, figure row, verdict banner, drawn state, day
 * strip, column chart, rank rows and list, promo line, save pill, page foot, and the
 * board changes to tiles, badges and the empty state.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/blocks-4.test.ts
 * Deps:    bun:test, src/ui/components/blocks.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import {
  badge,
  box,
  columnChart,
  dataTable,
  dayStrip,
  drawnState,
  emptyState,
  figureRow,
  hero,
  labelledList,
  monogram,
  pageFoot,
  pageSection,
  pickerCard,
  promoLine,
  rankList,
  rankRow,
  resultsHead,
  savePill,
  savingBar,
  sentenceBreak,
  sentenceInput,
  sentenceSelect,
  sentenceWord,
  sideBoxes,
  statTiles,
  verdictBanner,
} from "../../../src/ui/components/blocks";

const EVIL = "<script>evil()</script>";
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("hero", () => {
  it("renders the eyebrow, the h1 and the lead in that order", () => {
    const html = hero({ eyebrow: "Product 4 · an AI Builder showcase", title: "Top deals", lead: "The 20 deals." });
    expect(html).toBe(
      '<div class="hero"><div class="hero-text"><p class="eyebrow">Product 4 · an AI Builder showcase</p>' +
        '<h1 class="hero-title">Top deals</h1><p class="lead">The 20 deals.</p></div></div>',
    );
  });

  it("bolds each strong phrase of the lead where it first appears, escaped", () => {
    const html = hero({ eyebrow: "E", title: "T", lead: { text: "Matched: 20 of 20 carts, 59 of 59 <pages>.", strong: ["20 of 20", "59 of 59 <pages>"] } });
    expect(html).toContain('<p class="lead">Matched: <strong>20 of 20</strong> carts, <strong>59 of 59 &lt;pages&gt;</strong>.</p>');
  });

  it("steps a title of more than 60 characters down a size", () => {
    const html = hero({ eyebrow: "E", title: "x".repeat(61), lead: "L" });
    expect(html).toContain('<h1 class="hero-title hero-title--long">');
    expect(hero({ eyebrow: "E", title: "x".repeat(60), lead: "L" })).not.toContain("hero-title--long");
  });

  it("puts the aside at the right when given", () => {
    const html = hero({ eyebrow: "E", title: "T", lead: "L", aside: '<span class="pill">Sample</span>' });
    expect(html).toContain('</div><div class="hero-aside"><span class="pill">Sample</span></div></div>');
  });

  it("escapes the eyebrow, the title and the lead", () => {
    const html = hero({ eyebrow: EVIL, title: EVIL, lead: EVIL });
    expect(html).not.toContain(EVIL);
    expect(count(html, "&lt;script&gt;")).toBe(3);
  });
});

describe("sentence parts", () => {
  it("renders a word, marking one of more than 8 characters to take its own phone row", () => {
    expect(sentenceWord("in")).toBe('<span class="sentence-word">in</span>');
    expect(sentenceWord("Top 20 deals")).toBe('<span class="sentence-word sentence-word--row">Top 20 deals</span>');
    expect(sentenceWord(EVIL)).not.toContain(EVIL);
  });

  it("renders a typed slot that password managers leave alone and that is never a password field", () => {
    const html = sentenceInput({ label: "What", name: "q", value: "massage", placeholder: "massage, oil change", size: 24 });
    expect(html).toContain('<label class="sentence-pick"><span class="sentence-pick-label">What</span>');
    expect(html).toContain('<input class="sentence-input" id="q" name="q" type="text" value="massage" placeholder="massage, oil change" size="24"');
    expect(html).toContain('autocomplete="off" data-1p-ignore data-lpignore="true"');
    expect(html).not.toContain('type="password"');
  });

  it("leaves out the value, the placeholder and the size when they are not given", () => {
    const html = sentenceInput({ label: "What", name: "q" });
    expect(html).not.toContain("value=");
    expect(html).not.toContain("placeholder=");
    expect(html).not.toContain("size=");
  });

  it("escapes every value of a typed slot", () => {
    const html = sentenceInput({ label: EVIL, name: '"><b>', value: EVIL, placeholder: EVIL });
    expect(html).not.toContain(EVIL);
    expect(html).not.toContain('"><b>');
  });

  it("keeps selected on the matching option of a sentence select", () => {
    const html = sentenceSelect({ label: "City", name: "place", value: "b", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] });
    expect(html).toContain('<option value="b" selected>B</option>');
    expect(html).toContain('<option value="a">A</option>');
  });
});

describe("pickerCard", () => {
  const city = sentenceSelect({ label: "City", name: "place", value: "a", options: [{ value: "a", label: "A" }] });
  const category = sentenceSelect({ label: "Category", name: "category", value: "c", options: [{ value: "c", label: "C" }] });

  it("renders a GET form that password managers leave alone", () => {
    const html = pickerCard({ action: "/find", parts: [sentenceWord("Find"), city], submit: "Search" });
    expect(html).toStartWith('<form class="picker-card" method="get" action="/find" autocomplete="off" data-1p-ignore>');
    expect(html).toEndWith("</form>");
  });

  it("keeps each word with the slots after it and ends the last group with the button", () => {
    const html = pickerCard({ action: "/", parts: [sentenceWord("Top 20 deals"), sentenceWord("in"), city, sentenceWord("for"), category] });
    expect(html).toContain(
      '<div class="picker-sentence"><span class="picker-group"><span class="sentence-word sentence-word--row">Top 20 deals</span>' +
        `<span class="sentence-word">in</span>${city}</span><span class="picker-group"><span class="sentence-word">for</span>${category}` +
        '<button class="btn" type="submit">Show</button></span></div>',
    );
  });

  it("labels the button as asked", () => {
    expect(pickerCard({ action: "/find", parts: [city], submit: "Search" })).toContain('<button class="btn" type="submit">Search</button>');
  });

  it("gives a word with no slot after it a phone row of its own", () => {
    const html = pickerCard({ action: "/", parts: [city, sentenceWord("today")] });
    expect(html).toContain('<span class="sentence-word sentence-word--row">today</span>');
  });

  it("starts a new line at a break, which the phone ignores", () => {
    const html = pickerCard({ action: "/find", parts: [sentenceWord("in"), city, sentenceBreak(), sentenceWord("for"), category] });
    expect(html).toContain(`${city}</span><span class="picker-break" aria-hidden="true"></span><span class="picker-group">`);
  });

  it("renders the hidden fields and the note, escaped", () => {
    const html = pickerCard({ action: '"><b>', parts: [city], hidden: [{ name: "sort", value: EVIL }], note: EVIL });
    expect(html).toContain('<input type="hidden" name="sort" value="&lt;script&gt;evil()&lt;/script&gt;">');
    expect(html).toContain('<p class="picker-note">&lt;script&gt;evil()&lt;/script&gt;</p>');
    expect(html).not.toContain(EVIL);
    expect(html).not.toContain('"><b>');
  });
});

describe("resultsHead and pageSection", () => {
  it("renders the title with the rule and the aside beside it", () => {
    const html = resultsHead({ title: "Top 20 in New York, NY: Things To Do", aside: '<nav class="sort"></nav>' });
    expect(html).toBe('<div class="results-head"><h2 class="section-title section-title--rule">Top 20 in New York, NY: Things To Do</h2><nav class="sort"></nav></div>');
  });

  it("puts the refresh note at the right when there is no aside", () => {
    const html = resultsHead({ title: "T", note: "Ordered by relevance.", refresh: "Refreshes daily at 04:00 UTC" });
    expect(html).toContain('</h2><span class="refresh-note">Refreshes daily at 04:00 UTC</span><p class="results-note">Ordered by relevance.</p></div>');
  });

  it("joins the refresh note to the note when an aside takes the right", () => {
    const html = resultsHead({ title: "T", aside: "<nav></nav>", note: "Ordered by amount.", refresh: "Refreshes every 3 hours" });
    expect(html).toContain('<p class="results-note">Ordered by amount. · Refreshes every 3 hours</p>');
    expect(html).not.toContain("refresh-note");
  });

  it("escapes the title, the note and the refresh", () => {
    expect(resultsHead({ title: EVIL, note: EVIL, refresh: EVIL })).not.toContain(EVIL);
  });

  it("wraps the head and the body in a section with an optional id", () => {
    const html = pageSection({ title: "Promo gap", body: "<p>b</p>", id: "promo-gap" });
    expect(html).toStartWith('<section class="page-section" id="promo-gap"><div class="results-head">');
    expect(html).toEndWith("<p>b</p></section>");
    expect(pageSection({ title: "T", body: "", id: '"><b>' })).not.toContain('"><b>');
  });
});

describe("box, sideBoxes, labelledList, figureRow, drawnState", () => {
  it("renders the box title, body and foot note, escaped", () => {
    expect(box({ title: "Ranks 4 to 20", body: "<div>rows</div>", note: "Last failure on 22 Sep." })).toBe(
      '<div class="box"><h3 class="box-title">Ranks 4 to 20</h3><div>rows</div><p class="box-note">Last failure on 22 Sep.</p></div>',
    );
    expect(box({ body: "" })).toBe('<div class="box"></div>');
    expect(box({ title: EVIL, body: "", note: EVIL })).not.toContain(EVIL);
  });

  it("sets a history box beside the latest-state box", () => {
    expect(sideBoxes("<a></a>", "<b></b>")).toBe('<div class="side-boxes"><a></a><b></b></div>');
  });

  it("lists labels against values and tones a value by class", () => {
    const html = labelledList([{ label: "Carts", value: "20" }, { label: "Failed", value: "1", tone: "fail" }]);
    expect(html).toBe(
      '<dl class="labelled-list"><div><dt>Carts</dt><dd>20</dd></div><div><dt>Failed</dt><dd class="toned toned--fail">1</dd></div></dl>',
    );
    expect(labelledList([{ label: EVIL, value: EVIL }])).not.toContain(EVIL);
  });

  it("sets figures side by side, a toned figure marked by class", () => {
    const html = figureRow([{ label: "Carts, 30 days", value: "99.8 %", tone: "pass" }, { label: "Pages", value: "59 of 59" }]);
    expect(html).toBe(
      '<div class="figure-row"><div class="figure"><span class="figure-label">Carts, 30 days</span><span class="figure-value toned toned--pass">99.8 %</span></div>' +
        '<div class="figure"><span class="figure-label">Pages</span><span class="figure-value">59 of 59</span></div></div>',
    );
    expect(figureRow([{ label: EVIL, value: EVIL }])).not.toContain(EVIL);
  });

  it("captions a drawn state over its block", () => {
    expect(drawnState("When nothing matches", "<div></div>")).toBe('<div class="drawn-state"><span class="state-caption">When nothing matches</span><div></div></div>');
    expect(drawnState(EVIL, "")).not.toContain(EVIL);
  });
});

describe("verdictBanner", () => {
  it("states the verdict as a live status, its tone a class", () => {
    const html = verdictBanner({ tone: "fail", title: "Mismatched", text: "1 of 20 carts charged more." });
    expect(html).toBe('<div class="verdict verdict--fail" role="status"><span class="verdict-word">Mismatched</span><p class="verdict-text">1 of 20 carts charged more.</p></div>');
  });

  it("carries the pass and neutral tones as classes too", () => {
    expect(verdictBanner({ tone: "pass", title: "Matched", text: "t" })).toContain('class="verdict verdict--pass"');
    expect(verdictBanner({ tone: "neutral", title: "No data", text: "t" })).toContain('class="verdict verdict--neutral"');
  });

  it("sets the rates at the right as a figure row", () => {
    const html = verdictBanner({ tone: "pass", title: "Pass", text: "t", figures: [{ label: "Pass rate", value: "94 %" }] });
    expect(html).toContain('</p><div class="figure-row"><div class="figure"><span class="figure-label">Pass rate</span>');
  });

  it("draws an example with no live region and no rates", () => {
    const html = verdictBanner({ tone: "pass", title: "Pass", text: "t", example: true, figures: [{ label: "r", value: "1" }] });
    expect(html).toStartWith('<div class="verdict verdict--pass verdict--example">');
    expect(html).not.toContain("role=");
    expect(html).not.toContain("figure-row");
  });

  it("escapes the word and the sentence", () => {
    expect(verdictBanner({ tone: "pass", title: EVIL, text: EVIL })).not.toContain(EVIL);
  });

  it("keeps the figure row a sibling after the sentence, never nested inside it, with two long figure values", () => {
    const html = verdictBanner({
      tone: "fail",
      title: "Mismatched",
      text: "The price shown was not the price charged at checkout for this cart.",
      figures: [
        { label: "Carts sampled, last 30 days", value: "1,284 of 1,284" },
        { label: "Mismatch rate, last 30 days", value: "0.8 %" },
      ],
    });
    expect(html).toContain('<p class="verdict-text">The price shown was not the price charged at checkout for this cart.</p><div class="figure-row">');
    expect(html.indexOf("</p>")).toBeLessThan(html.indexOf('class="figure-row"'));
  });
});

describe("dayStrip", () => {
  const day = (n: number, tone: "pass" | "fail" | "none") => ({ day: `${n} Sep`, tone, title: `${n} Sep: ${tone}` });

  it("draws one square per day with its tone as a class and its title as the tooltip", () => {
    const html = dayStrip({ days: [day(1, "pass"), day(2, "fail"), day(3, "none")] });
    expect(html).toContain('<span class="day day--pass" title="1 Sep: pass"></span><span class="day day--fail" title="2 Sep: fail"></span><span class="day day--none" title="3 Sep: none"></span>');
  });

  it("states the counts for a screen reader and the first and last day under the squares", () => {
    const html = dayStrip({ days: [day(1, "pass"), day(2, "fail"), day(3, "pass")], legend: { pass: "Matched", fail: "Mismatched", none: "No sample" } });
    expect(html).toStartWith('<div class="day-strip" role="img" aria-label="3 days: 2 matched, 1 mismatched">');
    expect(html).toContain('<div class="day-strip-dates"><span>1 Sep</span><span>3 Sep</span></div>');
    expect(html).toContain("Matched</span>");
    expect(html).toContain("No sample</span>");
  });

  it("keeps at most the newest 30 days", () => {
    const days = Array.from({ length: 35 }, (_, i) => day(i + 1, "pass"));
    const html = dayStrip({ days });
    expect(count(html, 'class="day day--pass" title=')).toBe(30);
    expect(html).not.toContain('title="5 Sep: pass"');
    expect(html).toContain('title="6 Sep: pass"');
    expect(html).toContain('aria-label="30 days: 30 pass, 0 fail"');
  });

  it("renders nothing for no days", () => {
    expect(dayStrip({ days: [] })).toBe("");
  });

  it("names one date, not the same date twice, when the first and the last day are the same", () => {
    const html = dayStrip({ days: [day(30, "pass")] });
    expect(html).toContain('<div class="day-strip-dates"><span>30 Sep</span></div>');
  });

  it("escapes the day and the title", () => {
    expect(dayStrip({ days: [{ day: EVIL, tone: "pass", title: '"><b>' }] })).not.toMatch(/<script>|"><b>/);
  });
});

describe("columnChart", () => {
  it("draws one column per bar, its height the share and its title the tooltip", () => {
    const html = columnChart({
      peakText: "Peak 1,284 on 21 Sep",
      bars: [
        { title: "1 Sep: 420", share: 0.327 },
        { title: "21 Sep: 1,284", share: 1 },
      ],
      axisStart: "1 Sep",
      axisEnd: "30 Sep, so far",
    });
    expect(html).toStartWith('<div class="column-chart"><p class="column-chart-peak">Peak 1,284 on 21 Sep</p>');
    expect(html).toContain('<div class="column-chart-bars"><span class="column-chart-bar" style="height:32.7%" title="1 Sep: 420"></span>');
    expect(html).toContain('<span class="column-chart-bar" style="height:100%" title="21 Sep: 1,284"></span></div>');
    expect(html).toContain('<div class="column-chart-axis"><span>1 Sep</span><span>30 Sep, so far</span></div>');
  });

  it("clamps a share outside 0..1", () => {
    const html = columnChart({ peakText: "Peak 1 on 1 Sep", bars: [{ title: "1 Sep: 1", share: 4 }], axisStart: "1 Sep", axisEnd: "1 Sep" });
    expect(html).toContain('style="height:100%"');
  });

  it("renders no columns for no bars", () => {
    const html = columnChart({ peakText: "No runs yet", bars: [], axisStart: "1 Sep", axisEnd: "30 Sep" });
    expect(html).toContain('<div class="column-chart-bars"></div>');
  });

  it("escapes the peak text, the tooltip and the axis labels", () => {
    const html = columnChart({ peakText: EVIL, bars: [{ title: EVIL, share: 0.5 }], axisStart: EVIL, axisEnd: EVIL });
    expect(html).not.toContain(EVIL);
  });
});

describe("rankRow and rankList", () => {
  const row = {
    rank: 4,
    href: "/deals/p4",
    title: "Sound Stage Rental",
    optionTitle: "12-hour rental",
    promo: { code: "FALL", priceText: "$1,200.00" },
    cells: [
      { label: "Original", text: "$1,860.00", kind: "original" as const },
      { label: "You pay", text: "$1,400.00", kind: "pay" as const },
      { label: "You save", text: "$460.00", kind: "save" as const },
      { label: "Saved", text: "24.7", kind: "bar" as const, pct: 24.7 },
    ],
  };

  it("renders the row exactly as the Top deals ranked rows, which the walkthrough parses", () => {
    expect(rankRow(row)).toBe(
      '<div class="rank-row" data-rank="4"><span class="rank-no">4</span><span class="rank-deal"><a href="/deals/p4">Sound Stage Rental</a>' +
        '<span class="table-option">12-hour rental</span><span class="promo-line">Type code FALL at Groupon checkout to pay $1,200.00.</span></span>' +
        '<s data-label="Original">$1,860.00</s><span class="rank-pay" data-label="You pay">$1,400.00</span>' +
        `<span class="rank-save" data-label="You save">$460.00</span><span data-label="Saved">${savingBar(24.7)}</span></div>`,
    );
  });

  it("draws a text cell under its own label and leaves out the promo line and option when not given", () => {
    const html = rankRow({ rank: 1, href: "/deals/x", title: "T", cells: [{ label: "Gap", text: "40.1 %", kind: "text" }] });
    expect(html).toBe('<div class="rank-row" data-rank="1"><span class="rank-no">1</span><span class="rank-deal"><a href="/deals/x">T</a></span><span data-label="Gap">40.1 %</span></div>');
  });

  it("reads a bar's percent from its text when no pct is given", () => {
    expect(rankRow({ rank: 1, href: "/", title: "T", cells: [{ label: "Gap", text: "40.1", kind: "bar" }] })).toContain(savingBar(40.1));
  });

  it("escapes every value of a row", () => {
    const html = rankRow({ rank: 1, href: '"><b>', title: EVIL, optionTitle: EVIL, cells: [{ label: '"><b>', text: EVIL, kind: "text" }] });
    expect(html).not.toContain(EVIL);
    expect(html).not.toContain('"><b>');
  });

  it("lays the rows under the column heads in a box, its column count a data attribute", () => {
    const html = rankList({ title: "Ranks 4 to 20", head: ["#", "Deal", "You pay", "Gap"], rows: ["<r1>", "<r2>"] });
    expect(html).toBe(
      '<div class="box"><h3 class="box-title">Ranks 4 to 20</h3><div class="rank-list" data-cols="4"><div class="rank-head" aria-hidden="true">' +
        "<span>#</span><span>Deal</span><span>You pay</span><span>Gap</span></div><r1><r2></div></div>",
    );
  });

  it("escapes the column heads and the title", () => {
    expect(rankList({ title: EVIL, head: [EVIL], rows: [] })).not.toContain(EVIL);
  });
});

describe("promoLine, savePill, monogram", () => {
  it("says the code to type at Groupon checkout and the price it gives, in one line", () => {
    expect(promoLine({ code: "FALL", priceText: "$376.20" })).toBe('<span class="promo-line">Type code FALL at Groupon checkout to pay $376.20.</span>');
  });

  it("says Groupon may offer the price at checkout when there is no code, and escapes the code", () => {
    expect(promoLine({ code: null, priceText: "$12.00" })).toBe('<span class="promo-line">Groupon may offer $12.00 at checkout.</span>');
    expect(promoLine({ code: EVIL, priceText: EVIL })).not.toContain(EVIL);
  });

  it("states the saving and its percent in one pill", () => {
    expect(savePill({ saveText: "$61.00", sharePct: 43.6 })).toBe(
      '<span class="save-pill"><span class="save-pill-amount" data-label="You save">You save $61.00 · 43.6 %</span></span>',
    );
  });

  it("fills the pill a tile names and leads it with that tile's label, the label its own run", () => {
    expect(savePill({ saveText: "$61.00", sharePct: 43.6, label: "Biggest saving" })).toBe(
      '<span class="save-pill save-pill--best"><span class="save-pill-label">Biggest saving · </span>' +
        '<span class="save-pill-amount" data-label="You save">You save $61.00 · 43.6 %</span></span>',
    );
    expect(savePill({ saveText: "$1.00", sharePct: 1, best: true })).toContain('class="save-pill save-pill--best"');
    expect(savePill({ saveText: EVIL, sharePct: 1, label: EVIL })).not.toContain(EVIL);
  });

  it("takes the first letter of the first word after a leading Up to N% Off on", () => {
    expect(monogram("Up to 38% Off on Couples Massage")).toBe("C");
    expect(monogram("2-Hour Guided Tour of the Met")).toBe("G");
    expect(monogram("escape room")).toBe("E");
    expect(monogram("123")).toBe("?");
  });
});

describe("pageFoot and emptyState", () => {
  it("closes the page with the refresh line, escaped", () => {
    expect(pageFoot("Prices refresh every 3 hours.")).toBe('<div class="page-foot"><p class="freshness">Prices refresh every 3 hours.</p></div>');
    expect(pageFoot(EVIL)).not.toContain(EVIL);
  });

  it("ends an empty state on its next step when a link is given", () => {
    expect(emptyState("No deals in Miami, FL.", { label: "Try the whole of Things To Do", href: "/?a=1&b=2" })).toBe(
      '<div class="empty">No deals in Miami, FL. <a class="empty-link" href="/?a=1&amp;b=2">Try the whole of Things To Do</a></div>',
    );
    expect(emptyState("s", { label: EVIL, href: '"><b>' })).not.toMatch(/<script>|"><b>/);
  });
});

describe("dataTable at phone width", () => {
  it("labels every cell with its column head, so the phone draws each row as a labelled list", () => {
    const html = dataTable(["Day", "Carts"], [["2026-09-30", "20"]], { numeric: [1] });
    expect(html).toContain('<table class="table data-table">');
    expect(html).toContain('<td data-label="Day">2026-09-30</td><td class="num" data-label="Carts">20</td>');
    expect(dataTable(['"><b>'], [["x"]])).not.toContain('"><b>');
  });
});

describe("statTiles and badge, as the boards changed them", () => {
  it("carries the check or cross glyph by a toned tile's label, so the tone never rests on colour", () => {
    const html = statTiles([{ label: "Carts matched", value: "20 of 20", tone: "pass" }, { label: "Failed", value: "1", tone: "fail" }]);
    expect(html).toMatch(/<div class="tile tile--pass"><span class="tile-label"><svg class="glyph"[^>]*><path d="m5 12\.5 4\.5 4\.5L19 7\.5"><\/path><\/svg>Carts matched<\/span>/);
    expect(html).toMatch(/<div class="tile tile--fail"><span class="tile-label"><svg class="glyph"[^>]*><path d="M6 6l12 12M18 6 6 18"><\/path><\/svg>Failed<\/span>/);
  });

  it("caps the tiles under the cards' price when asked", () => {
    expect(statTiles([{ label: "a", value: "1" }], { lead: true, capped: true })).toStartWith('<div class="tiles tiles--capped">');
  });

  it("draws a badge with its glyph, and a strong tone for a blocker", () => {
    expect(badge("Pass", "pass")).toMatch(/^<span class="badge badge--pass"><svg class="glyph"[^>]*><path d="m5 12\.5 4\.5 4\.5L19 7\.5"><\/path><\/svg>Pass<\/span>$/);
    expect(badge("Blocker", "strong", { glyph: false })).toBe('<span class="badge badge--strong">Blocker</span>');
  });
});
