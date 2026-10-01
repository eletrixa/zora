/**
 * The only module that calls the Groupon Partner Storefront API: headers, pacing, timeouts,
 * the three error-body shapes, and the guide's retry policy.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/partner/index.ts
 * Deps:    src/contracts, src/lib/crypto.ts
 * Tested:  test/partner/index.test.ts
 */
import type { Booking, CartItemInput, OctoCart, PartnerRegistration, ProductsPage, ProductsQuery, Supplier } from "../contracts/partner";
import type {
  CallMeta,
  Clock,
  EndpointName,
  Fetch,
  Pacer,
  PartnerClient,
  PartnerConfig,
  PartnerError,
  RawRequest,
  RawResponse,
  Result,
} from "../contracts/ports";
import { newId } from "../lib/crypto";

const BASE_PATH = "/octo-gateway/v1";
const MAX_ATTEMPTS = 5;
/** Between attempts 1-2, 2-3, 3-4, 4-5. The guide names only the first three; doubling continues. */
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000];
/**
 * getBooking only. Guide, "Reading the order" › Polling: "Poll from your server: wait 2 s, then
 * 4 s, 8 s, 15 s, 30 s (about one minute in total)." The Errors section repeats it for
 * INTERNAL_SERVER_ERROR: "Retry with the same backoff as polling (2 s, 4 s, 8 s, 15 s, 30 s)."
 */
const ORDER_READ_BACKOFF_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
const RETRYABLE_CODES = new Set(["INTERNAL_SERVER_ERROR", "NETWORK", "TIMEOUT", "RATE_LIMITED"]);
const DEFAULT_MAX_WAIT_MS = 15_000;

/** Marks a 2xx body that is missing a field the caller needs. Never leaves this module. */
const UNPARSEABLE: unique symbol = Symbol("unparseable");

type Auth = "key" | "bearer" | "none";

type AttemptOutcome =
  | { readonly kind: "response"; readonly httpStatus: number; readonly headers: Headers; readonly body: unknown; readonly requestId: string; readonly latencyMs: number }
  | { readonly kind: "network"; readonly requestId: string; readonly latencyMs: number }
  | { readonly kind: "timeout"; readonly requestId: string; readonly latencyMs: number }
  /** The queue to the partner API is longer than maxWaitMs. No slot was taken, nothing was sent. */
  | { readonly kind: "busy" };

const BUSY_ERROR: PartnerError = { code: "BUSY", message: "the queue to the partner API is too long", retryable: false, shape: "none" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** `body.error ?? body.details?.error ?? body.code`, plus which shape it came from. */
function errorCodeOf(body: unknown): { readonly code: string; readonly shape: PartnerError["shape"] } | null {
  const record = asRecord(body);
  if (!record) return null;
  if (typeof record.error === "string") return { code: record.error, shape: "flat" };
  const details = asRecord(record.details);
  if (details && typeof details.error === "string") return { code: details.error, shape: "envelope" };
  if (typeof record.code === "string") return { code: record.code, shape: "auth" };
  return null;
}

function messageOf(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (!record) return fallback;
  if (typeof record.errorMessage === "string" && record.errorMessage) return record.errorMessage;
  if (typeof record.message === "string" && record.message) return record.message;
  const details = asRecord(record.details);
  if (details && typeof details.errorMessage === "string" && details.errorMessage) return details.errorMessage;
  return fallback;
}

function currentPriceOf(body: unknown): number | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  if (typeof record.currentPrice === "number") return record.currentPrice;
  const details = asRecord(record.details);
  if (details && typeof details.currentPrice === "number") return details.currentPrice;
  return undefined;
}

function retryAfterSecOf(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function isRetryableHttp(httpStatus: number): boolean {
  return httpStatus === 429 || httpStatus >= 500;
}

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of headers.entries()) out[name.toLowerCase()] = value;
  return out;
}

function parseCart(body: unknown): OctoCart | typeof UNPARSEABLE {
  const record = asRecord(body);
  if (!record || typeof record.id !== "string" || typeof record.buyLink !== "string") return UNPARSEABLE;
  return body as OctoCart;
}

interface CallOptions<T> {
  readonly retryable: boolean;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly parse: (body: unknown) => T | typeof UNPARSEABLE;
  /** Defaults to BACKOFF_MS. getBooking uses the guide's polling schedule instead. */
  readonly backoffMs?: readonly number[];
}

export function createPartnerClient(config: PartnerConfig, clock: Clock, fetchImpl: Fetch): PartnerClient {
  return new PartnerClientImpl(config, clock, fetchImpl);
}

class PartnerClientImpl implements PartnerClient {
  /** config.pacer when given, else one this client owns alone. */
  readonly #pacer: Pacer;

  constructor(
    private readonly config: PartnerConfig,
    private readonly clock: Clock,
    private readonly fetchImpl: Fetch,
  ) {
    this.#pacer = config.pacer ?? { nextFreeAt: -Infinity };
  }

  async getPartner(): Promise<Result<PartnerRegistration>> {
    return this.#call("partners.me", "GET", "/partners/me", { retryable: true, parse: (body) => body as PartnerRegistration });
  }

  async getSupplier(): Promise<Result<Supplier>> {
    return this.#call("supplier", "GET", "/supplier", { retryable: true, parse: (body) => body as Supplier });
  }

  async listProducts(query: ProductsQuery): Promise<Result<ProductsPage>> {
    const params: Record<string, string> = { country: "US" };
    if (query.limit !== undefined) params.limit = String(query.limit);
    if (query.cursor !== undefined) params.cursor = query.cursor;
    if (query.state !== undefined) params.state = query.state;
    if (query.category0 !== undefined) params.category0 = query.category0;
    if (query.category1 !== undefined) params.category1 = query.category1;
    if (query.category2 !== undefined) params.category2 = query.category2;
    if (query.active !== undefined) params.active = String(query.active);
    if (query.updatedSince !== undefined) params.updatedSince = query.updatedSince;
    return this.#call("products.list", "GET", "/products", {
      retryable: true,
      query: params,
      parse: (body) => {
        const record = asRecord(body);
        if (!record || !Array.isArray(record.products) || typeof record.hasMore !== "boolean") return UNPARSEABLE;
        // Seen on 2026-09-30: the live API sends no `timestamp` on a page, although the guide and
        // the contract file promise one (the watermark is "final page timestamp minus 10 minutes").
        // The time this client received the page stands in; the 10 minute margin covers the skew.
        // Finding F-001 in the findings table.
        const timestamp = typeof record.timestamp === "string" ? record.timestamp : new Date(this.clock.now()).toISOString();
        return {
          products: record.products,
          hasMore: record.hasMore,
          nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
          timestamp,
        } as ProductsPage;
      },
    });
  }

  async createCart(items: readonly CartItemInput[], clientReference?: string): Promise<Result<OctoCart>> {
    const body: Record<string, unknown> = { country: "US", items };
    if (clientReference !== undefined) body.clientReference = clientReference;
    return this.#call("carts.create", "POST", "/carts", { retryable: true, body, parse: parseCart });
  }

  async getCart(cartId: string): Promise<Result<OctoCart>> {
    return this.#call("carts.get", "GET", `/carts/${encodeURIComponent(cartId)}`, {
      retryable: true,
      query: { country: "US" },
      parse: parseCart,
    });
  }

  /** Not idempotent: NEVER retried. After a timeout the caller reads the cart. */
  async addCartItems(cartId: string, items: readonly CartItemInput[]): Promise<Result<OctoCart>> {
    return this.#call("carts.items.add", "POST", `/carts/${encodeURIComponent(cartId)}/items`, {
      retryable: false,
      body: { country: "US", items },
      parse: parseCart,
    });
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number, expectedPrice?: number): Promise<Result<OctoCart>> {
    const body: Record<string, unknown> = { country: "US", quantity };
    if (expectedPrice !== undefined) body.expectedPrice = expectedPrice;
    return this.#call("carts.items.update", "PATCH", `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
      retryable: true,
      body,
      parse: parseCart,
    });
  }

  async removeCartItem(cartId: string, itemId: string): Promise<Result<OctoCart>> {
    return this.#call("carts.items.remove", "DELETE", `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
      retryable: true,
      parse: parseCart,
    });
  }

  async abandonCart(cartId: string): Promise<Result<null>> {
    return this.#call("carts.abandon", "DELETE", `/carts/${encodeURIComponent(cartId)}`, {
      retryable: true,
      parse: () => null,
    });
  }

  async getBooking(grouponOrderUuid: string): Promise<Result<Booking>> {
    return this.#call("bookings.get", "GET", `/partner-bookings/${encodeURIComponent(grouponOrderUuid)}`, {
      retryable: true,
      backoffMs: ORDER_READ_BACKOFF_MS,
      parse: (body) => {
        const record = asRecord(body);
        if (!record || typeof record.uuid !== "string") return UNPARSEABLE;
        return body as Booking;
      },
    });
  }

  /** One attempt, no retry, no error mapping. For the probe's refusal and shape checks. */
  async raw(request: RawRequest): Promise<Result<RawResponse>> {
    if (request.auth === "key" && !this.config.apiKey) {
      return {
        ok: false,
        error: { code: "NO_KEY", message: "no API key configured", retryable: false, shape: "none" },
        meta: { endpoint: "raw", requestId: "", httpStatus: null, latencyMs: 0, attempts: 0 },
      };
    }
    const outcome = await this.#attempt(request.method, request.path, request.query, request.body, request.auth, true);
    if (outcome.kind === "busy") {
      return { ok: false, error: BUSY_ERROR, meta: { endpoint: "raw", requestId: "", httpStatus: null, latencyMs: 0, attempts: 1 } };
    }
    if (outcome.kind !== "response") {
      const code = outcome.kind === "timeout" ? "TIMEOUT" : "NETWORK";
      return {
        ok: false,
        error: { code, message: code === "TIMEOUT" ? "request timed out" : "network error", retryable: true, shape: "none" },
        meta: { endpoint: "raw", requestId: outcome.requestId, httpStatus: null, latencyMs: outcome.latencyMs, attempts: 1 },
      };
    }
    return {
      ok: true,
      value: { httpStatus: outcome.httpStatus, headers: lowerHeaders(outcome.headers), body: outcome.body },
      meta: { endpoint: "raw", requestId: outcome.requestId, httpStatus: outcome.httpStatus, latencyMs: outcome.latencyMs, attempts: 1 },
    };
  }

  // ------------------------------------------------------------ internals

  async #call<T>(endpoint: EndpointName, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, opts: CallOptions<T>): Promise<Result<T>> {
    if (!this.config.apiKey) {
      return {
        ok: false,
        error: { code: "NO_KEY", message: "no API key configured", retryable: false, shape: "none" },
        meta: { endpoint, requestId: "", httpStatus: null, latencyMs: 0, attempts: 0 },
      };
    }
    let attempt = 0;
    let lastError!: PartnerError;
    let lastMeta!: CallMeta;
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const outcome = await this.#attempt(method, path, opts.query, opts.body, "key", false);
      if (outcome.kind === "busy") {
        return { ok: false, error: BUSY_ERROR, meta: { endpoint, requestId: "", httpStatus: null, latencyMs: 0, attempts: attempt } };
      } else if (outcome.kind !== "response") {
        const code = outcome.kind === "timeout" ? "TIMEOUT" : "NETWORK";
        lastError = { code, message: code === "TIMEOUT" ? "request timed out" : "network error", retryable: true, shape: "none" };
        lastMeta = { endpoint, requestId: outcome.requestId, httpStatus: null, latencyMs: outcome.latencyMs, attempts: attempt };
      } else {
        const { httpStatus, headers, body, requestId, latencyMs } = outcome;
        lastMeta = { endpoint, requestId, httpStatus, latencyMs, attempts: attempt };
        const found = errorCodeOf(body);
        if (httpStatus >= 200 && httpStatus < 300 && !found) {
          const parsed = opts.parse(body);
          if (parsed !== UNPARSEABLE) return { ok: true, value: parsed, meta: lastMeta };
          lastError = { code: "UNPARSEABLE", message: "success response is missing a required field", retryable: false, shape: "none" };
        } else {
          const code = found?.code ?? "UNKNOWN";
          const shape = found?.shape ?? "none";
          const retryAfterSec = retryAfterSecOf(headers);
          lastError = {
            code,
            message: messageOf(body, code),
            retryable: RETRYABLE_CODES.has(code) || isRetryableHttp(httpStatus),
            shape,
            ...(code === "PRICE_MISMATCH" ? { currentPrice: currentPriceOf(body) } : {}),
            ...((code === "RATE_LIMITED" || httpStatus === 429) && retryAfterSec !== undefined ? { retryAfterSec } : {}),
          };
        }
      }
      if (!opts.retryable || !lastError.retryable || attempt >= MAX_ATTEMPTS) break;
      const table = opts.backoffMs ?? BACKOFF_MS;
      const backoffMs = table[Math.min(attempt - 1, table.length - 1)] ?? table[table.length - 1]!;
      const waitMs = Math.max(backoffMs, (lastError.retryAfterSec ?? 0) * 1_000);
      await this.clock.sleep(waitMs);
    }
    return { ok: false, error: lastError, meta: lastMeta };
  }

  /**
   * Reserves this attempt's slot before sleeping, so callers that arrive together still queue up.
   * When the wait to the next free slot is longer than maxWaitMs, no slot is reserved and no
   * request is sent: the caller answers BUSY (finding R2, a burst must not queue for minutes).
   */
  async #pace(): Promise<boolean> {
    const now = this.clock.now();
    const start = Math.max(now, this.#pacer.nextFreeAt);
    const maxWaitMs = this.config.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    if (start - now > maxWaitMs) return false;
    this.#pacer.nextFreeAt = start + this.config.minIntervalMs;
    if (start > now) await this.clock.sleep(start - now);
    return true;
  }

  #buildUrl(path: string, query: Readonly<Record<string, string>> | undefined, fullPath: boolean): string {
    const url = new URL(fullPath ? path : `${BASE_PATH}${path}`, this.config.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url.toString();
  }

  async #attempt(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    query: Readonly<Record<string, string>> | undefined,
    body: unknown,
    auth: Auth,
    fullPath: boolean,
  ): Promise<AttemptOutcome> {
    const proceed = await this.#pace();
    if (!proceed) return { kind: "busy" };
    const requestId = newId();
    const headers: Record<string, string> = {
      "user-agent": this.config.userAgent,
      accept: "application/json",
      "x-request-id": requestId,
    };
    if (auth === "key") headers["g-api-key"] = this.config.apiKey;
    else if (auth === "bearer") headers.authorization = `Bearer ${this.config.apiKey}`;
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(this.config.timeoutMs) };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const url = this.#buildUrl(path, query, fullPath);
    const started = this.clock.now();
    try {
      const response = await this.fetchImpl(url, init);
      const latencyMs = this.clock.now() - started;
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
      return { kind: "response", httpStatus: response.status, headers: response.headers, body: parsed, requestId, latencyMs };
    } catch (thrown) {
      const latencyMs = this.clock.now() - started;
      const name = thrown instanceof Error ? thrown.name : "";
      if (name === "TimeoutError" || name === "AbortError") return { kind: "timeout", requestId, latencyMs };
      return { kind: "network", requestId, latencyMs };
    }
  }
}
