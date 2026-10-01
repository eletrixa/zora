/**
 * The building blocks every page is made of, mirroring design/gen/common.py: the hero, the sentence
 * picker card and its parts, the results head and page section, box, side boxes, labelled list,
 * figure row, tiles, verdict banner, drawn state, day strip, column chart, podium card, rank rows,
 * promo line, save pill, page foot, and the older blocks (section, data table, empty
 * state, badge, button, fields, sort toggle, option rows, breadcrumb, two columns, voucher row,
 * histogram, latency bars, share bar, check rows, finding card, pill) that pages not rebuilt this
 * round still call.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/components/blocks.ts
 * Deps:    src/lib/html.ts, src/lib/money.ts, src/contracts/ports.ts, ./price.ts
 * Tested:  test/ui/components/blocks.test.ts, test/ui/components/blocks-2.test.ts,
 *          test/ui/components/blocks-3.test.ts, test/ui/components/blocks-4.test.ts,
 *          test/ui/components/latency-bars.test.ts
 */
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import type { PromoNote } from "../../contracts/ports";
import { promoNote } from "./price";

// ------------------------------------------------------------------ glyphs (LANGUAGE.md: a tone never rests on colour alone)

export type GlyphTone = "pass" | "fail" | "neutral";

const GLYPH_PATH: Readonly<Record<GlyphTone, string>> = {
  pass: "m5 12.5 4.5 4.5L19 7.5",
  fail: "M6 6l12 12M18 6 6 18",
  neutral: "M6 12h12",
};

/** Inside a card's title link: stretched over the card, so the photo and every line open the deal. */
export const CARD_COVER = '<span class="card-cover" aria-hidden="true"></span>';
const COVER = CARD_COVER;

/** The check, cross or dash drawn in currentColor; the pixel stylesheet squares its caps. */
export function glyph(tone: GlyphTone): string {
  return (
    `<svg class="glyph" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${GLYPH_PATH[tone]}"></path></svg>`
  );
}

export function section({ title, lead, body, id }: { title: string; lead?: string; body: string; id?: string }): string {
  const idAttr = id ? ` id="${esc(id)}"` : "";
  const leadHtml = lead ? `<p class="section-lead">${esc(lead)}</p>` : "";
  return `<section class="section"${idAttr}><div class="section-head"><h2 class="section-title">${esc(title)}</h2>${leadHtml}</div>${body}</section>`;
}

export interface StatTile {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: "neutral" | "pass" | "fail" | "warn";
}

/**
 * `panel` is kept for old callers (every tile now sits on the panel tone). `capped` sets the lead
 * figure no bigger than the cards' price to pay and the others 4 under it, for a page with prices
 * but no podium (Find a deal).
 */
export function statTiles(tiles: readonly StatTile[], options?: { panel?: boolean; lead?: boolean; capped?: boolean }): string {
  const panelClass = options?.panel ? " tiles--panel" : "";
  const cappedClass = options?.capped ? " tiles--capped" : "";
  const items = tiles
    .map((tile, index) => {
      const toneClass = tile.tone && tile.tone !== "neutral" ? ` tile--${tile.tone}` : "";
      const leadClass = options?.lead && index === 0 ? " tile--lead" : "";
      const mark = tile.tone === "pass" ? glyph("pass") : tile.tone === "fail" || tile.tone === "warn" ? glyph("fail") : "";
      const hint = tile.hint ? `<span class="tile-hint">${esc(tile.hint)}</span>` : "";
      return `<div class="tile${toneClass}${leadClass}"><span class="tile-label">${mark}${esc(tile.label)}</span><span class="tile-value">${esc(tile.value)}</span>${hint}</div>`;
    })
    .join("");
  return `<div class="tiles${panelClass}${cappedClass}">${items}</div>`;
}

export function dataTable(
  head: readonly string[],
  rows: readonly (readonly string[])[],
  options?: { numeric?: readonly number[] },
): string {
  if (rows.length === 0) return "";
  const numeric = new Set(options?.numeric ?? []);
  const headHtml = head.map((h, i) => `<th${numeric.has(i) ? ' class="num"' : ""} scope="col">${esc(h)}</th>`).join("");
  // Each cell carries its column head: at phone width the stylesheet draws a row as a labelled list.
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((cell, i) => `<td${numeric.has(i) ? ' class="num"' : ""} data-label="${esc(head[i] ?? "")}">${esc(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table class="table data-table"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

/** The calm empty panel; `link` is its next step, a phrase with no closing period. */
export function emptyState(sentence: string, link?: { label: string; href: string }): string {
  const next = link ? ` <a class="empty-link" href="${esc(link.href)}">${esc(link.label)}</a>` : "";
  return `<div class="empty">${esc(sentence)}${next}</div>`;
}

export type BadgeTone = "pass" | "fail" | "warn" | "neutral" | "strong";

const BADGE_GLYPH: Readonly<Record<BadgeTone, GlyphTone>> = { pass: "pass", fail: "fail", warn: "fail", neutral: "neutral", strong: "fail" };

/** `strong` is the fail ink filled (a blocker). The glyph leads the text unless `glyph` is false. */
export function badge(text: string, tone: BadgeTone, options?: { glyph?: boolean }): string {
  const mark = options?.glyph === false ? "" : glyph(BADGE_GLYPH[tone]);
  return `<span class="badge badge--${tone}">${mark}${esc(text)}</span>`;
}

export function button({
  label,
  href,
  type,
  tone,
  rel,
}: {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  tone?: "primary" | "secondary";
  rel?: string;
}): string {
  const cls = `btn${tone === "secondary" ? " btn--secondary" : ""}`;
  if (href) {
    const relAttr = rel !== undefined ? ` rel="${esc(rel)}"` : "";
    return `<a class="${cls}" href="${esc(href)}"${relAttr}>${esc(label)}</a>`;
  }
  return `<button class="${cls}" type="${esc(type ?? "button")}">${esc(label)}</button>`;
}

/** "full" (default, 100%) or the fixed widths Main.dc.html uses for city (220), state (200) and max price (160). */
export type FieldWidth = "full" | "wide" | "medium" | "narrow";

export function formField({
  label,
  name,
  value,
  placeholder,
  type,
  width,
}: {
  label: string;
  name: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "search" | "email" | "tel";
  width?: FieldWidth;
}): string {
  const widthClass = width && width !== "full" ? ` field--${width}` : "";
  const valueAttr = value !== undefined ? ` value="${esc(value)}"` : "";
  const placeholderAttr = placeholder !== undefined ? ` placeholder="${esc(placeholder)}"` : "";
  // Never render type="password", even if a caller bypasses the type union: the PIN field is a
  // text field drawn as dots (see the .pin class), so password managers never treat this as a login form.
  const safeType = type && (type as string) !== "password" ? type : "text";
  return (
    `<div class="field${widthClass}"><label class="field-label" for="${esc(name)}">${esc(label)}</label>` +
    `<input id="${esc(name)}" name="${esc(name)}" type="${esc(safeType)}"${valueAttr}${placeholderAttr} ` +
    `autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other"></div>`
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export function selectField({
  label,
  name,
  value,
  options,
  width,
}: {
  label: string;
  name: string;
  value?: string;
  options: readonly SelectOption[];
  width?: FieldWidth;
}): string {
  const widthClass = width && width !== "full" ? ` field--${width}` : "";
  const optionsHtml = options
    .map((option) => {
      const selected = value !== undefined && value === option.value ? " selected" : "";
      return `<option value="${esc(option.value)}"${selected}>${esc(option.label)}</option>`;
    })
    .join("");
  return (
    `<div class="field${widthClass}"><label class="field-label" for="${esc(name)}">${esc(label)}</label>` +
    `<select id="${esc(name)}" name="${esc(name)}" autocomplete="off">${optionsHtml}</select></div>`
  );
}

// ------------------------------------------------------------------ sort toggle (Top deals)

export interface SortOption {
  readonly key: string;
  readonly label: string;
}

export function sortToggle({
  options,
  current,
  hrefFor,
}: {
  options: readonly SortOption[];
  current: string;
  hrefFor: (key: string) => string;
}): string {
  const links = options
    .map((option) => {
      const current_ = option.key === current ? ' aria-current="true"' : "";
      return `<a href="${esc(hrefFor(option.key))}"${current_}>${esc(option.label)}</a>`;
    })
    .join("");
  return `<nav class="sort" aria-label="Sort">${links}</nav>`;
}

// ------------------------------------------------------------------ sentence picker select (TopDeals.dc.html, third pass)

export function sentenceSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly SelectOption[];
}): string {
  const optionsHtml = options
    .map((option) => {
      const selected = value === option.value ? " selected" : "";
      return `<option value="${esc(option.value)}"${selected}>${esc(option.label)}</option>`;
    })
    .join("");
  return (
    `<label class="sentence-pick"><span class="sentence-pick-label">${esc(label)}</span>` +
    `<select class="sentence-select" id="${esc(name)}" name="${esc(name)}" autocomplete="off">${optionsHtml}</select></label>`
  );
}

// ------------------------------------------------------------------ podium card (TopDeals.dc.html, third pass)

export interface PodiumCardProps {
  readonly rank: number;
  readonly href: string;
  readonly title: string;
  readonly optionTitle: string;
  readonly imageUrl?: string;
  readonly payText: string;
  readonly originalText: string;
  readonly saveText: string;
  /** 0..100, one decimal shown. */
  readonly sharePct: number;
  readonly promo?: PromoLine;
  readonly winner?: boolean;
  /** The label of the tile that names this deal ("Biggest saving"); it leads the filled pill. */
  readonly label?: string;
}

/** The podium card is the deal card with a rank badge; the winner is wider and its pill filled. */
export function podiumCard({
  rank,
  href,
  title,
  optionTitle,
  imageUrl,
  payText,
  originalText,
  saveText,
  sharePct,
  promo,
  winner,
  label,
}: PodiumCardProps): string {
  const winnerClass = winner ? " podium-card--winner" : "";
  const photo = imageUrl
    ? `<img class="podium-photo" src="${esc(imageUrl)}" loading="lazy" alt="">`
    : `<span class="podium-mono" aria-hidden="true">${esc(monogram(title))}</span>`;
  const promoHtml = promo ? promoLine(promo) : "";
  // The walkthrough reads "You save $X" as the pill's own text, so the pill holds no inner tags.
  const pill = savePill({ saveText, sharePct, label, best: winner }).replace('<span class="save-pill', '<span class="podium-save save-pill');
  return (
    `<article class="podium-card${winnerClass}" data-rank="${esc(String(rank))}">` +
    photo +
    `<span class="podium-rank">${esc(String(rank))}</span>` +
    `<div class="podium-body">` +
    `<div><a class="podium-title" href="${esc(href)}">${esc(title)}${COVER}</a>` +
    `<span class="podium-option">${esc(optionTitle)}</span>${promoHtml}</div>` +
    `<div class="podium-price"><span class="price-label">You pay</span><span class="podium-pay" data-label="You pay">${esc(payText)}</span>` +
    `<s class="podium-original" data-label="Original">${esc(originalText)}</s></div>` +
    pill +
    `</div></article>`
  );
}

// ------------------------------------------------------------------ ranked-row saving bar (TopDeals.dc.html, third pass)

/** `sharePct` is clamped to 0..100; the bar width is an integer percent, the text one decimal. */
export function savingBar(sharePct: number): string {
  const clamped = Math.max(0, Math.min(100, sharePct));
  const width = Math.round(clamped);
  const text = clamped.toFixed(1);
  return (
    `<span class="saving"><span class="saving-track" aria-hidden="true">` +
    `<span class="saving-fill" style="width:${esc(String(width))}%"></span></span>` +
    `<span class="saving-text">${esc(text)} %</span></span>`
  );
}

// ------------------------------------------------------------------ deal options (Deal.dc.html)

export interface OptionRowProps {
  readonly optionId: string;
  readonly title: string;
  readonly payText: string;
  readonly listPriceMinor: number;
  readonly payMinor: number;
  readonly currency: string;
  readonly precision: number;
  readonly promo: PromoNote | null;
  readonly sellable: boolean;
  readonly productId: string;
}

export function optionRow(option: OptionRowProps): string {
  const list =
    option.listPriceMinor > option.payMinor
      ? `<span class="option-row-list">${esc(formatMoney(option.listPriceMinor, option.currency, option.precision))}</span>`
      : "";
  const action = option.sellable
    ? `<form class="option-row-form" method="post" action="/checkout">` +
      `<input type="hidden" name="productId" value="${esc(option.productId)}">` +
      `<input type="hidden" name="optionId" value="${esc(option.optionId)}">` +
      `<input type="hidden" name="quantity" value="1">` +
      `${button({ label: "Get checkout link", type: "submit" })}</form>`
    : `<span class="option-row-unavailable">Not available right now</span>`;
  const promo = option.promo ? promoNote(option.promo) : "";
  return (
    `<div class="option-row">` +
    `<div class="option-row-top">` +
    `<span class="option-row-title">${esc(option.title)}</span>` +
    `<span class="option-row-prices">${list}<span class="option-row-pay">${esc(option.payText)}</span></span>` +
    `${action}` +
    `</div>${promo}</div>`
  );
}

export function optionList(rows: readonly string[]): string {
  return `<div class="option-list">${rows.join("")}</div>`;
}

// ------------------------------------------------------------------ breadcrumb (Deal.dc.html)

export function breadcrumb(items: readonly { label: string; href?: string }[]): string {
  const parts = items.map((item) =>
    item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a>` : `<span class="breadcrumb-current">${esc(item.label)}</span>`,
  );
  return `<nav class="breadcrumb" aria-label="Path">${parts.join('<span class="breadcrumb-sep">/</span>')}</nav>`;
}

// ------------------------------------------------------------------ two-column deal layout

export function twoColumn(main: string, aside: string): string {
  return `<div class="two-column"><div class="two-column-main">${main}</div><div class="two-column-aside">${aside}</div></div>`;
}

// ------------------------------------------------------------------ voucher row (Return.dc.html)

export interface VoucherRowProps {
  readonly title: string;
  readonly quantity: number;
  readonly status: string;
  readonly vouchers: readonly { status: string; url: string }[];
}

export function voucherRow({ title, quantity, status, vouchers }: VoucherRowProps): string {
  const items = vouchers
    .map((voucher, index) => {
      const n = index + 1;
      const action =
        voucher.status === "CANCELLED"
          ? badge(voucher.status, "neutral")
          : button({ label: `View voucher ${n} on Groupon`, href: voucher.url, tone: "secondary" });
      return (
        `<div class="voucher-item">` +
        `<div class="voucher-item-info"><span class="voucher-item-label">Voucher ${n}</span><span class="voucher-item-status">${esc(voucher.status)}</span></div>` +
        `${action}</div>`
      );
    })
    .join("");
  return (
    `<div class="voucher-card">` +
    `<div class="voucher-card-head"><span class="voucher-card-title">${esc(title)}</span>` +
    `<span class="voucher-card-meta">${esc(status)} · ${esc(String(quantity))} voucher${quantity === 1 ? "" : "s"}</span></div>` +
    `<div class="voucher-list">${items}</div></div>`
  );
}

// ------------------------------------------------------------------ histogram (PriceTruth.dc.html)

export interface HistogramBar {
  readonly label: string;
  readonly value: number;
  /** 0..1, sets the bar's width. */
  readonly share: number;
}

export function histogram(bars: readonly HistogramBar[]): string {
  const rows = bars
    .map((bar) => {
      const width = Math.max(0, Math.min(1, bar.share)) * 100;
      // The bar's width comes from the data, not a fixed look, so it stays an inline style.
      return (
        `<div class="histogram-row"><span class="histogram-label">${esc(bar.label)}</span>` +
        `<div class="histogram-track"><div class="histogram-bar" style="width:${width}%"></div></div>` +
        `<span class="histogram-value">${esc(bar.value.toLocaleString("en-US"))}</span></div>`
      );
    })
    .join("");
  return `<div class="histogram">${rows}</div>`;
}

// ------------------------------------------------------------------ latency bars (Scorecard.dc.html, LANGUAGE.md latency_bars)

export interface LatencyBar {
  /** "check · step"; each half is kept whole so a long name wraps at the dot, never inside a step. */
  readonly label: string;
  readonly p50Ms: number;
  readonly p95Ms: number;
}

/** How many rows show before "Show all N steps": the board's eight slowest. */
const LATENCY_VISIBLE = 8;

const ms = (n: number): string => Math.round(n).toLocaleString("en-US");

/** The axis in whole seconds: at least 0 to 4 s, at most five ticks, so a slow step still fits the scale. */
function latencyScale(rows: readonly LatencyBar[]): { readonly scaleMs: number; readonly ticks: readonly string[] } {
  const seconds = Math.max(4, Math.ceil(Math.max(0, ...rows.map((row) => row.p95Ms)) / 1000));
  const step = Math.ceil(seconds / 4);
  const top = step * Math.ceil(seconds / step);
  const ticks: string[] = [];
  for (let s = 0; s <= top; s += step) ticks.push(s === 0 ? "0" : `${s} s`);
  return { scaleMs: top * 1000, ticks };
}

function latencyRows(rows: readonly LatencyBar[], scaleMs: number): string {
  const share = (n: number): number => Math.max(0, Math.min(1, n / scaleMs)) * 100;
  return rows
    .map((row) => {
      const label = row.label
        .split(" · ")
        .map((half, i, all) => `<span class="latency-half">${esc(half)}${i < all.length - 1 ? " ·" : ""}</span>`)
        .join(" ");
      // The widths come from the data, so they stay inline styles; p95 sits behind, p50 in front.
      return (
        `<div class="histogram-row"><span class="histogram-label">${label}</span>` +
        `<div class="histogram-track"><div class="histogram-back" style="width:${share(row.p95Ms).toFixed(1)}%"></div>` +
        `<div class="histogram-bar" style="width:${share(row.p50Ms).toFixed(1)}%"></div></div>` +
        `<span class="histogram-value">${ms(row.p50Ms)} · ${ms(row.p95Ms)} ms</span></div>`
      );
    })
    .join("");
}

/**
 * p50 in front of p95 on one track per step, "524 · 3,723 ms" at the right, a legend in the bars' own
 * fills over them and an axis in seconds under them. Rows show in the order given; past the first
 * eight, "Show all N steps" opens the rest without a script.
 */
export function latencyBars(rows: readonly LatencyBar[]): string {
  const { scaleMs, ticks } = latencyScale(rows);
  const axis = `<div class="latency-axis" aria-hidden="true">${ticks.map((tick) => `<span>${esc(tick)}</span>`).join("")}</div>`;
  const legend =
    `<div class="latency-legend"><span><span class="latency-swatch"></span>p50, the typical call</span>` +
    `<span><span class="latency-swatch latency-swatch--p95"></span>p95, the slowest 1 in 20</span></div>`;
  const shown = `<div class="histogram">${latencyRows(rows.slice(0, LATENCY_VISIBLE), scaleMs)}</div>${axis}`;
  const rest = rows.slice(LATENCY_VISIBLE);
  const more =
    rest.length > 0
      ? `<details class="latency-more"><summary class="empty-link">Show all ${rows.length} steps</summary>` +
        `<div class="histogram">${latencyRows(rest, scaleMs)}</div>${axis}</details>`
      : "";
  return `<div class="latency">${legend}${shown}${more}</div>`;
}

// ------------------------------------------------------------------ share bar (PriceTruth.dc.html)

export interface ShareBarPart {
  readonly label: string;
  readonly share: number;
  readonly tone: "pass" | "fail" | "warn" | "neutral";
}

export function shareBar(parts: readonly ShareBarPart[]): string {
  const segments = parts
    .map((part) => {
      const width = Math.max(0, Math.min(1, part.share)) * 100;
      return `<div class="share-bar-seg share-bar-seg--${part.tone}" style="width:${width}%"></div>`;
    })
    .join("");
  const legend = parts
    .map((part) => {
      const pct = `${(part.share * 100).toFixed(0)}%`;
      return `<span class="share-bar-legend-item"><span class="share-bar-swatch share-bar-swatch--${part.tone}"></span>${esc(part.label)}: ${pct}</span>`;
    })
    .join("");
  return `<div class="share-bar"><div class="share-bar-track">${segments}</div><div class="share-bar-legend">${legend}</div></div>`;
}

// ------------------------------------------------------------------ check rows (Scorecard.dc.html)

export interface CheckRow {
  readonly name: string;
  readonly verdict: "pass" | "fail" | "skip";
  readonly detail: string;
  readonly latencyMs?: number | null;
  /** A failing step's two halves; when set they replace `detail` with labelled Expected and Observed lines. */
  readonly expected?: string;
  readonly observed?: string;
}

const CHECK_BADGE: Readonly<Record<CheckRow["verdict"], { label: string; tone: "pass" | "fail" | "neutral" }>> = {
  pass: { label: "Pass", tone: "pass" },
  fail: { label: "Fail", tone: "fail" },
  skip: { label: "Skipped", tone: "neutral" },
};

export function checkRows(rows: readonly CheckRow[]): string {
  const items = rows
    .map((row) => {
      const { label, tone } = CHECK_BADGE[row.verdict];
      const latency = row.latencyMs != null ? ` (${esc(String(row.latencyMs))} ms)` : "";
      const detail =
        row.expected != null
          ? findingLine("Expected", row.expected) + (row.observed ? findingLine("Observed", row.observed) : "")
          : esc(row.detail);
      return (
        `<div class="check-row"><span class="check-row-name">${esc(row.name)}</span>` +
        `<span class="check-row-badge">${badge(label, tone)}</span>` +
        `<span class="check-row-detail">${detail}${latency}</span></div>`
      );
    })
    .join("");
  return `<div class="check-rows">${items}</div>`;
}

// ------------------------------------------------------------------ finding card (Scorecard.dc.html)

export interface FindingCardProps {
  readonly id: string;
  readonly severity: "blocker" | "major" | "minor";
  readonly area: string;
  readonly expected: string;
  readonly observed: string;
  readonly status: string;
}

const FINDING_SEVERITY: Readonly<Record<FindingCardProps["severity"], { label: string; tone: BadgeTone }>> = {
  blocker: { label: "Blocker", tone: "strong" },
  major: { label: "Major", tone: "fail" },
  minor: { label: "Minor", tone: "neutral" },
};

export function findingCard({ id, severity, area, expected, observed, status }: FindingCardProps): string {
  const { label, tone } = FINDING_SEVERITY[severity];
  const statusHtml = status ? `<span class="finding-status">${esc(status)}</span>` : "";
  return (
    `<div class="finding-card finding-card--${severity}" id="finding-${esc(id)}">` +
    `<div class="finding-head">${badge(label, tone, { glyph: false })}${statusHtml}</div>` +
    `<div class="finding-body">` +
    `<span class="finding-area">${esc(area)}</span>` +
    findingLine("Expected", expected) +
    findingLine("Observed", observed) +
    `</div></div>`
  );
}

function findingLine(label: string, text: string): string {
  return `<span class="finding-line"><span class="finding-line-label">${label}: </span>${esc(text)}</span>`;
}

export function findingList(cards: readonly string[]): string {
  return `<div class="finding-list">${cards.join("")}</div>`;
}

// ------------------------------------------------------------------ pill

export function pill(text: string): string {
  return `<span class="pill">${esc(text)}</span>`;
}

// ------------------------------------------------------------------ loop 5: the parts every page shares (design/gen/common.py)

/** The photo fallback's letter: the first word that starts with a letter, after a leading "Up to 38% Off on". */
export function monogram(title: string): string {
  const rest = title.replace(/^\s*Up to \d+\s*% Off( on| at)?\s*/i, "");
  const word = rest.split(/\s+/).find((w) => /^\p{L}/u.test(w));
  const letter = word?.charAt(0) ?? /\p{L}/u.exec(title)?.[0] ?? "?";
  return letter.toUpperCase();
}

/** What a promo line needs: the code (null when Groupon applies the price without one) and the promo price text. */
export type PromoLine = Pick<PromoNote, "code" | "priceText">;

/**
 * The promo as one muted line under the deal it belongs to, in place of a numbered footnote list
 * (twenty sentences with the same code read as noise). The promo price appears only inside this
 * sentence, never in a price slot; the row's own "You pay" already says what it costs without the code.
 */
export function promoLine(promo: PromoLine): string {
  const text = promo.code ? `Type code ${promo.code} at Groupon checkout to pay ${promo.priceText}.` : `Groupon may offer ${promo.priceText} at checkout.`;
  return `<span class="promo-line">${esc(text)}</span>`;
}

/**
 * "You save $61.00 · 43.6 %" as one pill. `best` fills it (the podium winner); `label`, the label of
 * the tile that names the deal ("Biggest saving"), leads it and fills it too. The label and the
 * saving are two runs, each its own span kept whole (`white-space:nowrap`); the pill (`inline-flex`,
 * `flex-wrap:wrap`) breaks only between them, never inside one. The saving stays plain text inside
 * its span, so the walkthrough reads it straight after `data-label="You save"`.
 */
export function savePill({ saveText, sharePct, label, best }: { saveText: string; sharePct: number; label?: string; best?: boolean }): string {
  const named = label !== undefined && label !== "";
  const cls = best || named ? "save-pill save-pill--best" : "save-pill";
  const lead = named ? `<span class="save-pill-label">${esc(label)} · </span>` : "";
  const amount = `<span class="save-pill-amount" data-label="You save">You save ${esc(saveText)} · ${esc(sharePct.toFixed(1))} %</span>`;
  return `<span class="${cls}">${lead}${amount}</span>`;
}

// ------------------------------------------------------------------ hero

/** An h1 longer than this (a live deal title runs to 120) steps down a size. */
const LONG_TITLE = 60;

/** Eyebrow, h1 and lead, as every page opens; `aside` is optional HTML at the right (a badge, a pill). */
/** A hero lead: plain text, or text with phrases set in bold (PriceTruth.png bolds its counts). */
export type HeroLead = string | { readonly text: string; readonly strong?: readonly string[] };

/** Escapes the lead, then bolds the first place each phrase appears, so the bold never carries markup in. */
function heroLeadHtml(lead: HeroLead): string {
  if (typeof lead === "string") return esc(lead);
  let html = esc(lead.text);
  for (const phrase of lead.strong ?? []) {
    const safe = esc(phrase);
    const at = safe ? html.indexOf(safe) : -1;
    if (at >= 0) html = `${html.slice(0, at)}<strong>${safe}</strong>${html.slice(at + safe.length)}`;
  }
  return html;
}

export function hero({ eyebrow, title, lead, aside }: { eyebrow: string; title: string; lead: HeroLead; aside?: string }): string {
  const long = title.length > LONG_TITLE ? " hero-title--long" : "";
  const asideHtml = aside ? `<div class="hero-aside">${aside}</div>` : "";
  return (
    `<div class="hero"><div class="hero-text"><p class="eyebrow">${esc(eyebrow)}</p>` +
    `<h1 class="hero-title${long}">${esc(title)}</h1><p class="lead">${heroLeadHtml(lead)}</p></div>${asideHtml}</div>`
  );
}

// ------------------------------------------------------------------ the sentence picker card

/** A word of more than this takes a phone row of its own, so every slot keeps about 200 px. */
const PHONE_WORD_MAX = 8;

/** A fixed word of the sentence ("Top 20 deals", "in"). */
export function sentenceWord(text: string): string {
  const row = text.length > PHONE_WORD_MAX ? " sentence-word--row" : "";
  return `<span class="sentence-word${row}">${esc(text)}</span>`;
}

/** A typed slot ("Find [massage]"): the select's look without the chevron, 220 wide unless `size` is given. */
export function sentenceInput({
  label,
  name,
  value,
  placeholder,
  size,
}: {
  label: string;
  name: string;
  value?: string;
  placeholder?: string;
  size?: number;
}): string {
  const valueAttr = value !== undefined ? ` value="${esc(value)}"` : "";
  const placeholderAttr = placeholder !== undefined ? ` placeholder="${esc(placeholder)}"` : "";
  const sizeAttr = size !== undefined ? ` size="${esc(String(size))}"` : "";
  // Always a text field: the finder must offer a password manager nothing to save (bin/walkthrough).
  return (
    `<label class="sentence-pick"><span class="sentence-pick-label">${esc(label)}</span>` +
    `<input class="sentence-input" id="${esc(name)}" name="${esc(name)}" type="text"${valueAttr}${placeholderAttr}${sizeAttr} ` +
    `autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true" data-form-type="other"></label>`
  );
}

const BREAK = '<span class="picker-break" aria-hidden="true"></span>';

/** Starts a new line of the sentence on the desktop (Find a deal breaks after City); the phone ignores it. */
export function sentenceBreak(): string {
  return BREAK;
}

const isWord = (part: string): boolean => part.startsWith('<span class="sentence-word');
const isSlot = (part: string): boolean => part.startsWith('<label class="sentence-pick"');

/**
 * The picker card: one sentence of words and slots as a GET form, the button ending it, a note under
 * it. Each word stays with the slots after it in a `picker-group`, and the last group holds the
 * button, so a wide select breaks the sentence between groups and the button is never alone.
 */
export function pickerCard({
  action,
  parts,
  submit,
  note,
  hidden,
}: {
  action: string;
  parts: string | readonly string[];
  submit?: string;
  note?: string;
  hidden?: readonly { name: string; value: string }[];
}): string {
  const list = typeof parts === "string" ? [parts] : parts;
  // A word with no slot after it takes a phone row of its own, as a long word does.
  const marked = list.map((part, i) => {
    const next = list[i + 1];
    return isWord(part) && !(next !== undefined && isSlot(next)) ? part.replace('class="sentence-word"', 'class="sentence-word sentence-word--row"') : part;
  });
  const groups: (string[] | null)[] = [];
  let current: string[] = [];
  marked.forEach((part, i) => {
    const previous = marked[i - 1];
    if (part === BREAK) {
      if (current.length) groups.push(current);
      groups.push(null);
      current = [];
      return;
    }
    if (isWord(part) && current.length && !(previous !== undefined && isWord(previous))) {
      groups.push(current);
      current = [];
    }
    current.push(part);
  });
  if (current.length) groups.push(current);
  const submitButton = button({ label: submit ?? "Show", type: "submit" });
  const lastGroup = groups.reduce((last, group, i) => (group ? i : last), -1);
  const sentence = groups
    .map((group, i) => (group === null ? BREAK : `<span class="picker-group">${group.join("")}${i === lastGroup ? submitButton : ""}</span>`))
    .join("");
  const tail = lastGroup === -1 ? submitButton : "";
  const hiddenHtml = (hidden ?? []).map((field) => `<input type="hidden" name="${esc(field.name)}" value="${esc(field.value)}">`).join("");
  const noteHtml = note ? `<p class="picker-note">${esc(note)}</p>` : "";
  return (
    `<form class="picker-card" method="get" action="${esc(action)}" autocomplete="off" data-1p-ignore>` +
    `${hiddenHtml}<div class="picker-sentence">${sentence}${tail}</div>${noteHtml}</form>`
  );
}

// ------------------------------------------------------------------ results head, page section, box

/**
 * The head of a section or a result list: the title with the accent rule; at its right the aside (a
 * sort toggle) or, without one, the refresh note; under it the note, joined by the refresh when an
 * aside took the right.
 */
export function resultsHead({ title, aside, note, refresh }: { title: string; aside?: string; note?: string; refresh?: string }): string {
  const right = aside ?? (refresh ? `<span class="refresh-note">${esc(refresh)}</span>` : "");
  const bits = [note, aside !== undefined ? refresh : undefined].filter((bit): bit is string => Boolean(bit));
  const noteHtml = bits.length ? `<p class="results-note">${bits.map(esc).join(" · ")}</p>` : "";
  return `<div class="results-head"><h2 class="section-title section-title--rule">${esc(title)}</h2>${right}${noteHtml}</div>`;
}

/** A page section: its head on the ground, then its body (boxes, podium, grid). `id` for a link to it. */
export function pageSection({
  title,
  body,
  aside,
  note,
  refresh,
  id,
}: {
  title: string;
  body: string;
  aside?: string;
  note?: string;
  refresh?: string;
  id?: string;
}): string {
  const idAttr = id ? ` id="${esc(id)}"` : "";
  return `<section class="page-section"${idAttr}>${resultsHead({ title, aside, note, refresh })}${body}</section>`;
}

/** The surface card that holds rows, tables, strips and charts inside a section; `note` sits at its foot. */
export function box({ title, body, note }: { title?: string; body: string; note?: string }): string {
  const titleHtml = title ? `<h3 class="box-title">${esc(title)}</h3>` : "";
  const noteHtml = note ? `<p class="box-note">${esc(note)}</p>` : "";
  return `<div class="box">${titleHtml}${body}${noteHtml}</div>`;
}

/** A history box beside a 320 wide box with the latest state; they end on one line, and the phone stacks them. */
export function sideBoxes(left: string, right: string): string {
  return `<div class="side-boxes">${left}${right}</div>`;
}

export interface LabelledValue {
  readonly label: string;
  readonly value: string;
  readonly tone?: "pass" | "fail";
}

const toned = (tone: "pass" | "fail" | undefined): string => (tone ? `toned toned--${tone}` : "");

/** Labels against values, one per line (the latest day, the sync card): label left, value right. */
export function labelledList(items: readonly LabelledValue[]): string {
  const rows = items
    .map((item) => {
      const cls = toned(item.tone);
      return `<div><dt>${esc(item.label)}</dt><dd${cls ? ` class="${cls}"` : ""}>${esc(item.value)}</dd></div>`;
    })
    .join("");
  return `<dl class="labelled-list">${rows}</dl>`;
}

/** Figures side by side on the ground: a verdict's rates, or what a section states under its note. */
export function figureRow(figures: readonly LabelledValue[]): string {
  const items = figures
    .map((figure) => {
      const cls = toned(figure.tone);
      return `<div class="figure"><span class="figure-label">${esc(figure.label)}</span><span class="figure-value${cls ? ` ${cls}` : ""}">${esc(figure.value)}</span></div>`;
    })
    .join("");
  return `<div class="figure-row">${items}</div>`;
}

// ------------------------------------------------------------------ verdict banner and drawn states

/**
 * Today's answer: the word, one sentence with today's numbers, the rates at the right. `example` draws
 * the other state under the page: no live region, the word a size down, and no rates, since its
 * sentence carries its own counts.
 */
export function verdictBanner({
  tone,
  title,
  text,
  figures,
  example,
}: {
  tone: "pass" | "fail" | "neutral";
  title: string;
  text: string;
  figures?: readonly LabelledValue[];
  example?: boolean;
}): string {
  const rates = !example && figures && figures.length ? figureRow(figures) : "";
  const head = example ? `<div class="verdict verdict--${tone} verdict--example">` : `<div class="verdict verdict--${tone}" role="status">`;
  return `${head}<span class="verdict-word">${esc(title)}</span><p class="verdict-text">${esc(text)}</p>${rates}</div>`;
}

/** The one wrapper for a state drawn under the page (an example verdict, an empty panel): its caption, then the block. */
export function drawnState(caption: string, body: string): string {
  return `<div class="drawn-state"><span class="state-caption">${esc(caption)}</span>${body}</div>`;
}

// ------------------------------------------------------------------ day strip

export type DayTone = "pass" | "fail" | "none";

export interface StripDay {
  /** The date as text writes it ("30 Sep"); the first and last are printed under the strip. */
  readonly day: string;
  readonly tone: DayTone;
  /** The tooltip, the date and the outcome ("30 Sep: Fail"). */
  readonly title: string;
}

const STRIP_MAX = 30;

/**
 * One square per day or run, oldest left, at most the newest 30: filled (pass), hatched (fail), dashed
 * (no data). Under it the first and last date, then the legend in the page's own words.
 */
export function dayStrip({ days, legend }: { days: readonly StripDay[]; legend?: Readonly<Record<DayTone, string>> }): string {
  const shown = days.slice(-STRIP_MAX);
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (!first || !last) return "";
  const words = legend ?? { pass: "Pass", fail: "Fail", none: "No data" };
  const passes = shown.filter((day) => day.tone === "pass").length;
  const fails = shown.filter((day) => day.tone === "fail").length;
  const label = `${shown.length} days: ${passes} ${words.pass.toLowerCase()}, ${fails} ${words.fail.toLowerCase()}`;
  const squares = shown.map((day) => `<span class="day day--${day.tone}" title="${esc(day.title)}"></span>`).join("");
  const keys = (["pass", "fail", "none"] as const)
    .map((tone) => `<span class="day-strip-key"><span class="day day--${tone}"></span>${esc(words[tone])}</span>`)
    .join("");
  // One day names itself once; two or more name the oldest and the newest, so no date repeats under one square.
  const dates = first.day === last.day ? `<span>${esc(first.day)}</span>` : `<span>${esc(first.day)}</span><span>${esc(last.day)}</span>`;
  return (
    `<div class="day-strip" role="img" aria-label="${esc(label)}"><div class="day-strip-days">${squares}</div>` +
    `<div class="day-strip-dates">${dates}</div>` +
    `<div class="day-strip-legend">${keys}</div></div>`
  );
}

// ------------------------------------------------------------------ column chart (PriceTruth.dc.html, Freshness)

export interface ColumnChartBar {
  /** The tooltip over the column ("21 Sep: 1,284"). */
  readonly title: string;
  /** 0..1, sets the column's height. */
  readonly share: number;
}

/**
 * One column per day, oldest left, the peak named above them and the first and last day under them
 * ("1 Sep" … "30 Sep, so far"), so a day with no runs yet still reads as today. `peakText` and the
 * axis labels are given pre-formatted, as `dayStrip`'s day text is.
 */
export function columnChart({
  peakText,
  bars,
  axisStart,
  axisEnd,
}: {
  peakText: string;
  bars: readonly ColumnChartBar[];
  axisStart: string;
  axisEnd: string;
}): string {
  const columns = bars
    .map((bar) => {
      const height = Math.max(0, Math.min(1, bar.share)) * 100;
      return `<span class="column-chart-bar" style="height:${height}%" title="${esc(bar.title)}"></span>`;
    })
    .join("");
  return (
    `<div class="column-chart"><p class="column-chart-peak">${esc(peakText)}</p>` +
    `<div class="column-chart-bars">${columns}</div>` +
    `<div class="column-chart-axis"><span>${esc(axisStart)}</span><span>${esc(axisEnd)}</span></div></div>`
  );
}

// ------------------------------------------------------------------ rank rows

export interface RankCell {
  readonly label: string;
  readonly text: string;
  readonly kind: "original" | "pay" | "save" | "bar" | "text";
  /** For a bar, 0..100; without it the bar reads the number in `text`. */
  readonly pct?: number;
}

export interface RankRowProps {
  readonly rank: number;
  readonly href: string;
  readonly title: string;
  readonly optionTitle?: string;
  readonly cells: readonly RankCell[];
  readonly promo?: PromoLine;
}

function rankCell(cell: RankCell): string {
  const label = esc(cell.label);
  switch (cell.kind) {
    case "original":
      return `<s data-label="${label}">${esc(cell.text)}</s>`;
    case "pay":
      return `<span class="rank-pay" data-label="${label}">${esc(cell.text)}</span>`;
    case "save":
      return `<span class="rank-save" data-label="${label}">${esc(cell.text)}</span>`;
    case "bar":
      return `<span data-label="${label}">${savingBar(cell.pct ?? Number.parseFloat(cell.text))}</span>`;
    case "text":
      return `<span data-label="${label}">${esc(cell.text)}</span>`;
  }
}

/** One ranked row, as the Top deals rows are drawn (bin/walkthrough parses this markup). */
export function rankRow({ rank, href, title, optionTitle, cells, promo }: RankRowProps): string {
  const promoHtml = promo ? promoLine(promo) : "";
  const option = optionTitle !== undefined ? `<span class="table-option">${esc(optionTitle)}</span>` : "";
  const n = esc(String(rank));
  return (
    `<div class="rank-row" data-rank="${n}"><span class="rank-no">${n}</span>` +
    `<span class="rank-deal"><a href="${esc(href)}">${esc(title)}</a>${option}${promoHtml}</span>` +
    `${cells.map(rankCell).join("")}</div>`
  );
}

/**
 * The ranked rows under their column heads, in a box. `head` names the columns, "#" first; their
 * count is `data-cols`, which picks the grid (6: Top deals' rows, 4: Price truth's gaps).
 */
export function rankList({ head, rows, title }: { head: readonly string[]; rows: readonly string[]; title?: string }): string {
  const heads = head.map((h) => `<span>${esc(h)}</span>`).join("");
  const list = `<div class="rank-list" data-cols="${head.length}"><div class="rank-head" aria-hidden="true">${heads}</div>${rows.join("")}</div>`;
  const titleHtml = title ? `<h3 class="box-title">${esc(title)}</h3>` : "";
  return `<div class="box">${titleHtml}${list}</div>`;
}

// ------------------------------------------------------------------ page foot

/** The page's last block: when its numbers refresh. The shell's footer adds where prices come from. */
export function pageFoot(text: string): string {
  return `<div class="page-foot"><p class="freshness">${esc(text)}</p></div>`;
}
