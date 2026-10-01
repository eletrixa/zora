/**
 * One deal with its options, locations, terms and price history, cut from Deal.dc.html and
 * DealPhone.dc.html: the breadcrumb, the hero, the photo and buy box, the tiles computed from
 * the options, the option rows with their saving and promo lines, the locations, the terms
 * and the price history.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/deal.tsx
 * Deps:    src/contracts/pages.ts, src/contracts/ports.ts, src/lib/html.ts, src/lib/money.ts,
 *          src/ui/components/shell.ts, src/ui/components/blocks.ts, src/ui/components/price.ts
 * Tested:  test/ui/pages/deal.test.tsx, test/app/pages.test.ts
 */
import type { PageRenderer, DealPageProps } from "../../contracts/pages";
import type { DealDetail, DealOption, PriceChangeRow, StoredLocation } from "../../contracts/ports";
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import { shell } from "../components/shell";
import { priceBlock, promoNote } from "../components/price";
import {
  box,
  breadcrumb,
  button,
  dataTable,
  emptyState,
  hero,
  optionList,
  pageSection,
  pill,
  promoLine,
  savePill,
  statTiles,
  twoColumn,
  type StatTile,
} from "../components/blocks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Prices and the catalogue refresh on this cadence everywhere else in the app; a plain, static fact. */
const REFRESH = "Refreshes every 3 hours";

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const FIELD_LABEL: Readonly<Record<PriceChangeRow["field"], string>> = {
  retail: "Price you pay",
  original: "List price",
  promo: "Promo price",
};

/** The hero photo beside the buy box; `.deal-photo` (requested of ui-components) grows to match the buy box's own height, cover fit, in place of the fixed-height card strip. */
function image(deal: DealDetail): string {
  if (deal.imageUrl) return `<img class="deal-photo" src="${esc(deal.imageUrl)}" alt="">`;
  return `<div class="deal-photo">Deal photo</div>`;
}

/** The category labels as pills, for the hero's aside; the eyebrow itself is the deal's City, ST. */
function pillRow(labels: readonly string[]): string {
  return `<div class="pill-row">${labels.map(pill).join("")}</div>`;
}

/** The pin icon leading a location row (requested of ui-components; styled through `.location-pin`). */
const LOCATION_PIN =
  '<svg class="location-pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-7.4-7-12a7 7 0 1 1 14 0c0 4.6-7 12-7 12z"></path>' +
  '<circle cx="12" cy="9" r="2.5"></circle></svg>';

function addressText(location: StoredLocation): string {
  const stateZip = [location.state, location.postalCode].filter((part): part is string => part !== null).join(" ");
  return [location.street, location.city, stateZip || null].filter((part): part is string => !!part).join(", ");
}

/** One row: the pin, the place name in bold and the address under it (Deal.png; `.location-row` is a request to ui-components). */
function locationRow(location: StoredLocation): string {
  const name = location.name ? `<span class="location-name">${esc(location.name)}</span>` : "";
  const address = addressText(location);
  const addressHtml = address ? `<span class="location-address">${esc(address)}</span>` : "";
  return `<div class="location-row">${LOCATION_PIN}<div class="location-body">${name}${addressHtml}</div></div>`;
}

function locationsBody(locations: readonly StoredLocation[]): string {
  if (locations.length === 0) return emptyState("This deal has no listed location; it is redeemed online or by the merchant's own arrangement.");
  return box({ body: `<div class="location-rows">${locations.map(locationRow).join("")}</div>` });
}

function priceHistoryBody(deal: DealDetail, rows: readonly PriceChangeRow[]): string {
  if (rows.length === 0) return emptyState("No price change seen yet. The delta sync looks every 3 hours; changes appear here.");
  const optionTitle = (optionId: string): string => deal.options.find((option) => option.optionId === optionId)?.title ?? optionId;
  const money = (minor: number | null): string => (minor === null ? "none" : formatMoney(minor, deal.currency, deal.precision));
  const tableRows = rows.map((row) => [formatDay(row.detectedAt), optionTitle(row.optionId), FIELD_LABEL[row.field], money(row.oldMinor), money(row.newMinor)]);
  return box({ body: dataTable(["Seen on", "Option", "What changed", "From", "To"], tableRows, { numeric: [3, 4] }) });
}

/**
 * Biggest saving, Options, Promo codes and Price changes, computed from `options` and the price
 * history alone (the cheapest option itself is shown in the buy box, not a tile). `priceChanges`
 * is `priceHistory.length`.
 */
function tilesOf(options: readonly DealOption[], currency: string, precision: number, priceChanges: number): readonly StatTile[] {
  if (options.length === 0) return [];
  const sellable = options.filter((option) => option.sellable);
  const notSellable = options.length - sellable.length;
  const optionsTile: StatTile = {
    label: "Options",
    value: String(options.length),
    hint: notSellable === 0 ? `${sellable.length} on sale now` : `${sellable.length} on sale now, ${notSellable} not available`,
  };
  const withPromo = options.filter((option) => option.promo !== null).length;
  const promoTile: StatTile = { label: "Promo codes", value: `${withPromo} of ${options.length}`, hint: "typed at Groupon checkout, under the option" };
  const priceChangesTile: StatTile = { label: "Price changes", value: String(priceChanges), hint: "seen by the delta sync" };
  if (sellable.length === 0) return [optionsTile, promoTile, priceChangesTile];
  const savingOf = (option: DealOption): number => option.listPriceMinor - option.payMinor;
  const biggestSaving = sellable.reduce((max, option) => (savingOf(option) > savingOf(max) ? option : max));
  const biggestTile: StatTile = { label: "Biggest saving", value: formatMoney(savingOf(biggestSaving), currency, precision), hint: biggestSaving.title };
  return [biggestTile, optionsTile, promoTile, priceChangesTile];
}

/** "You save $X · Y %", left out when the option does not actually save anything. */
function savingOf(option: Pick<DealOption, "listPriceMinor" | "payMinor">, currency: string, precision: number): string {
  const saveMinor = option.listPriceMinor - option.payMinor;
  if (saveMinor <= 0 || option.listPriceMinor <= 0) return "";
  const sharePct = (saveMinor / option.listPriceMinor) * 100;
  return savePill({ saveText: formatMoney(saveMinor, currency, precision), sharePct });
}

/**
 * The deal's primary option (its own `payText`, `listPriceMinor` and `promo`) is always Groupon's
 * cheapest sellable option (`getDeal` never returns a deal without one). The buy box shows it with
 * the checkout form; the matching row in `deal.options` points back here instead of repeating it.
 * The "The cheapest option" heading sits over the option title itself; the `.buy-box` wrapper
 * (requested of ui-components) is the hook that spans the checkout button the full width of the card.
 */
function buyBox(deal: DealDetail): string {
  const optionTitle = `<p class="option-row-title">${esc(deal.optionTitle)}</p>`;
  const price = priceBlock(
    { payText: deal.payText, listPriceMinor: deal.listPriceMinor, payMinor: deal.payMinor, currency: deal.currency, precision: deal.precision, promo: null },
    "large",
  );
  const save = savingOf(deal, deal.currency, deal.precision);
  const promo = deal.promo ? promoNote(deal.promo) : "";
  const checkout =
    `<form class="option-row-form" method="post" action="/checkout">` +
    `<input type="hidden" name="productId" value="${esc(deal.productId)}">` +
    `<input type="hidden" name="optionId" value="${esc(deal.optionId)}">` +
    `<input type="hidden" name="quantity" value="1">` +
    `${button({ label: "Get checkout link", type: "submit" })}</form>`;
  const note = `<p class="buy-box-note">You pay on Groupon's checkout page. Groupon sends the voucher.</p>`;
  const count = deal.options.length;
  const seeAll = count > 0 ? `<p class="buy-box-link"><a href="#options">See all ${esc(String(count))} option${count === 1 ? "" : "s"}</a></p>` : "";
  const body = box({ title: "The cheapest option", body: optionTitle + price + save + promo + checkout + note + seeAll });
  return `<div class="buy-box">${body}</div>`;
}

/**
 * One row of the Options section: the struck original and "You pay", the saving, a "promo N"
 * marker when it carries a promo code (the sentence itself moves to the numbered list under the
 * options), and the action: the deal's own primary option is already bought from the buy box
 * above, so it reads "In the box above" instead of a second checkout form.
 */
function dealOptionRow(option: DealOption, deal: DealDetail): string {
  const list =
    option.listPriceMinor > option.payMinor
      ? `<span class="option-row-list">${esc(formatMoney(option.listPriceMinor, deal.currency, deal.precision))}</span>`
      : "";
  const line = option.promo ? promoLine(option.promo) : "";
  const save = savingOf(option, deal.currency, deal.precision);
  const action =
    option.optionId === deal.optionId
      ? `<span class="option-row-boxed">In the box above</span>`
      : option.sellable
        ? `<form class="option-row-form" method="post" action="/checkout">` +
          `<input type="hidden" name="productId" value="${esc(deal.productId)}">` +
          `<input type="hidden" name="optionId" value="${esc(option.optionId)}">` +
          `<input type="hidden" name="quantity" value="1">` +
          `${button({ label: "Get checkout link", type: "submit" })}</form>`
        : `<span class="option-row-unavailable">Not available right now</span>`;
  return (
    `<div class="option-row">` +
    `<div class="option-row-top">` +
    `<span class="option-row-title">${esc(option.title)}${line}</span>` +
    `<span class="option-row-prices">${list}<span class="option-row-pay">${esc(option.payText)}</span></span>` +
    `${action}` +
    `</div>${save}</div>`
  );
}

/** "City, ST", with either part left out when the catalogue does not have it. */
function cityState(deal: DealDetail): string {
  return [deal.city, deal.state].filter((part): part is string => !!part).join(", ");
}

export const renderDeal: PageRenderer<DealPageProps> = ({ deal, priceHistory }) => {
  const crumbs = breadcrumb([{ label: "Top deals", href: "/" }, { label: "Find a deal", href: "/find" }, { label: deal.title }]);

  const dealHero = hero({
    eyebrow: cityState(deal),
    title: deal.title,
    lead: deal.shortDescription,
    aside: deal.categoryLabels.length > 0 ? pillRow(deal.categoryLabels) : undefined,
  });

  const buy = twoColumn(image(deal), buyBox(deal));

  const tiles = tilesOf(deal.options, deal.currency, deal.precision, priceHistory.length);
  const tilesHtml = tiles.length > 0 ? statTiles(tiles, { lead: true }) : "";

  const optionRows = deal.options.map((option) => dealOptionRow(option, deal));
  const optionsBody = box({ body: optionList(optionRows) });
  const options = pageSection({
    id: "options",
    title: "Options",
    note: "Ordered by the price you pay; the cheapest is in the box above.",
    refresh: REFRESH,
    body: optionsBody,
  });

  const locations = pageSection({ title: "Locations", note: "Where the voucher is redeemed.", body: locationsBody(deal.locations) });
  const about = pageSection({
    id: "about",
    title: "About this deal",
    note: "Terms as Groupon lists them.",
    body: box({ body: `<p>${esc(deal.description)}</p>` }),
  });
  const detail = twoColumn(locations, about);

  const history = pageSection({
    title: "Price history",
    note: "Every change the delta sync saw on this deal, newest first.",
    refresh: REFRESH,
    body: priceHistoryBody(deal, priceHistory),
  });

  const body = crumbs + dealHero + buy + tilesHtml + options + detail + history;
  return shell({ title: deal.title, active: null, body });
};
