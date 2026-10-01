#!/usr/bin/env bun
/**
 * The acceptance walkthrough: opens every page and every API call a user
 * or an agent would, and asserts what each must show (docs/ops/loop3.md, loop4.md and loop5.md,
 * "what working means"). Top deals is the home page, the finder lives at /find.
 * Every miss is printed; the exit code is 1 when any check missed, 0 when all passed.
 *
 * Usage: bin/walkthrough [host] [--no-carts]
 *   host       defaults to https://zorasocial.asajj.cz; use http://localhost:8787 for wrangler dev
 *   --no-carts skips the two checks that create a cart at Groupon (web checkout, API checkout)
 *
 * Secret: ZAL_AGENT_TOKEN from the environment, else from ~/s/.env.master by name. Never printed.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  bin/walkthrough.ts
 * Deps:    bun (fetch), ~/s/.env.master
 * Tested:  n/a (this script is the check; it needs the live host)
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_HOST = "https://zorasocial.asajj.cz";
const SEARCH_TEXT = "massage in Chicago";

interface DealCard {
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly payText: string;
  readonly promo: { readonly code: string | null; readonly instruction: string } | null;
}

function readSecret(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  const vault = process.env["ZAL_VAULT"] ?? join(homedir(), "s", ".env.master");
  for (const line of readFileSync(vault, "utf8").split("\n")) {
    if (!line.startsWith(`${name}=`)) continue;
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`${name} is not in the environment or the vault`);
}

const args = process.argv.slice(2);
const noCarts = args.includes("--no-carts");
const host = (args.find((a) => !a.startsWith("--")) ?? DEFAULT_HOST).replace(/\/$/, "");
const agentToken = readSecret("ZAL_AGENT_TOKEN");

const misses: string[] = [];
let passed = 0;

async function check(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`ok    ${name}`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    misses.push(`${name}: ${message}`);
    console.log(`MISS  ${name}: ${message}`);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

async function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${host}${path}`, { headers, redirect: "manual" });
}

async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${host}${path}`, { ...init, headers: { authorization: `Bearer ${agentToken}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: response.status, body: (await response.json()) as T };
}

async function postForm(path: string, fields: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(fields);
  return fetch(`${host}${path}`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" }, redirect: "manual" });
}

const randomUuid = (): string => crypto.randomUUID();
const today = new Date().toISOString().slice(0, 10);
/** The days that count as today's run: the daily cart sample, public comparison and probe run between 04:00 and
 *  04:30 UTC, so before 05:00 UTC yesterday's run is the newest one there can be. */
const freshDays: readonly string[] = new Date().getUTCHours() < 5 ? [today, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)] : [today];
const hasFreshDay = (text: string): boolean => freshDays.some((day) => text.includes(day));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-30" as the boards write a day in a card title: "30 Sep". */
const shortDay = (day: string): string => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
/** A Price truth section names today's sample in its table or, as the board draws it, in "Latest day: 30 Sep". */
const hasFreshLatestDay = (text: string): boolean =>
  hasFreshDay(text) || freshDays.some((day) => text.includes(`Latest day: ${shortDay(day)}`));

// ---------------------------------------------------------------- crawlers
await check("robots.txt disallows everything and every answer carries noindex", async () => {
  const robots = await get("/robots.txt");
  expect(robots.status === 200, `robots.txt status ${robots.status}`);
  expect((await robots.text()).includes("Disallow: /"), "robots.txt does not disallow /");
  for (const path of ["/", "/static/app.css", "/logo.png"]) {
    const tag = (await get(path)).headers.get("x-robots-tag") ?? "";
    expect(tag.includes("noindex"), `${path} has no noindex header`);
  }
});

await check("the finder has nothing for a password manager to save", async () => {
  const html = await (await get("/find")).text();
  expect(!html.includes('type="password"'), "a password field is present");
  expect(html.includes("data-1p-ignore") && html.includes('autocomplete="off"'), "password managers are not told to leave the field alone");
});

// ---------------------------------------------------------------- finder
await check("the finder opens with today's picks, never an empty page", async () => {
  const html = await (await get("/find")).text();
  expect(html.includes("Today's picks"), "no picks heading");
  expect(count(html, 'href="/deals/') >= 3, `${count(html, 'href="/deals/')} deal links, expected at least 3`);
  expect(!html.includes("No deals are loaded yet") && !html.includes("No deals found"), "the page says nothing is loaded");
});

let cards: readonly DealCard[] = [];
await check(`GET /api/v1/search "${SEARCH_TEXT}" returns at least 3 deals with the price rule`, async () => {
  const { status, body } = await api<{ deals: DealCard[] }>(`/api/v1/search?q=${encodeURIComponent(SEARCH_TEXT)}&limit=10`);
  expect(status === 200, `status ${status}`);
  cards = body.deals;
  expect(cards.length >= 3, `${cards.length} deals`);
  for (const card of cards) {
    expect(/^\$\d/.test(card.payText), `payText "${card.payText}" is not a dollar price`);
    if (card.promo) expect(card.promo.instruction.includes("Type code") && card.promo.instruction.includes("at Groupon checkout"), `promo instruction "${card.promo.instruction}"`);
  }
  expect(cards.some((card) => card.city === "Chicago"), "no card in Chicago");
});

await check(`the finder page for "${SEARCH_TEXT}" shows cards with price, promo sentence, city and state`, async () => {
  const html = await (await get(`/find?q=${encodeURIComponent(SEARCH_TEXT)}`)).text();
  expect(count(html, 'href="/deals/') >= 3, `${count(html, 'href="/deals/')} deal links, expected at least 3`);
  expect(html.includes("Chicago"), "no city on the page");
  expect(/\bIL\b/.test(html), "no state code on the page");
  expect(count(html, "$") >= 3, "fewer than three prices on the page");
  expect(html.includes("Type code") || cards.every((card) => card.promo === null), "no promo sentence although deals carry a promo");
});

// ---------------------------------------------------------------- deal page
const first = cards[0];
await check("the deal page shows options with prices, locations, terms, price history and a checkout button per option", async () => {
  expect(first !== undefined, "no deal to open");
  const response = await get(`/deals/${first!.productId}`);
  const html = await response.text();
  expect(response.status === 200, `status ${response.status}`);
  expect(html.includes(first!.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").slice(0, 30)), "the title is missing");
  expect(count(html, 'action="/checkout"') >= 1, "no checkout form");
  expect(count(html, "$") >= 1, "no price");
  expect(/Chicago|IL\b/.test(html), "no location");
  expect(/[Pp]rice history/.test(html), "no price history line");
  expect(/[Tt]erms|[Ff]ine print|[Aa]bout this deal/.test(html), "no terms section");
});

await check("GET /api/v1/deals/:id answers the same deal", async () => {
  expect(first !== undefined, "no deal to open");
  const { status, body } = await api<{ productId: string; options: unknown[]; locations: unknown[] }>(`/api/v1/deals/${first!.productId}`);
  expect(status === 200, `status ${status}`);
  expect(body.productId === first!.productId && body.options.length >= 1, "wrong deal or no options");
});

// ---------------------------------------------------------------- checkout
if (noCarts) {
  console.log("skip  web checkout and API checkout (--no-carts)");
} else {
  await check("POST /checkout shows the total and one button with buyLink verbatim, or the new price", async () => {
    expect(first !== undefined, "no deal to buy");
    const response = await postForm("/checkout", { productId: first!.productId, optionId: first!.optionId, quantity: "1" });
    const html = await response.text();
    expect(response.status === 200, `status ${response.status}`);
    if (html.includes("price changed") || html.includes("The price changed")) {
      expect(count(html, "$") >= 1, "the new price is missing");
      return;
    }
    const links = count(html, 'href="https://partner.groupon.com');
    expect(links === 1, `${links} Groupon links, expected exactly one`);
    expect(/Total[^$]*\$\d/.test(html), "no total");
  });

  await check("POST /api/v1/checkout returns a partner.groupon.com link with the total", async () => {
    expect(first !== undefined, "no deal to buy");
    const { status, body } = await api<{ kind: string; buyLink?: string; totalText?: string; nowText?: string }>("/api/v1/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: first!.productId, optionId: first!.optionId, quantity: 1 }] }),
    });
    if (body.kind === "price_changed") {
      expect(status === 409 && typeof body.nowText === "string", "price_changed without the new price");
      return;
    }
    expect(status === 200 && body.kind === "link", `status ${status}, kind ${body.kind}`);
    expect((body.buyLink ?? "").startsWith("https://partner.groupon.com"), `buyLink ${body.buyLink}`);
    expect(/^\$\d/.test(body.totalText ?? ""), `totalText ${body.totalText}`);
  });
}

// ---------------------------------------------------------------- return page
await check("the return page waits and polls for an order Groupon does not know yet", async () => {
  const uuid = randomUuid();
  const response = await fetch(`${host}/3pd/return?grouponOrderUuid=${uuid}`);
  const html = await response.text();
  expect(response.status === 200, `status ${response.status}`);
  expect(html.includes("confirming your order"), "not the waiting page");
  expect(html.includes("/static/return.js"), "the page does not poll");
  const status = await fetch(`${host}/3pd/return/status?grouponOrderUuid=${uuid}`);
  expect(status.status === 200, `status endpoint answered ${status.status}`);
  const body = (await status.json()) as { kind: string };
  expect(body.kind === "not_found" || body.kind === "order", `poll answered kind ${body.kind}`);
});

await check("GET /api/v1/orders/:uuid answers not_found for an unknown order", async () => {
  const { status, body } = await api<{ kind: string }>(`/api/v1/orders/${randomUuid()}`);
  expect(status === 404 && body.kind === "not_found", `status ${status}, kind ${body.kind}`);
});

// ---------------------------------------------------------------- price truth
await check("the price truth page has today's numbers in all four sections", async () => {
  const html = await (await get("/price-truth")).text();
  expect(!html.includes("No snapshot yet") && !html.includes("No data yet"), "a section says there is no data");
  expect(/carry a promo code/.test(html) && /median/.test(html), "the promo gap sentence is missing");
  expect(/largest gaps/i.test(html), "no worst-deals section");
  const section = (title: string): string => html.slice(html.indexOf(title));
  expect(hasFreshLatestDay(section("API against groupon.com")), `no public comparison row for ${freshDays.join(" or ")}`);
  expect(hasFreshLatestDay(section("Catalogue against cart")), `no cart sample row for ${freshDays.join(" or ")}`);
  expect(/Freshness/.test(html) && (/\d\d:\d\d UTC/.test(section("Freshness")) || hasFreshDay(section("Freshness"))), "freshness names neither a next run time nor a day row");
});

// CEO review round 2 (loop 5) rejected the site for nine bands of 0 printed beside "144,772 of 154,038
// sellable options carry a promo code": a missing histogram must say so, never print measured zeros.
await check("Price truth's Options by gap bands add up to its caption's promo count, or say when they arrive", async () => {
  const html = await (await get("/price-truth")).text();
  const box = html.slice(html.indexOf("Options by gap"), html.indexOf("largest gaps"));
  const caption = /([\d,]+) of [\d,]+ sellable options carry a promo code/.exec(html);
  expect(caption !== null, "the promo gap caption is missing");
  const bands = [...box.matchAll(/class="histogram-value">([\d,]+)</g)].map((m) => Number(m[1]!.replace(/,/g, "")));
  if (bands.length === 0) {
    expect(/\d\d:\d\d UTC/.test(box), "no histogram and no time it arrives");
    return;
  }
  const sum = bands.reduce((a, b) => a + b, 0);
  const promo = Number(caption![1]!.replace(/,/g, ""));
  expect(sum === promo, `the ${bands.length} bands sum to ${sum.toLocaleString("en-US")}, the caption says ${promo.toLocaleString("en-US")}`);
});

// ---------------------------------------------------------------- scorecard
await check("the scorecard shows today's run with age, pass rate, failing steps, latency and findings", async () => {
  const html = await (await get("/scorecard")).text();
  expect(html.includes("Last probe run") && html.includes("ago"), "no run age");
  expect(hasFreshDay(html), `no run from ${freshDays.join(" or ")}`);
  expect(/[Pp]ass rate|Steps, \d+ days/.test(html), "no pass rate");
  expect(/p95|95th/.test(html), "no latency per endpoint");
  expect(html.includes("F-001") && html.includes("F-002"), "findings F-001 and F-002 are missing");
  expect(/state-code/.test(html) && /guide/.test(html), "the failing step and the guide sentence are missing");
});

// ---------------------------------------------------------------- top deals
const TOP_CITY = "New York, NY";
const TOP_CATEGORY = "beauty-and-spas";
const topDealsPath = (query: Record<string, string>): string => `/?${new URLSearchParams(query).toString()}`;
/** The page's deals in rank order: the three podium cards and the ranked rows, each marked data-rank. */
const dealsOf = (html: string): string[] => html.split(/(?=data-rank=")/).slice(1);
const rankOf = (deal: string): number => Number(/^data-rank="(\d+)"/.exec(deal)?.[1] ?? 0);
const money = (text: string | undefined): number => Number((text ?? "").replace(/[^0-9.]/g, ""));
interface DealPrices { readonly original: number; readonly pay: number; readonly save: number; readonly pct: number }
const pricesOf = (deal: string): DealPrices => ({
  original: money(/data-label="Original"[^>]*>\s*(?:<s[^>]*>)?(\$[\d,.]+)/.exec(deal)?.[1]),
  pay: money(/data-label="You pay"[^>]*>(\$[\d,.]+)/.exec(deal)?.[1]),
  save: money(/data-label="You save"[^>]*>[^<$]*(\$[\d,.]+)/.exec(deal)?.[1]),
  pct: Number(/(\d+\.\d) %/.exec(deal)?.[1] ?? "0"),
});

await check("the home page opens with Top deals: 20 real deals for the default pair, never empty", async () => {
  const response = await get("/");
  const html = await response.text();
  expect(response.status === 200, `status ${response.status}`);
  expect(/Top 20 in [^<]+: Things To Do/.test(html), "no Top 20 heading for Things To Do");
  expect(dealsOf(html).length === 20, `${dealsOf(html).length} deals, expected 20`);
  expect(count(html, 'href="/deals/') === 20, `${count(html, 'href="/deals/')} deal links, expected 20`);
  expect(!html.includes("Categories appear after") && !html.includes("No deals are loaded yet"), "the page says it has no data");
  expect(html.includes('<option value="things-to-do" selected>'), "things-to-do is not the selected category");
});

await check(`a chosen city and category (${TOP_CITY}, ${TOP_CATEGORY}) returns 20 ranked deals or says why fewer`, async () => {
  const html = await (await get(topDealsPath({ category: TOP_CATEGORY, place: TOP_CITY, sort: "amount" }))).text();
  const deals = dealsOf(html);
  expect(deals.length > 0, "no deals at all");
  expect(deals.length === 20 || /All \d+ discounted deals? in/.test(html), `${deals.length} deals and no "All N" heading`);
  expect(deals.every((deal, i) => rankOf(deal) === i + 1), "ranks are not 1..n");
  expect(html.includes(`Top 20 in ${TOP_CITY}`) || html.includes(`in ${TOP_CITY}:`), "the heading does not name the chosen city");
});

await check("sort by percent puts the largest percent first, sort by amount the largest amount", async () => {
  const byPercent = dealsOf(await (await get(topDealsPath({ category: TOP_CATEGORY, place: TOP_CITY, sort: "percent" }))).text()).map((deal) => pricesOf(deal).pct);
  expect(byPercent.length > 1 && byPercent[0] === Math.max(...byPercent), `first deal ${byPercent[0]} % is not the largest of ${byPercent.join(", ")}`);
  const byAmount = dealsOf(await (await get(topDealsPath({ category: TOP_CATEGORY, place: TOP_CITY, sort: "amount" }))).text()).map((deal) => pricesOf(deal).save);
  expect(byAmount[0] === Math.max(...byAmount), `first deal saves ${byAmount[0]}, not the largest ${Math.max(...byAmount)}`);
  expect(byPercent.join() !== byAmount.join(), "the two sorts gave the same list");
});

await check("every deal shows the original above the price to pay; the promo price is only in the deal's promo line", async () => {
  const html = await (await get(topDealsPath({ category: TOP_CATEGORY, place: TOP_CITY, sort: "amount" }))).text();
  const deals = dealsOf(html);
  expect(!html.includes("promo-notes") && !/<sup class="fn">/.test(html), "the page still carries a promo footnote list or marker");
  let promoLines = 0;
  for (const deal of deals) {
    const { original, pay, save } = pricesOf(deal);
    expect(original > pay && pay > 0, `deal ${rankOf(deal)}: original ${original} is not above the price to pay ${pay}`);
    expect(Math.abs(original - pay - save) < 0.005, `deal ${rankOf(deal)}: You save ${save} is not original ${original} minus pay ${pay}`);
    const line = /<span class="promo-line">(?:Type code \S+ at Groupon checkout to pay|Groupon may offer) (\$[\d,.]+)(?: at checkout)?\.<\/span>/.exec(deal);
    if (!line) continue;
    promoLines += 1;
    const promo = line[1] ?? "";
    const rest = deal.replace(line[0], "");
    expect(!rest.includes(promo), `deal ${rankOf(deal)} shows the promo price ${promo} outside its promo line`);
    expect(Number(promo.replace(/[$,]/g, "")) < pay, `deal ${rankOf(deal)}: promo price ${promo} is not below the price to pay ${pay}`);
  }
  expect(promoLines > 0 || !html.includes("promo-line"), "no deal has a readable promo line");
});

await check("a city outside the list answers a sentence, not a 500", async () => {
  const response = await get(topDealsPath({ category: "things-to-do", place: "Nowhere, ZZ" }));
  const html = await response.text();
  expect(response.status === 200, `status ${response.status}`);
  expect(html.includes("No discounted deals in Nowhere, ZZ for Things To Do."), "no sentence for the unknown city");
  expect(count(html, 'href="/deals/') === 0, "deal links for a city that does not exist");
});

await check("/top-deals redirects for good to the home page and keeps the query", async () => {
  const response = await get(topDealsPath({ category: TOP_CATEGORY, place: TOP_CITY, sort: "percent" }).replace(/^\/\?/, "/top-deals?"));
  expect(response.status === 301, `status ${response.status}, expected 301`);
  const location = response.headers.get("location") ?? "";
  expect(location.startsWith("/?") && location.includes("sort=percent"), `location "${location}" does not keep the query`);
});

await check("the nav of every page lists Top deals, Find a deal, Price truth and Scorecard, and carries the look switch", async () => {
  for (const path of ["/", "/find", "/price-truth", "/scorecard"]) {
    const html = await (await get(path)).text();
    expect(/href="\/"[^>]*>Top deals</.test(html) && /href="\/find"[^>]*>Find a deal</.test(html), `${path}: the nav does not list Top deals then Find a deal`);
    expect(html.includes('href="/price-truth"') && html.includes('href="/scorecard"'), `${path}: Price truth or Scorecard is missing from the nav`);
    expect(html.includes('action="/theme"'), `${path}: no look switch in the header`);
  }
});

// CEO review round 3 (loop 5): the old check compared one city and one category, while Top deals lists
// only the categories with deals in its city (9 in New York) and the finder lists all of them (32).
// Both rules are checked whole: same 50 cities; the finder offers every category; Top deals' list is a
// subset of that, things-to-do first.
await check("the finder offers every city and category of the pickers; Top deals offers the same cities and its city's categories", async () => {
  const pickers = await (await get("/data/pickers.json")).json() as { cities: { city: string; state: string }[]; categories: { category1: string }[] };
  expect(pickers.cities.length === 50 && pickers.categories.length > 0, `${pickers.cities.length} cities and ${pickers.categories.length} categories in the pickers, expected 50 and some`);
  const optionsOf = (html: string, name: string): string[] => {
    const select = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(html)?.[1] ?? "";
    return [...select.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]!).filter((value) => value !== "");
  };
  const cityValues = pickers.cities.map((city) => `${city.city}, ${city.state}`);
  const allCategories = pickers.categories.map((category) => category.category1);
  const finder = await (await get("/find")).text();
  const home = await (await get("/")).text();
  const finderCities = optionsOf(finder, "place");
  const homeCities = optionsOf(home, "place");
  expect(cityValues.every((city) => finderCities.includes(city)) && finderCities.length === 50, `the finder offers ${finderCities.length} cities, not the pickers' 50`);
  expect(cityValues.every((city) => homeCities.includes(city)) && homeCities.length === 50, `Top deals offers ${homeCities.length} cities, not the pickers' 50`);
  const finderCategories = optionsOf(finder, "category");
  const missing = allCategories.filter((category) => !finderCategories.includes(category));
  expect(missing.length === 0, `the finder does not offer ${missing.join(", ")}`);
  const homeCategories = optionsOf(home, "category");
  expect(homeCategories[0] === "things-to-do", `Top deals' first category is ${homeCategories[0]}, expected things-to-do`);
  const stray = homeCategories.filter((category) => !allCategories.includes(category));
  expect(stray.length === 0, `Top deals offers categories outside the pickers: ${stray.join(", ")}`);
});

await check("a finder search with a city and a category answers cards in that city and category", async () => {
  const html = await (await get(`/find?q=&place=${encodeURIComponent(TOP_CITY)}&category=${TOP_CATEGORY}`)).text();
  expect(count(html, 'href="/deals/') >= 3, `${count(html, 'href="/deals/')} deal links, expected at least 3`);
  expect(html.includes(TOP_CITY.split(",")[0]!), "no card in the chosen city");
  expect(!html.includes("No deals found"), "the finder found nothing for a city and a category with deals");
});

await check("the look switch sets the cookie and the next page renders the pixel look", async () => {
  const response = await postForm("/theme", { theme: "pixel", next: "/find" });
  expect(response.status === 303, `status ${response.status}, expected 303`);
  expect((response.headers.get("location") ?? "") === "/find", `location ${response.headers.get("location")}`);
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie.includes("zal_theme=pixel"), "no zal_theme cookie");
  const html = await (await get("/", { cookie: "zal_theme=pixel" })).text();
  expect(html.includes('<html lang="en" data-theme="pixel">'), "the home page does not carry data-theme=pixel with the cookie");
  expect(html.includes('href="/static/pixel.css"'), "the pixel stylesheet is not linked");
  const plain = await (await get("/")).text();
  expect(!plain.includes("data-theme="), "the home page carries a data-theme without the cookie");
});

// ---------------------------------------------------------------- MCP
await check("MCP tools/list and tools/call search_deals answer", async () => {
  const list = await api<{ result?: { tools: { name: string }[] } }>("/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  const names = (list.body.result?.tools ?? []).map((tool) => tool.name);
  for (const name of ["search_deals", "get_deal", "create_checkout_link", "get_order_status"]) expect(names.includes(name), `tool ${name} missing from ${names.join(",")}`);
  const call = await api<{ result?: { content: { type: string; text: string }[] } }>("/mcp", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_deals", arguments: { text: SEARCH_TEXT } } }),
  });
  const text = call.body.result?.content?.map((c) => c.text).join("\n") ?? "";
  expect(text.includes("Chicago"), "search_deals answered nothing about Chicago");
});

console.log(`\n${passed} passed, ${misses.length} missed${misses.length ? ":\n- " + misses.join("\n- ") : ""}`);
process.exit(misses.length === 0 ? 0 : 1);
