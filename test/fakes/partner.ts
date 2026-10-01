/**
 * In-memory PartnerClient that behaves as the guide describes: cursor paging, state and
 * updatedSince filters, expectedPrice checks, cart limits, the three error shapes on raw().
 * No network, no key. Tests script failures with failNext() and read `calls`.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/partner.ts
 * Deps:    src/contracts, test/fakes/fixtures.ts, test/fakes/clock.ts
 * Tested:  test/contracts/ports.test.ts
 */
import type { Booking, CartItemInput, OctoCart, OctoCartItem, OctoProduct, PartnerRegistration, ProductsPage, ProductsQuery, Supplier } from "../../src/contracts/partner";
import type { CallMeta, Clock, EndpointName, PartnerClient, PartnerError, RawRequest, RawResponse, Result } from "../../src/contracts/ports";
import { FakeClock } from "./clock";
import { FIXTURE_CATEGORY1, STATE_NAMES, freshProducts } from "./fixtures";

export interface RecordedCall {
  readonly endpoint: EndpointName;
  readonly args: readonly unknown[];
}

export const FAKE_PARTNER_ID = "11111111-2222-4333-8444-555555555555";
export const FAKE_KEY = `grpn_${"0".repeat(8)}_${"0".repeat(56)}`;

const iso = (ms: number): string => new Date(ms).toISOString();

export const partnerError = (code: string, message = code, extra: Partial<PartnerError> = {}): PartnerError => ({
  code,
  message,
  retryable: code === "INTERNAL_SERVER_ERROR" || code === "NETWORK" || code === "TIMEOUT" || code === "RATE_LIMITED",
  shape: "flat",
  ...extra,
});

export class FakePartnerClient implements PartnerClient {
  readonly clock: Clock;
  products: OctoProduct[];
  /** productId to the ISO time of its last change; used by updatedSince. */
  readonly changedAt = new Map<string, string>();
  readonly carts = new Map<string, OctoCart>();
  readonly bookings = new Map<string, Booking>();
  readonly calls: RecordedCall[] = [];
  /** Top categories per product id, for the `category1` filter. A product a test adds matches no category until set here. */
  readonly category1Of = new Map<string, readonly string[]>(Object.entries(FIXTURE_CATEGORY1));
  registration: PartnerRegistration;
  /** Replace to script raw() answers. */
  onRaw: ((request: RawRequest) => RawResponse) | null = null;

  #failures = new Map<EndpointName, PartnerError[]>();
  #sequence = 0;

  constructor(clock: Clock = new FakeClock(), products: OctoProduct[] = freshProducts()) {
    this.clock = clock;
    this.products = products;
    const created = iso(clock.now());
    for (const product of products) this.changedAt.set(product.id, created);
    this.registration = {
      partnerId: FAKE_PARTNER_ID,
      displayName: "Zora Agent Lab",
      status: "active",
      partnerContactName: "Robert Vojacek",
      partnerContactEmail: "partner-contact@example.com",
      inventoryCountries: ["US"],
      inventoryStates: [],
      category0: [],
      category1: [],
      category2: [],
      cjPublisherId: null,
      logoUrl: "https://zorasocial.asajj.cz/logo.png",
      redirectUrl: "https://zorasocial.asajj.cz/3pd/return",
      maxPageSize: null,
      createdAt: created,
      updatedAt: created,
    };
  }

  // ------------------------------------------------------------ scripting

  /** The next call to `endpoint` fails with `error`. Queue several to fail several calls. */
  failNext(endpoint: EndpointName, error: PartnerError): void {
    const queue = this.#failures.get(endpoint) ?? [];
    queue.push(error);
    this.#failures.set(endpoint, queue);
  }

  /** Changes a price and marks the product as changed now. */
  setRetail(productId: string, optionId: string, retail: number): void {
    const pricing = this.#pricing(productId, optionId);
    if (!pricing) throw new Error(`no option ${productId}/${optionId} in the fake catalogue`);
    pricing.retail = retail;
    this.changedAt.set(productId, iso(this.clock.now()));
  }

  callsTo(endpoint: EndpointName): readonly RecordedCall[] {
    return this.calls.filter((call) => call.endpoint === endpoint);
  }

  // ------------------------------------------------------------ PartnerClient

  async getPartner(): Promise<Result<PartnerRegistration>> {
    return this.#answer("partners.me", [], () => this.registration);
  }

  async getSupplier(): Promise<Result<Supplier>> {
    return this.#answer("supplier", [], () => ({ id: "groupon", name: "Groupon", endpoint: "https://api.enc.groupon.com/octo-gateway/v1" }));
  }

  async listProducts(query: ProductsQuery): Promise<Result<ProductsPage>> {
    return this.#answer("products.list", [query], () => this.#page(query));
  }

  async createCart(items: readonly CartItemInput[], clientReference?: string): Promise<Result<OctoCart>> {
    return this.#answer("carts.create", [items, clientReference], () => {
      if (items.length === 0) throw partnerError("BAD_REQUEST", "at least one item is required");
      const cart = this.#emptyCart(clientReference ?? null);
      this.#addLines(cart, items);
      this.carts.set(cart.id, cart);
      return cart;
    });
  }

  async getCart(cartId: string): Promise<Result<OctoCart>> {
    return this.#answer("carts.get", [cartId], () => this.#cart(cartId));
  }

  async addCartItems(cartId: string, items: readonly CartItemInput[]): Promise<Result<OctoCart>> {
    return this.#answer("carts.items.add", [cartId, items], () => {
      const cart = this.#cart(cartId);
      this.#addLines(cart, items);
      return cart;
    });
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number, expectedPrice?: number): Promise<Result<OctoCart>> {
    return this.#answer("carts.items.update", [cartId, itemId, quantity, expectedPrice], () => {
      const cart = this.#cart(cartId);
      const line = cart.items.find((item) => item.id === itemId);
      if (!line) throw partnerError("BAD_REQUEST", `no item ${itemId} in cart ${cartId}`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw partnerError("BAD_REQUEST", "quantity must be 1..100");
      const retail = line.pricing?.retail ?? 0;
      if (expectedPrice !== undefined && expectedPrice !== retail) throw partnerError("PRICE_MISMATCH", "price changed", { currentPrice: retail, shape: "envelope" });
      line.quantity = quantity;
      line.lineTotal = retail * quantity;
      this.#retotal(cart);
      return cart;
    });
  }

  async removeCartItem(cartId: string, itemId: string): Promise<Result<OctoCart>> {
    return this.#answer("carts.items.remove", [cartId, itemId], () => {
      const cart = this.#cart(cartId);
      cart.items = cart.items.filter((item) => item.id !== itemId);
      this.#retotal(cart);
      return cart;
    });
  }

  async abandonCart(cartId: string): Promise<Result<null>> {
    return this.#answer("carts.abandon", [cartId], () => {
      const cart = this.#cart(cartId);
      cart.status = "ABANDONED";
      return null;
    });
  }

  async getBooking(grouponOrderUuid: string): Promise<Result<Booking>> {
    return this.#answer("bookings.get", [grouponOrderUuid], () => {
      const booking = this.bookings.get(grouponOrderUuid);
      if (!booking) throw partnerError("INVALID_BOOKING_UUID", `no order ${grouponOrderUuid}`);
      return booking;
    });
  }

  async raw(request: RawRequest): Promise<Result<RawResponse>> {
    return this.#answer("raw", [request], () => {
      if (this.onRaw) return this.onRaw(request);
      if (request.auth !== "key") return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "missing or invalid API key", details: null } };
      if (request.method === "GET" && request.path === "/octo-gateway/v1/products") {
        const query = request.query ?? {};
        const limit = Number(query["limit"] ?? 100);
        const page = this.#page({ limit, state: query["state"], cursor: query["cursor"], updatedSince: query["updatedSince"] });
        return { httpStatus: 200, headers: {}, body: { ...page, requestId: "raw" } };
      }
      return { httpStatus: 404, headers: {}, body: { code: "not_found", message: "no such route", details: null } };
    });
  }

  // ------------------------------------------------------------ internals

  async #answer<T>(endpoint: EndpointName, args: readonly unknown[], produce: () => T): Promise<Result<T>> {
    this.calls.push({ endpoint, args });
    const meta: CallMeta = { endpoint, requestId: `req-${++this.#sequence}`, httpStatus: 200, latencyMs: 5, attempts: 1 };
    const scripted = this.#failures.get(endpoint)?.shift();
    if (scripted) return { ok: false, error: scripted, meta: { ...meta, httpStatus: scripted.code === "NETWORK" || scripted.code === "TIMEOUT" ? null : 400 } };
    try {
      return { ok: true, value: produce(), meta };
    } catch (thrown) {
      if (typeof thrown === "object" && thrown !== null && "code" in thrown && "retryable" in thrown) {
        return { ok: false, error: thrown as PartnerError, meta: { ...meta, httpStatus: 400 } };
      }
      throw thrown;
    }
  }

  #page(query: ProductsQuery): ProductsPage {
    const limit = Math.max(1, Math.min(Number.isFinite(query.limit) ? Number(query.limit) : 100, 500));
    const offset = query.cursor ? Number(query.cursor.replace(/^c:/, "")) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw partnerError("BAD_REQUEST", "bad cursor");
    const matches = this.products.filter((product) => {
      if (query.state !== undefined) {
        const wanted = query.state;
        if (!product.locations.some((place) => place.state !== null && STATE_NAMES[place.state] === wanted)) return false;
      }
      if (query.active === true && product.status !== "active") return false;
      if (query.category1 !== undefined && !(this.category1Of.get(product.id) ?? []).includes(query.category1)) return false;
      if (query.updatedSince !== undefined && (this.changedAt.get(product.id) ?? "") < query.updatedSince) return false;
      return true;
    });
    const slice = matches.slice(offset, offset + limit);
    const hasMore = offset + limit < matches.length;
    return { products: structuredClone(slice), hasMore, nextCursor: hasMore ? `c:${offset + limit}` : null, timestamp: iso(this.clock.now()) };
  }

  #pricing(productId: string, optionId: string) {
    const option = this.products.find((product) => product.id === productId)?.options.find((candidate) => candidate.id === optionId);
    return option?.units[0]?.pricing[0];
  }

  #emptyCart(clientReference: string | null): OctoCart {
    const id = `cart-${this.carts.size + 1}`;
    const now = this.clock.now();
    return {
      id,
      buyLink: `https://partner.groupon.com/checkout/cart/${id}`,
      clientReference,
      country: "US",
      currency: "USD",
      itemCount: 0,
      items: [],
      messages: [],
      partner: { partnerId: FAKE_PARTNER_ID, name: "Zora Agent Lab" },
      status: "ACTIVE",
      testMode: false,
      totals: { currency: "USD", currencyPrecision: 2, grandTotal: 0, savings: 0, subtotal: 0 },
      utcCreatedAt: iso(now),
      utcExpiresAt: iso(now + 24 * 3_600_000),
      utcUpdatedAt: iso(now),
    };
  }

  #cart(cartId: string): OctoCart {
    const cart = this.carts.get(cartId);
    if (!cart) throw partnerError("INVALID_CART_ID", `no cart ${cartId}`, { shape: "envelope" });
    return cart;
  }

  #addLines(cart: OctoCart, items: readonly CartItemInput[]): void {
    for (const item of items) {
      const product = this.products.find((candidate) => candidate.id === item.productId);
      const option = product?.options.find((candidate) => candidate.id === item.optionId);
      const pricing = option?.units[0]?.pricing[0];
      if (!product || !option || !pricing) throw partnerError("INVALID_PRODUCT_ID", `no option ${item.productId}/${item.optionId}`, { shape: "envelope" });
      if (product.availabilityRequired) throw partnerError("PRODUCT_NOT_CARTABLE", "the product needs a date", { shape: "envelope" });
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw partnerError("BAD_REQUEST", "quantity must be 1..100", { shape: "envelope" });
      if (item.expectedPrice !== undefined && item.expectedPrice !== pricing.retail) {
        throw partnerError("PRICE_MISMATCH", "price changed", { currentPrice: pricing.retail, shape: "envelope" });
      }
      const existing = cart.items.find((line) => line.optionId === option.id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal = pricing.retail * existing.quantity;
        continue;
      }
      if (cart.items.length >= 20) throw partnerError("CART_ITEM_LIMIT", "a cart holds at most 20 options", { shape: "envelope" });
      const sellable = product.status === "active" && option.active !== false;
      const line: OctoCartItem = {
        id: option.id,
        productId: product.id,
        optionId: option.id,
        title: product.title,
        optionTitle: option.internalName,
        quantity: item.quantity,
        available: sellable,
        unavailableReason: (sellable ? null : product.status === "sold_out" ? "SOLD_OUT" : "OPTION_REMOVED") as OctoCartItem["unavailableReason"],
        pricing: { currency: "USD", currencyPrecision: 2, original: pricing.original, retail: pricing.retail, net: null, includedTaxes: [] },
        lineTotal: pricing.retail * item.quantity,
        url: `https://www.groupon.com/deals/${product.reference ?? product.id}`,
        media: {},
        role: "cover",
        width: 700,
        height: 420,
      };
      cart.items.push(line);
    }
    this.#retotal(cart);
  }

  #retotal(cart: OctoCart): void {
    const subtotal = cart.items.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
    const list = cart.items.reduce((sum, line) => sum + (line.pricing?.original ?? 0) * line.quantity, 0);
    cart.itemCount = cart.items.reduce((sum, line) => sum + line.quantity, 0);
    cart.totals = { currency: "USD", currencyPrecision: 2, subtotal, grandTotal: subtotal, savings: Math.max(0, list - subtotal) };
    cart.utcUpdatedAt = iso(this.clock.now());
  }
}
