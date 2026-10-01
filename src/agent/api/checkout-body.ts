/**
 * Reads and validates the POST /checkout body into CheckoutItem[]. Bounded and defensive: an
 * agent's body is untrusted input, same as a browser's.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/api/checkout-body.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/agent/api/checkout-body.test.ts
 */
import type { CheckoutItem } from "../../contracts/ports";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 200;
const MAX_ITEMS = 20;
const MAX_QUANTITY = 100;

export interface BodyError {
  readonly code: string;
  readonly message: string;
}

export type ParsedCheckout = { readonly ok: true; readonly items: readonly CheckoutItem[] } | { readonly ok: false; readonly error: BodyError };

const isValidId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= MAX_FIELD_LENGTH;

const isValidQuantity = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_QUANTITY;

function parseItems(data: unknown): readonly CheckoutItem[] | null {
  if (typeof data !== "object" || data === null) return null;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) return null;

  const parsed: CheckoutItem[] = [];
  for (const entry of items) {
    if (typeof entry !== "object" || entry === null) return null;
    const { productId, optionId, quantity } = entry as { productId?: unknown; optionId?: unknown; quantity?: unknown };
    if (!isValidId(productId) || !isValidId(optionId) || !isValidQuantity(quantity)) return null;
    parsed.push({ productId, optionId, quantity });
  }
  return parsed;
}

/** Reads the raw request body: size, JSON shape, then the items themselves. Never throws. */
export async function parseCheckoutBody(request: Request): Promise<ParsedCheckout> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return { ok: false, error: { code: "bad_json", message: "body must be at most 16 KB" } };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: { code: "bad_json", message: "body must be valid JSON" } };
  }

  const items = parseItems(data);
  if (!items) {
    return {
      ok: false,
      error: { code: "invalid_items", message: "items must be 1 to 20 entries, each with productId, optionId, and quantity 1 to 100" },
    };
  }

  return { ok: true, items };
}
