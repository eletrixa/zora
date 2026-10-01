/**
 * Input schemas and argument validation for the four MCP tools. Validation mirrors the HTTP API:
 * string lengths, integer ranges, 1..20 items, quantity 1..100. A failure here becomes a tool
 * result with isError: true, never a protocol error.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/mcp/schemas.ts
 * Deps:    none
 * Tested:  test/agent/mcp/routes.test.ts
 */
import type { CheckoutItem, SearchQuery } from "../../contracts/ports";
import { isPlainObject } from "./protocol";

export type Validated<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

const ok = <T>(value: T): Validated<T> => ({ ok: true, value });
const fail = <T>(message: string): Validated<T> => ({ ok: false, message });

const MAX_TEXT = 200;
const MAX_ID = 200;
const MAX_ITEMS = 20;
const MAX_QUANTITY = 100;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

function optionalString(args: Record<string, unknown>, field: string, maxLength: number): Validated<string | undefined> {
  const value = args[field];
  if (value === undefined) return ok(undefined);
  if (typeof value !== "string") return fail(`${field} must be a string`);
  if (value.length === 0 || value.length > maxLength) return fail(`${field} must be 1..${maxLength} characters`);
  return ok(value);
}

function requiredString(args: Record<string, unknown>, field: string, maxLength: number): Validated<string> {
  const value = args[field];
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return fail(`${field} is required and must be 1..${maxLength} characters`);
  return ok(value);
}

// ---------------------------------------------------------------- search_deals

export const SEARCH_DEALS_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", maxLength: MAX_TEXT, description: "Free text describing what to search for, e.g. 'massage in Chicago'." },
    state: { type: "string", maxLength: 100, description: "Two-letter state code or full state name." },
    city: { type: "string", maxLength: 100, description: "City name." },
    category: { type: "string", maxLength: 100, description: "Category label to match." },
    max_price_usd: { type: "number", minimum: 0, maximum: 100000, description: "Only show deals priced at or below this amount to pay, in US dollars." },
    limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: `Maximum number of deals to return. Default ${DEFAULT_LIMIT}.` },
  },
  additionalProperties: false,
} as const;

export function validateSearchDeals(args: unknown): Validated<SearchQuery> {
  if (!isPlainObject(args)) return fail("arguments must be an object");
  const text = optionalString(args, "text", MAX_TEXT);
  if (!text.ok) return text;
  const state = optionalString(args, "state", 100);
  if (!state.ok) return state;
  const city = optionalString(args, "city", 100);
  if (!city.ok) return city;
  const category = optionalString(args, "category", 100);
  if (!category.ok) return category;
  let maxPriceMinor: number | undefined;
  if (args.max_price_usd !== undefined) {
    const raw = args.max_price_usd;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 100000) return fail("max_price_usd must be a number between 0 and 100000");
    maxPriceMinor = Math.round(raw * 100);
  }
  let limit = DEFAULT_LIMIT;
  if (args.limit !== undefined) {
    const raw = args.limit;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > MAX_LIMIT) return fail(`limit must be an integer between 1 and ${MAX_LIMIT}`);
    limit = raw;
  }
  return ok({
    text: text.value ?? "",
    state: state.value,
    city: city.value,
    category: category.value,
    maxPriceMinor,
    limit,
  });
}

// ---------------------------------------------------------------- get_deal

export const GET_DEAL_SCHEMA = {
  type: "object",
  properties: {
    product_id: { type: "string", minLength: 1, maxLength: MAX_ID, description: "The product id to look up." },
  },
  required: ["product_id"],
  additionalProperties: false,
} as const;

export function validateGetDeal(args: unknown): Validated<{ productId: string }> {
  if (!isPlainObject(args)) return fail("arguments must be an object");
  const productId = requiredString(args, "product_id", MAX_ID);
  if (!productId.ok) return productId;
  return ok({ productId: productId.value });
}

// ---------------------------------------------------------------- create_checkout_link

export const CREATE_CHECKOUT_LINK_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ITEMS,
      description: `1..${MAX_ITEMS} lines to put in the cart.`,
      items: {
        type: "object",
        properties: {
          product_id: { type: "string", minLength: 1, maxLength: MAX_ID },
          option_id: { type: "string", minLength: 1, maxLength: MAX_ID },
          quantity: { type: "integer", minimum: 1, maximum: MAX_QUANTITY },
        },
        required: ["product_id", "option_id", "quantity"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export function validateCreateCheckoutLink(args: unknown): Validated<readonly CheckoutItem[]> {
  if (!isPlainObject(args)) return fail("arguments must be an object");
  const items = args.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return fail(`items must be an array of 1..${MAX_ITEMS} entries`);
  const parsed: CheckoutItem[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isPlainObject(raw)) return fail(`items[${index}] must be an object`);
    const productId = requiredString(raw, "product_id", MAX_ID);
    if (!productId.ok) return fail(`items[${index}].${productId.message}`);
    const optionId = requiredString(raw, "option_id", MAX_ID);
    if (!optionId.ok) return fail(`items[${index}].${optionId.message}`);
    const quantity = raw.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return fail(`items[${index}].quantity must be an integer between 1 and ${MAX_QUANTITY}`);
    }
    parsed.push({ productId: productId.value, optionId: optionId.value, quantity });
  }
  return ok(parsed);
}

// ---------------------------------------------------------------- get_order_status

export const GET_ORDER_STATUS_SCHEMA = {
  type: "object",
  properties: {
    groupon_order_uuid: { type: "string", minLength: 1, maxLength: MAX_ID, description: "The Groupon order uuid returned by create_checkout_link's confirmation flow." },
  },
  required: ["groupon_order_uuid"],
  additionalProperties: false,
} as const;

export function validateGetOrderStatus(args: unknown): Validated<{ uuid: string }> {
  if (!isPlainObject(args)) return fail("arguments must be an object");
  const uuid = requiredString(args, "groupon_order_uuid", MAX_ID);
  if (!uuid.ok) return uuid;
  return ok({ uuid: uuid.value });
}
