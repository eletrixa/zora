#!/usr/bin/env bun
/**
 * Runs test/eval/queries.json against a running Zora Agent Lab through
 * `GET /api/v1/search`, prints the top three per query, and a final "N of 20". A smoke test for
 * search relevance, not a gate: it needs a live host and the agent token, so it is never run by
 * an agent, only by Robert by hand.
 *
 * Usage: bun bin/eval-search.ts --host https://zorasocial.asajj.cz
 * Token: ZAL_AGENT_TOKEN in the environment.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  bin/eval-search.ts
 * Deps:    src/contracts/ports.ts (Fetch), src/lib/us-states.ts, test/eval/queries.json
 * Tested:  test/eval/eval-search.test.ts (fake fetch, no network)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetch } from "../src/contracts/ports";
import { stateCode } from "../src/lib/us-states";

export interface EvalQuery {
  readonly text: string;
  readonly state?: string;
  readonly city?: string;
  readonly category?: string;
  /** Minor units, same as SearchQuery. Sent to the API as dollars. */
  readonly maxPriceMinor?: number;
  readonly limit?: number;
  /** Fixture product ids that would satisfy this query. Empty for a live-only query. */
  readonly expectAnyOf: readonly string[];
  /**
   * Lower-case words or short phrases: against a live host (fixture ids never match), a hit
   * passes when the title or option title of one of the top three contains any of them.
   */
  readonly expectText?: readonly string[];
  /** One of the top three's city must equal this, case-insensitively, alongside `expectText`. */
  readonly expectCity?: string;
  /** One of the top three's state must equal this (code or full name), alongside `expectText`. */
  readonly expectState?: string;
  /** Only the real catalogue can answer this one; the fixtures cannot. */
  readonly live?: boolean;
}

interface EvalDeal {
  readonly productId: string;
  readonly title: string;
  readonly optionTitle?: string;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly payText: string;
}

/** True when a deal's title or option title contains any of `words`, case-insensitively. */
function matchesText(deal: EvalDeal, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = `${deal.title} ${deal.optionTitle ?? ""}`.toLowerCase();
  return words.some((word) => haystack.includes(word.toLowerCase()));
}

function matchesCity(deal: EvalDeal, city: string | undefined): boolean {
  if (city === undefined) return true;
  return (deal.city ?? "").toLowerCase() === city.toLowerCase();
}

function matchesState(deal: EvalDeal, state: string | undefined): boolean {
  if (state === undefined) return true;
  const wanted = stateCode(state) ?? state.toUpperCase();
  return (deal.state ?? "").toUpperCase() === wanted;
}

function hasContentCriteria(query: EvalQuery): boolean {
  return query.expectText !== undefined || query.expectCity !== undefined || query.expectState !== undefined;
}

/** The first deal in the top three that satisfies every content expectation given, if any. */
function contentMatch(query: EvalQuery, top: readonly EvalDeal[]): EvalDeal | undefined {
  if (!hasContentCriteria(query)) return undefined;
  return top.find((deal) => matchesText(deal, query.expectText ?? []) && matchesCity(deal, query.expectCity) && matchesState(deal, query.expectState));
}

/** One line naming what was expected and what, if anything, satisfied it — the "why". */
function explain(query: EvalQuery, deals: readonly EvalDeal[], top: readonly EvalDeal[]): string {
  if (query.expectAnyOf.length > 0) {
    const hit = deals.find((deal) => query.expectAnyOf.includes(deal.productId));
    if (hit) return `matched fixture id ${hit.productId}`;
  }
  if (hasContentCriteria(query)) {
    const parts: string[] = [];
    if (query.expectText !== undefined) parts.push(`text ${JSON.stringify(query.expectText)}`);
    if (query.expectCity !== undefined) parts.push(`city ${query.expectCity}`);
    if (query.expectState !== undefined) parts.push(`state ${query.expectState}`);
    const expectation = parts.join(", ");
    const hit = contentMatch(query, top);
    return hit ? `matched ${expectation} on "${hit.title}"` : `expected ${expectation} — none of the top 3 matched`;
  }
  return query.expectAnyOf.length === 0 ? "no expectation given (auto pass)" : `expected fixture id in [${query.expectAnyOf.join(", ")}] — not returned`;
}

export interface EvalOutcome {
  readonly query: EvalQuery;
  readonly top: readonly EvalDeal[];
  readonly passed: boolean;
  readonly reason: string;
  readonly error?: string;
}

/** GET /api/v1/search?q=&state=&city=&category=&maxPrice=&limit= (agent-api's route and shape). */
export function searchUrl(host: string, query: EvalQuery): string {
  const url = new URL("/api/v1/search", host);
  if (query.text.length > 0) url.searchParams.set("q", query.text);
  if (query.state !== undefined) url.searchParams.set("state", query.state);
  if (query.city !== undefined) url.searchParams.set("city", query.city);
  if (query.category !== undefined) url.searchParams.set("category", query.category);
  if (query.maxPriceMinor !== undefined) url.searchParams.set("maxPrice", String(query.maxPriceMinor / 100));
  if (query.limit !== undefined) url.searchParams.set("limit", String(query.limit));
  return url.toString();
}

export async function runQuery(host: string, token: string, query: EvalQuery, fetchImpl: Fetch): Promise<EvalOutcome> {
  const response = await fetchImpl(searchUrl(host, query), { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) return { query, top: [], passed: false, reason: `HTTP ${response.status}`, error: `HTTP ${response.status}` };
  const body = (await response.json()) as { deals?: readonly EvalDeal[] };
  const deals = body.deals ?? [];
  const top = deals.slice(0, 3);
  const idMatch = query.expectAnyOf.length > 0 && deals.some((deal) => query.expectAnyOf.includes(deal.productId));
  const passed = idMatch || contentMatch(query, top) !== undefined || (query.expectAnyOf.length === 0 && !hasContentCriteria(query));
  return { query, top, passed, reason: explain(query, deals, top) };
}

export interface EvalReport {
  readonly outcomes: readonly EvalOutcome[];
  readonly passedCount: number;
  readonly total: number;
}

export async function runEval(host: string, token: string, queries: readonly EvalQuery[], fetchImpl: Fetch): Promise<EvalReport> {
  const outcomes: EvalOutcome[] = [];
  for (const query of queries) outcomes.push(await runQuery(host, token, query, fetchImpl));
  return { outcomes, passedCount: outcomes.filter((outcome) => outcome.passed).length, total: queries.length };
}

export function loadQueries(path: string): EvalQuery[] {
  return JSON.parse(readFileSync(path, "utf8")) as EvalQuery[];
}

export function formatOutcome(outcome: EvalOutcome, index: number): string {
  const label = `${index + 1}. "${outcome.query.text}"${outcome.query.live ? " [live]" : ""}`;
  const verdict = `${outcome.passed ? "OK" : "MISS"} (${outcome.reason})`;
  if (outcome.top.length === 0) return `${label} — no hits${outcome.error ? ` (${outcome.error})` : ""}`;
  const lines = outcome.top.map((deal) => `${deal.title} (${deal.productId}) ${deal.payText}`).join(" | ");
  return `${label} — ${verdict} — ${lines}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const hostFlag = args.indexOf("--host");
  const host = hostFlag >= 0 ? args[hostFlag + 1] : undefined;
  if (!host) {
    console.error("usage: bun bin/eval-search.ts --host <url>");
    process.exit(2);
  }
  const token = process.env.ZAL_AGENT_TOKEN;
  if (!token) {
    console.error("ZAL_AGENT_TOKEN is not set");
    process.exit(2);
  }
  const queries = loadQueries(join(import.meta.dir, "..", "test", "eval", "queries.json"));
  const report = await runEval(host, token, queries, fetch);
  report.outcomes.forEach((outcome, index) => console.log(formatOutcome(outcome, index)));
  console.log(`${report.passedCount} of ${report.total}`);
  process.exit(report.passedCount === report.total ? 0 : 1);
}
