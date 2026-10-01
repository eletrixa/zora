/**
 * Pages and their JSON twins. Integrator-owned: pages are pure renderers in src/ui/pages/, this
 * file fetches the data, hands it over and applies the look the visitor chose (the zal_theme
 * cookie, set by POST /theme). Top deals is the home page; the finder lives at /find.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/routes.ts
 * Deps:    hono, hono/cookie, src/ui/pages/*, src/contracts
 * Tested:  test/app/pages.test.ts
 */
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../contracts/env";
import type { SearchQuery } from "../contracts/ports";
import type { TopDealsQuery } from "../contracts/reports";
import { PRIVATE_HEADERS } from "../lib/http";
import { renderCheckout } from "./pages/checkout";
import { renderDeal } from "./pages/deal";
import { renderFinder } from "./pages/finder";
import { renderNotFound } from "./pages/not-found";
import { renderPriceTruth } from "./pages/price-truth";
import { renderScorecard } from "./pages/scorecard";
import { renderTopDeals } from "./pages/top-deals";

const REPORT_DAYS = 30;

// ------------------------------------------------------------------ the look

export type Theme = "lab" | "pixel";
export const THEME_COOKIE = "zal_theme";
const THEME_MAX_AGE_SECONDS = 365 * 24 * 3600;

/** Only the two known looks; anything else is the default. */
export const themeOf = (value: string | undefined): Theme => (value === "pixel" ? "pixel" : "lab");

/** The chosen look reaches the document as data-theme on <html>, so the stylesheet applies it before any script runs. */
export function withTheme(html: string, theme: Theme): string {
  return theme === "lab" ? html : html.replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`);
}

/** A safe return path for the switch: one leading slash, never a scheme or a protocol-relative address. */
export const nextPathOf = (value: unknown): string => (typeof value === "string" && /^\/(?!\/)/.test(value) && value.length <= 500 ? value : "/");

// ------------------------------------------------------------------ helpers

const page = async (c: Context<AppEnv>, body: string | Promise<string>, status: 200 | 404 = 200): Promise<Response> =>
  new Response(withTheme(await body, themeOf(getCookie(c, THEME_COOKIE))), {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });

const privateHeaders = (c: Context<AppEnv>): void => {
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) c.header(name, value);
};

const text = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
};

/** "New York, NY" to its parts; anything else names no place. */
const PLACE = /^(.*\S)\s*,\s*([A-Za-z]{2})$/;

/**
 * The finder's request. `place` ("City, ST", the picker shared with Top deals) wins over the older
 * `city` and `state` fields; `category` is a category1 slug, the same word as on Top deals.
 */
export function queryOf(params: Readonly<Record<string, string | undefined>>): SearchQuery {
  const maxPrice = Number(params["maxPrice"]);
  const limit = Number(params["limit"]);
  const place = PLACE.exec(text(params["place"]) ?? "");
  return {
    text: text(params["q"]) ?? "",
    state: place?.[2]?.toUpperCase() ?? text(params["state"]),
    city: place?.[1] ?? text(params["city"]),
    category1: text(params["category"]),
    maxPriceMinor: Number.isFinite(maxPrice) && maxPrice > 0 ? Math.round(maxPrice * 100) : undefined,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : undefined,
  };
}

const DEFAULT_CATEGORY = "things-to-do";

/**
 * The top deals request. Without a `category` parameter at all the page opens on things-to-do; an empty one
 * means every category. The sort is only ever one of the two known keys.
 */
export function topDealsQueryOf(params: Readonly<Record<string, string | undefined>>): TopDealsQuery {
  const place = PLACE.exec(text(params["place"]) ?? "");
  const category = params["category"] === undefined ? DEFAULT_CATEGORY : text(params["category"]);
  return {
    city: place?.[1] ?? "",
    state: place?.[2]?.toUpperCase() ?? "",
    category1: category,
    label: text(params["label"]),
    sort: params["sort"] === "percent" ? "percent" : "amount",
  };
}

const hasCriteria = (query: SearchQuery): boolean => Boolean(query.text || query.state || query.city || query.category1 || query.maxPriceMinor);

/** One theme per day, so the finder always opens with real deals and the picks change daily. */
const FEATURED_THEMES = ["massage", "dinner", "spa", "car wash", "yoga", "photography", "cleaning", "dental", "golf", "wine"] as const;
const FEATURED_LIMIT = 9;

export function featuredTheme(now: number): string {
  const day = Math.floor(now / 86_400_000);
  return FEATURED_THEMES[day % FEATURED_THEMES.length] ?? FEATURED_THEMES[0];
}

// ------------------------------------------------------------------ routes

export const pages = new Hono<AppEnv>();

pages.get("/", async (c) =>
  page(c, renderTopDeals({ report: await c.var.reports.topDeals.report(topDealsQueryOf(c.req.query())), now: c.var.deps.clock.now() })),
);

/** The old address of the home page: a permanent redirect that keeps the query string. */
pages.get("/top-deals", (c) => {
  privateHeaders(c);
  return c.redirect(`/${new URL(c.req.url).search}`, 301);
});

pages.get("/find", async (c) => {
  const query = queryOf(c.req.query());
  const searched = hasCriteria(query);
  const [{ listable }, pickers] = await Promise.all([c.var.deps.catalogue.countProducts(), c.var.reports.topDeals.pickers()]);
  const base = { query, searched, cities: pickers.cities, categories: pickers.categories, now: c.var.deps.clock.now() };
  // An empty catalogue cannot answer; searching it would only log a miss that is no miss.
  if (listable === 0) return page(c, renderFinder({ ...base, cards: [], listableDeals: 0, featuredTheme: null }));
  if (searched) return page(c, renderFinder({ ...base, cards: await c.var.deps.shopping.searchDeals(query, "web"), listableDeals: listable, featuredTheme: null }));
  const theme = featuredTheme(c.var.deps.clock.now());
  const cards = await c.var.deps.shopping.searchDeals({ text: theme, limit: FEATURED_LIMIT }, "web");
  return page(c, renderFinder({ ...base, cards, listableDeals: listable, featuredTheme: theme }));
});

/** The look switch: remembers the choice for a year and returns to the page it was pressed on. */
pages.post("/theme", async (c) => {
  const form = await c.req.parseBody();
  const theme = themeOf(typeof form["theme"] === "string" ? form["theme"] : undefined);
  setCookie(c, THEME_COOKIE, theme, { path: "/", maxAge: THEME_MAX_AGE_SECONDS, sameSite: "Lax" });
  privateHeaders(c);
  return c.redirect(nextPathOf(form["next"]), 303);
});

pages.get("/deals/:productId", async (c) => {
  const productId = c.req.param("productId");
  const deal = await c.var.deps.shopping.getDeal(productId);
  if (!deal) return page(c, renderNotFound({ path: c.req.path }), 404);
  const priceHistory = await c.var.deps.catalogue.priceHistory(productId, 50);
  return page(c, renderDeal({ deal, priceHistory }));
});

pages.post("/checkout", async (c) => {
  const form = await c.req.parseBody();
  const quantity = Number(form["quantity"] ?? 1);
  const result = await c.var.deps.shopping.createCheckoutLink(
    [{ productId: String(form["productId"] ?? ""), optionId: String(form["optionId"] ?? ""), quantity: Number.isInteger(quantity) ? quantity : 1 }],
    "web",
  );
  return page(c, renderCheckout({ result }));
});

pages.get("/price-truth", async (c) =>
  page(c, renderPriceTruth({ report: await c.var.reports.priceTruth.report(REPORT_DAYS), sync: await c.var.reports.syncStatus(), now: c.var.deps.clock.now() })),
);

pages.get("/scorecard", async (c) =>
  page(c, renderScorecard({ report: await c.var.reports.scorecard.report(REPORT_DAYS), sync: await c.var.reports.syncStatus(), now: c.var.deps.clock.now() })),
);

pages.get("/data/top-deals.json", async (c) => c.json(await c.var.reports.topDeals.report(topDealsQueryOf(c.req.query())), 200, PRIVATE_HEADERS));
pages.get("/data/pickers.json", async (c) => c.json(await c.var.reports.topDeals.pickers(), 200, PRIVATE_HEADERS));
pages.get("/data/price-truth.json", async (c) => c.json(await c.var.reports.priceTruth.report(REPORT_DAYS), 200, PRIVATE_HEADERS));
pages.get("/data/scorecard.json", async (c) => c.json(await c.var.reports.scorecard.report(REPORT_DAYS), 200, PRIVATE_HEADERS));
pages.get("/data/sync.json", async (c) => c.json(await c.var.reports.syncStatus(), 200, PRIVATE_HEADERS));
