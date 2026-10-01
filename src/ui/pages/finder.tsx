/**
 * Find a deal: the sentence picker shared with Top deals, the tiles, the deal grid and its
 * promo lines, cut from design/project/Finder.dc.html and FinderPhone.dc.html.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/finder.tsx
 * Deps:    src/contracts/pages.ts, src/contracts/ports.ts, src/contracts/reports.ts, src/lib/money.ts,
 *          src/ui/components/blocks.ts, src/ui/components/card.ts, src/ui/components/shell.ts,
 *          src/ui/pages/top-deals.tsx
 * Tested:  test/ui/pages/finder.test.tsx, test/app/pages.test.ts
 */
import type { FinderPageProps, PageRenderer } from "../../contracts/pages";
import type { DealCard, SearchQuery } from "../../contracts/ports";
import type { TopCategory, TopCity } from "../../contracts/reports";
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import { dealCard } from "../components/card";
import {
  emptyState,
  hero,
  pageFoot,
  pageSection,
  pickerCard,
  sentenceBreak,
  sentenceInput,
  sentenceSelect,
  sentenceWord,
  statTiles,
  type SelectOption,
  type StatTile,
} from "../components/blocks";
import { shell } from "../components/shell";
import { nextDeltaText } from "./price-truth";
import { categoryName, placeText } from "./top-deals";

const LEAD =
  "Search Groupon deals in plain words, the same search the agent tool runs over HTTP, MCP or the command line. " +
  "Every card shows the price you pay at Groupon checkout and what you save.";

const CATALOGUE_EMPTY_SENTENCE =
  "No deals are loaded yet. The full catalogue load runs on registration and again every Monday 05:00 UTC, and a delta sync runs every 3 hours.";

const RESULTS_NOTE = "Ordered by relevance, the closest match first. The price shown is the price you pay.";

const REFRESH_NOTE = "Refreshes every 3 hours";

// One word, so it sits whole inside the 220 px field at every width (round 2, loop 5: the full
// sentence "massage, oil change, bowling" clipped to "massage, oil chan" at 1280 and worse on the phone).
const WHAT_PLACEHOLDER = "massage";

const PRICE_STEPS = [25, 50, 100, 200, 500] as const;

// ------------------------------------------------------------------ addresses

/** The place, city alone or state alone when only one was asked, "" when neither was. */
function currentPlace(query: SearchQuery): string {
  if (query.city && query.state) return placeText(query.city, query.state);
  return query.city ?? query.state ?? "";
}

/**
 * `/find?q=…&place=…&category=…&maxPrice=…`, a field left out when empty. `patch` overrides a
 * field; a key present in `patch` always wins, even set to "" or undefined, so `{ place: "" }`
 * drops the place and `{ maxPriceMinor: undefined }` drops the price.
 */
export function finderHref(
  query: SearchQuery,
  patch: { text?: string; place?: string; category1?: string; maxPriceMinor?: number } = {},
): string {
  const text = "text" in patch ? patch.text : query.text;
  const place = "place" in patch ? patch.place : currentPlace(query);
  const category1 = "category1" in patch ? patch.category1 : query.category1;
  const maxPriceMinor = "maxPriceMinor" in patch ? patch.maxPriceMinor : query.maxPriceMinor;
  const params = new URLSearchParams();
  if (text) params.set("q", text);
  if (place) params.set("place", place);
  if (category1) params.set("category", category1);
  if (maxPriceMinor !== undefined && maxPriceMinor > 0) params.set("maxPrice", String(Math.round(maxPriceMinor / 100)));
  const qs = params.toString();
  return qs ? `/find?${qs}` : "/find";
}

// ------------------------------------------------------------------ picker card

/** Prepends the asked value as its own option when it is not already in the list, so the address and the select never disagree. */
function ensureSelected(options: readonly SelectOption[], value: string, label: string): readonly SelectOption[] {
  if (value === "" || options.some((option) => option.value === value)) return options;
  return [{ value, label }, ...options];
}

function placeOptions(cities: readonly TopCity[], place: string): readonly SelectOption[] {
  const real = cities.map((city) => {
    const text = placeText(city.city, city.state);
    return { value: text, label: text };
  });
  return [{ value: "", label: "anywhere" }, ...ensureSelected(real, place, place)];
}

function categoryOptions(categories: readonly TopCategory[], category1: string): readonly SelectOption[] {
  const real = categories.map((category) => ({ value: category.category1, label: categoryName(category.category1) }));
  return [{ value: "", label: "anything" }, ...ensureSelected(real, category1, category1 ? categoryName(category1) : "")];
}

function priceOptions(maxPriceMinor: number | undefined): readonly SelectOption[] {
  const real = PRICE_STEPS.map((n) => ({ value: String(n), label: formatMoney(n, "USD", 0) }));
  if (!maxPriceMinor) return [{ value: "", label: "any price" }, ...real];
  const dollars = Math.round(maxPriceMinor / 100);
  return [{ value: "", label: "any price" }, ...ensureSelected(real, String(dollars), formatMoney(dollars, "USD", 0))];
}

/** What the picker note states: the chosen city's and category's listable counts, left out when unknown. */
function pickerNote(props: FinderPageProps): string {
  const { query, cities, categories } = props;
  const place = currentPlace(query);
  const cityEntry = cities.find((city) => placeText(city.city, city.state) === place);
  const categoryEntry = query.category1 ? categories.find((category) => category.category1 === query.category1) : undefined;
  const bits: string[] = [];
  if (cityEntry) bits.push(`${placeText(cityEntry.city, cityEntry.state)} holds ${cityEntry.listableProducts.toLocaleString("en-US")} listable deals.`);
  if (categoryEntry) bits.push(`${categoryName(categoryEntry.category1)} has ${categoryEntry.products.toLocaleString("en-US")} listed nationwide.`);
  // CEO review round 3, loop 5: the finder lists every tagged category, not only the ones with a
  // deal in the chosen city (that is Top deals' rule); the note states the finder's own rule, with
  // the real counts, instead of borrowing Top deals' sentence unexplained.
  bits.push(
    `The lists offer the ${cities.length.toLocaleString("en-US")} cities with the most deals and all ` +
      `${categories.length.toLocaleString("en-US")} of Groupon's top categories; a category with no deal ` +
      "in the chosen city answers that it has none.",
  );
  return bits.join(" ");
}

function picker(props: FinderPageProps): string {
  const { query, cities, categories } = props;
  const place = currentPlace(query);
  const category1 = query.category1 ?? "";
  const priceValue = query.maxPriceMinor ? String(Math.round(query.maxPriceMinor / 100)) : "";
  const parts = [
    sentenceWord("Find"),
    sentenceInput({ label: "What", name: "q", value: query.text, placeholder: WHAT_PLACEHOLDER }),
    sentenceWord("in"),
    sentenceSelect({ label: "City", name: "place", value: place, options: placeOptions(cities, place) }),
    sentenceBreak(),
    sentenceWord("for"),
    sentenceSelect({ label: "Category", name: "category", value: category1, options: categoryOptions(categories, category1) }),
    sentenceWord("under"),
    sentenceSelect({ label: "Price", name: "maxPrice", value: priceValue, options: priceOptions(query.maxPriceMinor) }),
  ];
  return pickerCard({ action: "/find", parts, submit: "Search", note: pickerNote(props) });
}

// ------------------------------------------------------------------ tiles

/** The saved share of one card: 0 when it carries no real discount. */
function shareOf(card: DealCard): number {
  if (card.listPriceMinor <= card.payMinor || card.listPriceMinor <= 0) return 0;
  return (card.listPriceMinor - card.payMinor) / card.listPriceMinor;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

/** The card that saves the most, by amount. Programmer error (empty `cards`) throws: both callers guard it first. */
function biggestSavingCard(cards: readonly DealCard[]): DealCard {
  const [first, ...rest] = cards;
  if (!first) throw new Error("biggestSavingCard: cards is empty");
  return rest.reduce((max, card) => (card.listPriceMinor - card.payMinor > max.listPriceMinor - max.payMinor ? card : max), first);
}

/** The card with the lowest price to pay. Programmer error (empty `cards`) throws: both callers guard it first. */
function cheapestCard(cards: readonly DealCard[]): DealCard {
  const [first, ...rest] = cards;
  if (!first) throw new Error("cheapestCard: cards is empty");
  return rest.reduce((min, card) => (card.payMinor < min.payMinor ? card : min), first);
}

/** Four tiles, in the board's order: the biggest saving (lead), the typical (median) saving, the
 * cheapest card and the promo code count. Always four: an empty list renders no tiles at all (the
 * caller's job), so every list here has at least one card. */
function tilesOf(cards: readonly DealCard[]): StatTile[] {
  const first = cards[0];
  if (!first) return [];
  const { currency, precision } = first;
  const biggest = biggestSavingCard(cards);
  const cheapest = cheapestCard(cards);
  const median = medianOf(cards.map(shareOf));
  const withPromo = cards.filter((card) => card.promo).length;
  return [
    { label: "Biggest saving", value: formatMoney(biggest.listPriceMinor - biggest.payMinor, currency, precision), hint: biggest.title },
    { label: "Typical saving", value: `${(median * 100).toFixed(1)} %`, hint: `median of the ${cards.length}` },
    { label: "Cheapest", value: formatMoney(cheapest.payMinor, currency, precision), hint: cheapest.title },
    { label: "Promo codes", value: `${withPromo} of ${cards.length}`, hint: "typed at Groupon checkout, under the deal" },
  ];
}

// ------------------------------------------------------------------ grid

/**
 * The two cards the tiles name carry that tile's label in their own filled save pill (the board's
 * card highlights), which `dealGrid` (card.ts) offers through `labelFor`.
 */
function resultsGrid(cards: readonly DealCard[]): string {
  if (cards.length === 0) return `<div class="grid"></div>`;
  const biggest = biggestSavingCard(cards);
  const cheapest = cheapestCard(cards);
  const labelFor = (deal: DealCard): string | undefined => {
    if (deal === cheapest) return "Cheapest";
    if (deal === biggest) return "Biggest saving";
    return undefined;
  };
  return `<div class="grid">${cards.map((deal, i) => dealCard(deal, { rank: i + 1, label: labelFor(deal) })).join("")}</div>`;
}

// ------------------------------------------------------------------ results section

function resultsTitle(props: FinderPageProps): string {
  const { query, cards } = props;
  let title = `${cards.length} deal${cards.length === 1 ? "" : "s"} for "${query.text}"`;
  const place = currentPlace(query);
  if (place) title += ` in ${place}`;
  if (query.category1) title += ` for ${categoryName(query.category1)}`;
  if (query.maxPriceMinor) title += ` under ${formatMoney(query.maxPriceMinor, "USD", 2)}`;
  return title;
}

/** The next steps that apply: a step is only offered for a filter that was actually asked. */
function noResultsSteps(query: SearchQuery): string {
  const steps: string[] = [];
  if (query.city || query.state) steps.push(`<a href="${esc(finderHref(query, { place: "" }))}">Try anywhere.</a>`);
  if (query.category1) steps.push(`<a href="${esc(finderHref(query, { category1: "" }))}">Try any category.</a>`);
  if (query.maxPriceMinor) steps.push(`<a href="${esc(finderHref(query, { maxPriceMinor: undefined }))}">Try any price.</a>`);
  const words = query.text.trim().split(/\s+/).filter(Boolean).length;
  if (words > 1) steps.push("Try fewer words.");
  return steps.join(" ");
}

function noResultsBlock(query: SearchQuery): string {
  let sentence = `No deals found for "${esc(query.text)}"`;
  const place = currentPlace(query);
  if (place) sentence += ` in ${esc(place)}`;
  if (query.category1) sentence += ` for ${esc(categoryName(query.category1))}`;
  if (query.maxPriceMinor) sentence += ` under ${esc(formatMoney(query.maxPriceMinor, "USD", 2))}`;
  sentence += ".";
  const steps = noResultsSteps(query);
  return `<div class="empty">${sentence}${steps ? ` ${steps}` : ""}</div>`;
}

/**
 * Today's picks keeps its fixed words outside `esc`, verbatim apostrophe included (the walkthrough
 * and the app tests read "Today's picks: " straight from the body); only the theme is escaped.
 */
function featuredSection(theme: string | null, cards: readonly DealCard[]): string {
  const title = theme ? `Today's picks: ${esc(theme)}` : "";
  const refresh = `<span class="refresh-note">${esc(REFRESH_NOTE)}</span>`;
  const head = `<div class="results-head"><h2 class="section-title section-title--rule">${title}</h2>${refresh}<p class="results-note">${esc(RESULTS_NOTE)}</p></div>`;
  return `<section class="page-section">${head}${resultsGrid(cards)}</section>`;
}

function resultsSection(props: FinderPageProps): string {
  if (props.listableDeals === 0) return emptyState(CATALOGUE_EMPTY_SENTENCE);
  if (!props.searched) return featuredSection(props.featuredTheme, props.cards);
  if (props.cards.length === 0) return noResultsBlock(props.query);
  return pageSection({ title: resultsTitle(props), note: RESULTS_NOTE, refresh: REFRESH_NOTE, body: resultsGrid(props.cards) });
}

// ------------------------------------------------------------------ page

export const renderFinder: PageRenderer<FinderPageProps> = (props) => {
  const tiles = props.cards.length > 0 ? statTiles(tilesOf(props.cards), { panel: true, lead: true }) : "";
  const body =
    hero({ eyebrow: "Product 3 · Agent shopping tool", title: "Find a deal", lead: LEAD }) +
    picker(props) +
    tiles +
    resultsSection(props) +
    pageFoot(`Prices refresh every 3 hours; the next delta sync runs at ${nextDeltaText(props.now)}.`);
  return shell({ title: "Find a deal", active: "finder", body });
};
