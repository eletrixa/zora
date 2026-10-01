/**
 * Top deals: the city/category/tag picker, the tiles, the podium, the ranked table and the promo
 * promo lines, cut from design/project/TopDeals.dc.html and TopDealsPhone.dc.html (loop 5, round 2).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/top-deals.tsx
 * Deps:    src/contracts/pages.ts, src/contracts/reports.ts, src/lib/money.ts, src/ui/components/blocks.ts,
 *          src/ui/components/shell.ts, src/ui/pages/price-truth.tsx
 * Tested:  test/ui/pages/top-deals.test.tsx
 */
import type { PageRenderer, TopDealsPageProps } from "../../contracts/pages";
import type { TopDealRow, TopDealsQuery, TopDealsReport, TopDealsSort } from "../../contracts/reports";
import { formatMoney } from "../../lib/money";
import {
  emptyState,
  hero,
  pageFoot,
  pageSection,
  pickerCard,
  podiumCard,
  rankList,
  rankRow,
  sentenceSelect,
  sentenceWord,
  sortToggle,
  statTiles,
  type SelectOption,
  type StatTile,
} from "../components/blocks";
import { shell } from "../components/shell";
import { nextDeltaText } from "./price-truth";

export const TOP_N = 20;

/** "2026-09-30T20:05:35.228Z" as "2026-09-30 20:05 UTC"; anything else as given. */
export const utcText = (iso: string): string => (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso) ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso);

/** The category walk and the city refresh both run daily at this time; keep in step with src/cron.ts. */
export const WALK_TIME_TEXT = "00:30 UTC";

const LEAD =
  "The 20 Groupon deals that save the most in one city and one category, by amount or by percent. " +
  "Saving means the original price minus the price you pay at Groupon checkout, before any sales tax.";

const NO_CITIES_SENTENCE = `No deals are loaded yet. The full catalogue load runs every Monday 05:00 UTC and a delta sync every 3 hours; the city list follows at ${WALK_TIME_TEXT}.`;
const NO_CATEGORIES_SENTENCE = `Categories appear after the first category walk, tonight at ${WALK_TIME_TEXT}.`;

const SORT_OPTIONS: readonly { key: TopDealsSort; label: string }[] = [
  { key: "amount", label: "By amount saved" },
  { key: "percent", label: "By percent saved" },
];

const ORDER_NOUN: Readonly<Record<TopDealsSort, string>> = { amount: "the amount you save", percent: "the percent you save" };

const RANK_HEAD = ["#", "Deal", "Original", "You pay", "You save", "Saved"] as const;

// ------------------------------------------------------------------ names and addresses

/** Irregular names only: an ampersand, an apostrophe, a comma or a dropped prefix. Every other known
 * category1 slug already comes out right from the generic Title Case rule below. */
const CATEGORY_NAMES: Readonly<Record<string, string>> = {
  "things-to-do": "Things To Do",
  "beauty-and-spas": "Beauty & Spas",
  "food-and-drink": "Food & Drink",
  "health-and-fitness": "Health & Fitness",
  "auto-and-home-improvement": "Auto & Home Improvement",
  "baby-kids-and-toys": "Baby, Kids & Toys",
  "mens-clothing-shoes-and-accessories": "Men's Clothing, Shoes & Accessories",
  "womens-clothing-shoes-and-accessories": "Women's Clothing, Shoes & Accessories",
  "v1-personalized-items": "Personalized Items",
};

/** A category1 slug to its display name: the irregular map above, else Title Case with "and" as "&". */
export function categoryName(slug: string): string {
  const known = CATEGORY_NAMES[slug];
  if (known) return known;
  return slug
    .split("-")
    .map((word) => (word === "and" ? "&" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function placeText(city: string, state: string): string {
  return `${city}, ${state}`;
}

/** Builds a home page link carrying category, label, place and sort, patch applied over query. */
export function topDealsHref(query: TopDealsQuery, patch: Partial<TopDealsQuery> = {}): string {
  const merged = { ...query, ...patch };
  const params = new URLSearchParams();
  if (merged.category1) params.set("category", merged.category1);
  if (merged.label) params.set("label", merged.label);
  params.set("place", placeText(merged.city, merged.state));
  params.set("sort", merged.sort);
  return `/?${params.toString()}`;
}

// ------------------------------------------------------------------ picker card

/** Prepends the asked value as its own option when it is not already in the list, so the URL and the select never disagree. */
function ensureSelected(options: readonly SelectOption[], value: string, label: string): readonly SelectOption[] {
  return options.some((option) => option.value === value) ? options : [{ value, label }, ...options];
}

/** Plain text: pickerCard escapes the whole note as one string. */
function pickerNote(report: TopDealsReport, query: TopDealsQuery): string {
  const place = placeText(query.city, query.state);
  const cityEntry = report.cities.find((city) => city.city === query.city && city.state === query.state);
  const categoryEntry = query.category1 ? report.categories.find((category) => category.category1 === query.category1) : undefined;
  let sentence = place;
  if (cityEntry) {
    sentence += ` holds ${cityEntry.listableProducts.toLocaleString("en-US")} listable deals`;
    if (categoryEntry && query.category1) {
      sentence += `, ${categoryEntry.products.toLocaleString("en-US")} of them in ${categoryName(query.category1)}`;
    }
  }
  sentence += ".";
  return (
    `${sentence} A tag narrows the category to one of Groupon's own deal tags, such as Food Tours. ` +
    `The lists offer the ${report.cities.length.toLocaleString("en-US")} cities with the most deals and ` +
    `the ${report.categories.length.toLocaleString("en-US")} categories with deals in ${place}.`
  );
}

function pickerForm(report: TopDealsReport, query: TopDealsQuery): string {
  const place = placeText(query.city, query.state);
  const cityOptions = ensureSelected(
    report.cities.map((city) => {
      const text = placeText(city.city, city.state);
      return { value: text, label: text };
    }),
    place,
    place,
  );
  const plainCategoryOptions = report.categories.map((category) => ({ value: category.category1, label: categoryName(category.category1) }));
  const categoryOptions = query.category1 ? ensureSelected(plainCategoryOptions, query.category1, categoryName(query.category1)) : plainCategoryOptions;
  const labelOptions = ensureSelected(
    [{ value: "", label: "any tag" }, ...report.labels.map((label) => ({ value: label.label, label: label.label }))],
    query.label ?? "",
    query.label ?? "",
  );
  return pickerCard({
    action: "/",
    parts: [
      sentenceWord(`Top ${TOP_N} deals`),
      sentenceWord("in"),
      sentenceSelect({ label: "City", name: "place", value: place, options: cityOptions }),
      sentenceWord("for"),
      sentenceSelect({ label: "Category", name: "category", value: query.category1 ?? "", options: categoryOptions }),
      sentenceWord("within"),
      sentenceSelect({ label: "Tag", name: "label", value: query.label ?? "", options: labelOptions }),
    ],
    submit: "Show",
    note: pickerNote(report, query),
    hidden: [{ name: "sort", value: query.sort }],
  });
}

// ------------------------------------------------------------------ tiles

function biggestSavingRow(rows: readonly TopDealRow[]): TopDealRow | undefined {
  return rows.reduce<TopDealRow | undefined>((max, row) => (!max || row.discountMinor > max.discountMinor ? row : max), undefined);
}

function tilesOf(rows: readonly TopDealRow[]): StatTile[] {
  const first = rows[0];
  if (!first) return [];
  const { currency, precision } = first;
  const biggest = biggestSavingRow(rows) ?? first;
  const shares = rows.map((row) => row.discountShare).sort((a, b) => a - b);
  const mid = Math.floor(shares.length / 2);
  const median = shares.length % 2 === 0 ? ((shares[mid - 1] ?? 0) + (shares[mid] ?? 0)) / 2 : (shares[mid] ?? 0);
  const totalSavedMinor = rows.reduce((sum, row) => sum + row.discountMinor, 0);
  const withPromo = rows.filter((row) => row.promo).length;
  return [
    { label: "Biggest saving", value: formatMoney(biggest.discountMinor, currency, precision), hint: biggest.title },
    { label: "Typical saving", value: `${(median * 100).toFixed(1)} %`, hint: `median of the top ${rows.length}` },
    { label: "Total saving", value: formatMoney(totalSavedMinor, currency, precision), hint: "buying one of each" },
    { label: "Promo codes", value: `${withPromo} of ${rows.length}`, hint: "typed at Groupon checkout, under the deal" },
  ];
}

// ------------------------------------------------------------------ podium and ranked rows

function podium(rows: readonly TopDealRow[], biggest: TopDealRow | undefined): string {
  const cards = rows.map((row) =>
    podiumCard({
      rank: row.rank,
      href: `/deals/${row.productId}`,
      title: row.title,
      optionTitle: row.optionTitle,
      imageUrl: row.imageUrl ?? undefined,
      payText: formatMoney(row.payMinor, row.currency, row.precision),
      originalText: formatMoney(row.originalMinor, row.currency, row.precision),
      saveText: formatMoney(row.discountMinor, row.currency, row.precision),
      sharePct: row.discountShare * 100,
      promo: row.promo ?? undefined,
      winner: row.rank === 1,
      // The winner's pill is always filled; a non-winner card is filled only when it is also the
      // deal the "Biggest saving" tile names (true whenever the list is sorted by amount, not always
      // when it is sorted by percent).
      label: biggest && row.productId === biggest.productId ? "Biggest saving" : undefined,
    }),
  );
  return `<div class="podium">${cards.join("")}</div>`;
}

function rankRowHtml(row: TopDealRow): string {
  const sharePct = row.discountShare * 100;
  return rankRow({
    rank: row.rank,
    href: `/deals/${row.productId}`,
    title: row.title,
    optionTitle: row.optionTitle,
    promo: row.promo ?? undefined,
    cells: [
      { label: "Original", kind: "original", text: formatMoney(row.originalMinor, row.currency, row.precision) },
      { label: "You pay", kind: "pay", text: formatMoney(row.payMinor, row.currency, row.precision) },
      { label: "You save", kind: "save", text: formatMoney(row.discountMinor, row.currency, row.precision) },
      { label: "Saved", kind: "bar", text: `${sharePct.toFixed(1)} %`, pct: sharePct },
    ],
  });
}

function rankListBox(rest: readonly TopDealRow[], total: number): string {
  if (rest.length === 0) return "";
  const title = total === 4 ? "Rank 4" : `Ranks 4 to ${total}`;
  return rankList({ head: RANK_HEAD, rows: rest.map(rankRowHtml), title });
}

function resultsBody(rows: readonly TopDealRow[]): string {
  const biggest = biggestSavingRow(rows);
  return podium(rows.slice(0, 3), biggest) + rankListBox(rows.slice(3), rows.length);
}

// ------------------------------------------------------------------ results section

function noRowsBody(report: TopDealsReport, query: TopDealsQuery, where: string, catName: string): string {
  if (query.label) {
    const href = topDealsHref(query, { label: undefined });
    return emptyState(`No discounted deals in ${where} for ${query.label}.`, { label: `Try the whole of ${catName}`, href });
  }
  const otherCity = report.cities.find((city) => !(city.city === query.city && city.state === query.state));
  if (otherCity) {
    const otherPlace = placeText(otherCity.city, otherCity.state);
    const href = topDealsHref(query, { city: otherCity.city, state: otherCity.state });
    return emptyState(`No discounted deals in ${where} for ${catName}.`, { label: `Try ${otherPlace}`, href });
  }
  return emptyState(`No discounted deals in ${where} for ${catName}.`);
}

function resultsSection(report: TopDealsReport, query: TopDealsQuery): string {
  const rows = report.rows;
  const where = placeText(query.city, query.state);
  const catName = query.category1 ? categoryName(query.category1) : "";
  const what = query.label ? `${query.label} (${catName})` : catName;
  const n = rows.length;
  const heading =
    n >= TOP_N
      ? `Top ${TOP_N} in ${where}: ${what}`
      : n > 0
        ? `All ${n} discounted deal${n === 1 ? "" : "s"} in ${where}: ${what}`
        : `${what} in ${where}`;
  const aside = `<div class="sort-wrap"><span>Sort</span>${sortToggle({
    options: SORT_OPTIONS,
    current: query.sort,
    hrefFor: (key) => topDealsHref(query, { sort: key as TopDealsSort }),
  })}</div>`;
  const body = n === 0 ? noRowsBody(report, query, where, catName) : resultsBody(rows);
  // The head, the sort and the podium sit flush on the page (pageSection, not a bordered box);
  // only the ranked list sits in a box (rankList builds that box itself).
  return pageSection({
    title: heading,
    aside,
    note: `Ordered by ${ORDER_NOUN[query.sort]}, largest first; one row per deal`,
    refresh: "Refreshes every 3 hours",
    body,
  });
}

// ------------------------------------------------------------------ footer and page

function footerLine(report: TopDealsReport, now: number): string {
  const walkClause = report.taggedAt ? `last walk ${utcText(report.taggedAt)}` : "first walk pending";
  return pageFoot(
    `Prices refresh every 3 hours; the next delta sync runs at ${nextDeltaText(now)}. ` +
      `The city list and the category tags refresh daily at ${WALK_TIME_TEXT}; ${walkClause}.`,
  );
}

export const renderTopDeals: PageRenderer<TopDealsPageProps> = ({ report, now }) => {
  const heroHtml = hero({ eyebrow: "Product 4 · an AI Builder showcase", title: "Top deals", lead: LEAD });
  const query = report.query;
  let content: string;
  if (report.cities.length === 0) {
    content = emptyState(NO_CITIES_SENTENCE);
  } else if (query === null || report.taggedAt === null) {
    // No complete category walk yet: nothing can be picked, so there is no picker to point back at;
    // the only true next step is to come back once the walk has run.
    content = emptyState(NO_CATEGORIES_SENTENCE, { label: "Show the top 20 after the walk", href: "/" });
  } else {
    const rows = report.rows;
    const tiles = rows.length > 0 ? statTiles(tilesOf(rows), { panel: true, lead: true }) : "";
    content = pickerForm(report, query) + tiles + resultsSection(report, query);
  }
  return shell({ title: "Top deals", active: "top-deals", body: heroHtml + content + footerLine(report, now) });
};
