/**
 * The interfaces lanes call each other through. FROZEN after Wave 0: a lane that needs a change
 * writes requests/<lane>.md and keeps building against the fake.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/contracts/ports.ts
 * Deps:    src/contracts/partner.ts
 * Tested:  test/contracts/ports.test.ts (the fakes satisfy the ports)
 *
 * Rules every implementation follows:
 *   - Money is an integer in minor units. Never a float, never a formatted string.
 *   - Time is an ISO-8601 UTC string. `Clock` is the only source of "now".
 *   - Expected failures are values (`Result`), never thrown. Throw only on programmer error.
 *   - The price a shopper pays is `retail`. A promo price is always reported separately.
 */
import type {
  Booking,
  CartItemInput,
  OctoCart,
  OctoProduct,
  PartnerRegistration,
  ProductsPage,
  ProductsQuery,
  Supplier,
} from "./partner";

// ---------------------------------------------------------------- basics

/** The fetch shape every implementation and every fake shares (Workers and Bun disagree on `typeof fetch`). */
export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
  /** Resolves after `ms`. Fakes resolve at once and advance their own time. */
  sleep(ms: number): Promise<void>;
}

export type Result<T, E = PartnerError> =
  | { readonly ok: true; readonly value: T; readonly meta: CallMeta }
  | { readonly ok: false; readonly error: E; readonly meta: CallMeta };

export type EndpointName =
  | "partners.me"
  | "supplier"
  | "products.list"
  | "carts.create"
  | "carts.get"
  | "carts.abandon"
  | "carts.items.add"
  | "carts.items.update"
  | "carts.items.remove"
  | "bookings.get"
  | "raw";

export interface CallMeta {
  readonly endpoint: EndpointName;
  /** The x-request-id we sent. */
  readonly requestId: string;
  /** null when no HTTP response arrived (network error, timeout). */
  readonly httpStatus: number | null;
  /** Wall time of the last attempt. */
  readonly latencyMs: number;
  /** 1 when the first attempt answered. */
  readonly attempts: number;
}

/**
 * `code` is an OctoErrorCode, or one of the envelope codes ("unauthenticated",
 * "invalid_argument", "not_found"), or a client-side code: "NETWORK", "TIMEOUT", "UNPARSEABLE",
 * "NO_KEY" (the API key secret is not set; no request was sent), "BUSY" (the queue to the
 * partner API is longer than `maxWaitMs`; no request was sent).
 * Read from the body with `body.error ?? body.details?.error ?? body.code`, never from the
 * HTTP status (Products, Supplier, Booking, partners/me answer every error as HTTP 400).
 */
export interface PartnerError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  /** Which of the three documented body shapes carried the error. */
  readonly shape: "flat" | "envelope" | "auth" | "none";
  /** PRICE_MISMATCH only, minor units. */
  readonly currentPrice?: number;
  /** RATE_LIMITED / HTTP 429 only. */
  readonly retryAfterSec?: number;
}

// ---------------------------------------------------------------- partner client (lane: partner-client)

/**
 * Shared pacing state. One object is handed to every client built in the same isolate, so
 * requests that arrive at the same time still leave `minIntervalMs` between their starts.
 * Before a request: start = max(now, nextFreeAt); nextFreeAt = start + minIntervalMs; then
 * sleep until start. The slot is reserved BEFORE the sleep, so two callers never share one.
 */
export interface Pacer {
  nextFreeAt: number;
}

export interface PartnerConfig {
  readonly baseUrl: string; // https://api.enc.groupon.com
  readonly apiKey: string;
  readonly userAgent: string;
  /** Minimum gap between the starts of two requests. Production value: 1000. */
  readonly minIntervalMs: number;
  readonly timeoutMs: number;
  /** Omitted: the client paces only its own requests. */
  readonly pacer?: Pacer;
  /**
   * The longest a request may wait for its slot. When the next free slot is further away, the
   * request is NOT sent and no slot is taken: the call answers `{ ok: false }` with code "BUSY"
   * (not retryable, httpStatus null). Keeps a burst from queueing requests for minutes.
   * Default 15000.
   */
  readonly maxWaitMs?: number;
}

export interface RawRequest {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path under the base URL, starting with "/octo-gateway/v1/". */
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** "key" sends g-api-key, "bearer" sends Authorization: Bearer <key>, "none" sends neither. */
  readonly auth: "key" | "bearer" | "none";
}

export interface RawResponse {
  readonly httpStatus: number;
  readonly headers: Readonly<Record<string, string>>;
  /** Parsed JSON, or null when the body is empty or not JSON. */
  readonly body: unknown;
}

export interface PartnerClient {
  getPartner(): Promise<Result<PartnerRegistration>>;
  getSupplier(): Promise<Result<Supplier>>;
  listProducts(query: ProductsQuery): Promise<Result<ProductsPage>>;
  createCart(items: readonly CartItemInput[], clientReference?: string): Promise<Result<OctoCart>>;
  getCart(cartId: string): Promise<Result<OctoCart>>;
  /** Not idempotent: NEVER retried. After a timeout the caller reads the cart. */
  addCartItems(cartId: string, items: readonly CartItemInput[]): Promise<Result<OctoCart>>;
  updateCartItem(cartId: string, itemId: string, quantity: number, expectedPrice?: number): Promise<Result<OctoCart>>;
  removeCartItem(cartId: string, itemId: string): Promise<Result<OctoCart>>;
  abandonCart(cartId: string): Promise<Result<null>>;
  getBooking(grouponOrderUuid: string): Promise<Result<Booking>>;
  /** One attempt, no retry, no error mapping. For the probe's refusal and shape checks. */
  raw(request: RawRequest): Promise<Result<RawResponse>>;
}

// ---------------------------------------------------------------- catalogue store (lane: catalogue-store)

export interface StoredOption {
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  /** null = Groupon does not know; treated as sellable (guide: active IS DISTINCT FROM false). */
  readonly active: boolean | null;
  readonly isDefault: boolean;
  readonly currency: string;
  readonly precision: number;
  readonly original: number;
  readonly retail: number;
  readonly promoAmount: number | null;
  readonly promoCode: string | null;
  readonly promoEndsAt: string | null;
}

export interface StoredLocation {
  readonly name: string | null;
  readonly street: string | null;
  readonly city: string | null;
  /** Two-letter code as the API sends it on locations, e.g. "IL". */
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface StoredProduct {
  readonly id: string;
  readonly reference: string | null;
  readonly title: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly status: OctoProduct["status"];
  readonly availabilityRequired: boolean;
  /** Computed by the listable rule at write time. */
  readonly listable: boolean;
  readonly categoryLabels: readonly string[];
  readonly imageUrl: string | null;
  readonly options: readonly StoredOption[];
  readonly locations: readonly StoredLocation[];
  readonly firstSeenAt: string;
  readonly updatedAt: string;
}

export interface UpsertStats {
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Rows written to price_changes. */
  readonly priceChanges: number;
}

export interface CatalogueStore {
  /** Idempotent. Writes products, options, locations, and a price_changes row per changed price. */
  upsertProducts(products: readonly OctoProduct[], syncRunId: string, seenAt: string): Promise<UpsertStats>;
  getProduct(productId: string): Promise<StoredProduct | null>;
  getOption(productId: string, optionId: string): Promise<StoredOption | null>;
  countProducts(): Promise<{ readonly total: number; readonly listable: number }>;
  /** Deterministic for a given seed: the same seed returns the same sample. */
  sampleListableOptions(count: number, seed: string): Promise<readonly StoredOption[]>;
  /** After a COMPLETE full load: products not seen in that run stop being listable. */
  retireUnseen(syncRunId: string): Promise<number>;
  /** Newest first. */
  priceHistory(productId: string, limit: number): Promise<readonly PriceChangeRow[]>;
  /**
   * Groupon just refused this option in a cart (guide: "mark that product or option not
   * listable in your database"). Sets the option inactive; when no sellable option is left the
   * product stops being listable and leaves the search index. The stored content hash is
   * cleared, so the next sync that sees the product writes Groupon's own state again.
   * Returns false when the option is unknown.
   */
  markUnavailable(productId: string, optionId: string): Promise<boolean>;
}

export interface PriceChangeRow {
  readonly optionId: string;
  readonly field: "retail" | "original" | "promo";
  readonly oldMinor: number | null;
  readonly newMinor: number | null;
  readonly detectedAt: string;
}

/** The guide's rule, one place: active product, no availability required, one option not inactive. */
export type ListableRule = (product: OctoProduct) => boolean;

// ---------------------------------------------------------------- search (lane: search)

export interface SearchQuery {
  readonly text: string;
  /** Two-letter code ("IL") or full name ("Illinois"); the index accepts both. */
  readonly state?: string;
  readonly city?: string;
  /** Matches a category label, case-insensitive. */
  readonly category?: string;
  /** Groupon category1 permalink ("things-to-do"), matched against the tags of the daily category walk. */
  readonly category1?: string;
  readonly maxPriceMinor?: number;
  /** Default 10, cap 50. */
  readonly limit?: number;
}

export interface SearchHit {
  readonly productId: string;
  /** The cheapest sellable option of the product. */
  readonly optionId: string;
  readonly title: string;
  readonly optionTitle: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly imageUrl: string | null;
  readonly currency: string;
  readonly precision: number;
  readonly original: number;
  readonly retail: number;
  readonly promoAmount: number | null;
  readonly promoCode: string | null;
  readonly promoEndsAt: string | null;
  /** Higher is better. */
  readonly score: number;
}

export interface SearchIndex {
  /** Only listable products, only sellable options. Empty text with filters is allowed. */
  search(query: SearchQuery): Promise<readonly SearchHit[]>;
}

// ---------------------------------------------------------------- carts (lane: carts)

export type CartSource = "agent-api" | "agent-mcp" | "web" | "probe" | "monitor";

export interface CartLineRequest {
  readonly productId: string;
  readonly optionId: string;
  /** 1..100 */
  readonly quantity: number;
  /** The per-unit price we showed, minor units. Always sent as expectedPrice. */
  readonly expectedPriceMinor: number;
}

export type CartOutcome =
  | { readonly kind: "created"; readonly cart: OctoCart; readonly meta: CallMeta }
  | {
      readonly kind: "price_changed";
      readonly productId: string;
      readonly optionId: string;
      readonly expectedPriceMinor: number;
      readonly currentPriceMinor: number;
      readonly meta: CallMeta;
    }
  | {
      readonly kind: "unavailable";
      readonly code: string;
      readonly message: string;
      readonly meta: CallMeta;
      /** The line Groupon refused, when it is known (always known for a one-line cart). */
      readonly productId?: string;
      readonly optionId?: string;
    }
  | { readonly kind: "error"; readonly error: PartnerError; readonly meta: CallMeta };

export interface OpenCart {
  readonly cartId: string;
  readonly source: CartSource;
  readonly createdAt: string;
}

export interface CartService {
  /** Creates the cart, logs it in carts_log with its source. Max 20 lines. */
  create(lines: readonly CartLineRequest[], source: CartSource): Promise<CartOutcome>;
  /** Abandons at the API and marks carts_log. Safe to call twice. */
  abandon(cartId: string): Promise<Result<null>>;
  /** Carts we created that are neither abandoned nor checked out. */
  listOpen(olderThanMs: number): Promise<readonly OpenCart[]>;
}

// ---------------------------------------------------------------- shopping (lane: shopping)

/** What an agent or a page shows for one deal. The price to pay is `pay`. */
export interface DealCard {
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  readonly optionTitle: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly imageUrl: string | null;
  readonly currency: string;
  readonly precision: number;
  /** Struck-through list price, minor units. */
  readonly listPriceMinor: number;
  /** THE PRICE THE SHOPPER PAYS at checkout, minor units (= retail). */
  readonly payMinor: number;
  /** Formatted `payMinor`, e.g. "$49.00". */
  readonly payText: string;
  /** Present only when a promo exists. Never merged into `pay`. */
  readonly promo: PromoNote | null;
}

export interface PromoNote {
  readonly priceMinor: number;
  readonly priceText: string;
  readonly code: string | null;
  readonly endsAt: string | null;
  /** Fixed sentence, e.g. "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00." */
  readonly instruction: string;
}

export interface DealDetail extends DealCard {
  readonly shortDescription: string;
  readonly description: string;
  readonly categoryLabels: readonly string[];
  readonly options: readonly DealOption[];
  readonly locations: readonly StoredLocation[];
}

export interface DealOption {
  readonly optionId: string;
  readonly title: string;
  readonly sellable: boolean;
  readonly listPriceMinor: number;
  readonly payMinor: number;
  readonly payText: string;
  readonly promo: PromoNote | null;
}

export interface CheckoutItem {
  readonly productId: string;
  readonly optionId: string;
  readonly quantity: number;
}

export type CheckoutResult =
  | {
      readonly kind: "link";
      readonly cartId: string;
      /** Verbatim from the latest cart response. Never constructed. */
      readonly buyLink: string;
      readonly currency: string;
      readonly precision: number;
      readonly totalMinor: number;
      readonly totalText: string;
      readonly lines: readonly CheckoutLine[];
      readonly expiresAt: string | null;
    }
  | { readonly kind: "price_changed"; readonly productId: string; readonly optionId: string; readonly wasMinor: number; readonly nowMinor: number; readonly nowText: string }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "not_found"; readonly productId: string; readonly optionId: string }
  | { readonly kind: "error"; readonly code: string; readonly message: string };

export interface CheckoutLine {
  readonly productId: string;
  readonly optionId: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitPayMinor: number;
  readonly lineTotalMinor: number;
}

export interface OrderVoucher {
  readonly status: string;
  /** The shopper's voucher page on My Groupon. */
  readonly url: string;
}

export interface OrderLine {
  readonly productId: string | null;
  readonly optionId: string;
  readonly title: string | null;
  readonly quantity: number;
  readonly status: string;
  readonly vouchers: readonly OrderVoucher[];
}

export type OrderStatusResult =
  | { readonly kind: "order"; readonly uuid: string; readonly status: string; readonly pending: boolean; readonly lines: readonly OrderLine[] }
  | { readonly kind: "not_found" }
  | { readonly kind: "error"; readonly code: string; readonly message: string };

export interface ShoppingService {
  searchDeals(query: SearchQuery, channel: CartSource): Promise<readonly DealCard[]>;
  getDeal(productId: string): Promise<DealDetail | null>;
  createCheckoutLink(items: readonly CheckoutItem[], channel: CartSource): Promise<CheckoutResult>;
  getOrderStatus(grouponOrderUuid: string): Promise<OrderStatusResult>;
}

// ---------------------------------------------------------------- probe (lanes: probe-runner, probe-checks)

export type ProbeCheckName =
  | "openapi-drift"
  | "guide-version"
  | "registration"
  | "catalogue-page"
  | "catalogue-walk"
  | "catalogue-delta"
  | "refusals"
  | "cart-lifecycle"
  | "price-mismatch"
  | "buy-link"
  | "order-read";

export interface ProbeStepResult {
  readonly check: ProbeCheckName;
  /** Short stable id of the step inside the check, e.g. "create", "patch-quantity". */
  readonly step: string;
  readonly verdict: "pass" | "fail" | "skip";
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly latencyMs: number | null;
  readonly requestId: string | null;
  /** One sentence a person can read. For a fail: expected against observed. */
  readonly detail: string;
  /**
   * Only the openapi-drift and guide-version checks set this: the value they saw today
   * (openapi: sha-256 hex of the file; guide: the version string). Checks never write to the
   * database. The runner compares it with contract_snapshots, writes a drift_events row when
   * it differs, then stores it as the new snapshot. A first observation is not a drift.
   */
  readonly observed?: { readonly kind: "openapi" | "guide"; readonly value: string };
}

export interface ProbeContext {
  readonly partner: PartnerClient;
  readonly carts: CartService;
  readonly catalogue: CatalogueStore;
  readonly db: D1Database;
  readonly clock: Clock;
  /** For URLs outside the partner API (openapi.json, buyLink). */
  readonly fetch: Fetch;
  readonly config: ProbeConfig;
}

export interface ProbeConfig {
  readonly openapiUrl: string;
  readonly expectedDisplayName: string;
  /** Set after the first real order; null skips the order-read check. */
  readonly knownOrderUuid: string | null;
  readonly checkoutHost: string; // partner.groupon.com
}

export interface ProbeCheck {
  readonly name: ProbeCheckName;
  /** Never throws. A crash inside is reported as one "fail" step with the message. */
  run(ctx: ProbeContext): Promise<readonly ProbeStepResult[]>;
}

// ---------------------------------------------------------------- jobs (called by src/cron.ts and admin routes)

export type Job = (deps: Deps, env: import("./env").Env) => Promise<JobSummary>;

export interface JobSummary {
  readonly job: "sync-full" | "sync-delta" | "probe" | "cart-sample" | "promo-gap" | "cart-sweep" | "category-walk" | "top-cities";
  readonly ok: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  /** One sentence with the numbers. */
  readonly summary: string;
}

// ---------------------------------------------------------------- composition

export interface Deps {
  readonly db: D1Database;
  readonly clock: Clock;
  readonly partner: PartnerClient;
  readonly catalogue: CatalogueStore;
  readonly search: SearchIndex;
  readonly carts: CartService;
  readonly shopping: ShoppingService;
}
