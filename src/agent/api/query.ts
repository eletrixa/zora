/**
 * Reads and validates the GET /search query string into a SearchQuery. Its own reader: does not
 * import src/ui, which shapes queries for the HTML finder instead of an agent.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/api/query.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/agent/api/query.test.ts
 */
import type { SearchQuery } from "../../contracts/ports";

const MAX_TEXT_LENGTH = 200;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export interface QueryError {
  readonly code: string;
  readonly message: string;
}

export type ParsedQuery = { readonly ok: true; readonly query: SearchQuery } | { readonly ok: false; readonly error: QueryError };

const clampText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : undefined;
};

/** Dollars in the query string, minor units out. Not a finite positive number: undefined (ignored). */
const parseMaxPrice = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : undefined;
};

/** Not a positive integer: undefined, so the caller's own default applies. */
const parseLimit = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : undefined;
};

/** Reads q, state, city, category, maxPrice, limit. Refuses when none of the first five criteria are given. */
export function parseSearchQuery(params: Readonly<Record<string, string | undefined>>): ParsedQuery {
  const text = clampText(params["q"]);
  const state = clampText(params["state"]);
  const city = clampText(params["city"]);
  const category = clampText(params["category"]);
  const maxPriceMinor = parseMaxPrice(params["maxPrice"]);
  const limit = parseLimit(params["limit"]) ?? DEFAULT_LIMIT;

  if (!text && !state && !city && !category && maxPriceMinor === undefined) {
    return { ok: false, error: { code: "missing_criteria", message: "give at least one of q, state, city, category, maxPrice" } };
  }

  return { ok: true, query: { text: text ?? "", state, city, category, maxPriceMinor, limit } };
}
