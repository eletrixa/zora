/**
 * The shopping service: search cards, deal detail, checkout link and order status, behind one
 * interface the HTTP API, the MCP server and the pages all call. Every call logs one
 * agent_requests row; a failed log write never fails the call.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/shopping/index.ts
 * Deps:    src/contracts, src/lib/money.ts
 * Tested:  test/shopping/shopping.test.ts
 */
import { PENDING_BOOKING_STATUSES } from "../contracts/partner";
import type {
  CartLineRequest,
  CartService,
  CartSource,
  CatalogueStore,
  CheckoutItem,
  CheckoutLine,
  CheckoutResult,
  Clock,
  DealCard,
  DealDetail,
  DealOption,
  OrderLine,
  OrderStatusResult,
  PartnerClient,
  PromoNote,
  SearchIndex,
  SearchQuery,
  ShoppingService,
  StoredOption,
  StoredProduct,
} from "../contracts/ports";
import { formatMoney } from "../lib/money";

export interface ShoppingParts {
  readonly search: SearchIndex;
  readonly catalogue: CatalogueStore;
  readonly carts: CartService;
  readonly partner: PartnerClient;
  readonly db: D1Database;
  readonly clock: Clock;
}

interface PriceShape {
  readonly currency: string;
  readonly precision: number;
  readonly retail: number;
  readonly promoAmount: number | null;
  readonly promoCode: string | null;
  readonly promoEndsAt: string | null;
}

/** The price rule: promo is set only when it is actually lower than retail. */
function promoOf(shape: PriceShape): PromoNote | null {
  if (shape.promoAmount === null || shape.promoAmount >= shape.retail) return null;
  const priceText = formatMoney(shape.promoAmount, shape.currency, shape.precision);
  const payText = formatMoney(shape.retail, shape.currency, shape.precision);
  return {
    priceMinor: shape.promoAmount,
    priceText,
    code: shape.promoCode,
    endsAt: shape.promoEndsAt,
    instruction: shape.promoCode
      ? `Type code ${shape.promoCode} at Groupon checkout to pay ${priceText}. Without it you pay ${payText}.`
      : `Groupon may offer ${priceText} at checkout. Expect to pay ${payText}.`,
  };
}

function cardFromHit(hit: import("../contracts/ports").SearchHit): DealCard {
  const payText = formatMoney(hit.retail, hit.currency, hit.precision);
  return {
    productId: hit.productId,
    optionId: hit.optionId,
    title: hit.title,
    optionTitle: hit.optionTitle,
    city: hit.city,
    state: hit.state,
    imageUrl: hit.imageUrl,
    currency: hit.currency,
    precision: hit.precision,
    listPriceMinor: hit.original,
    payMinor: hit.retail,
    payText,
    promo: promoOf(hit),
  };
}

function cardFromOption(product: StoredProduct, option: StoredOption): DealCard {
  const place = product.locations[0];
  const payText = formatMoney(option.retail, option.currency, option.precision);
  return {
    productId: product.id,
    optionId: option.optionId,
    title: product.title,
    optionTitle: option.title,
    city: place?.city ?? null,
    state: place?.state ?? null,
    imageUrl: product.imageUrl,
    currency: option.currency,
    precision: option.precision,
    listPriceMinor: option.original,
    payMinor: option.retail,
    payText,
    promo: promoOf(option),
  };
}

function dealOptionOf(option: StoredOption): DealOption {
  return {
    optionId: option.optionId,
    title: option.title,
    sellable: option.active !== false,
    listPriceMinor: option.original,
    payMinor: option.retail,
    payText: formatMoney(option.retail, option.currency, option.precision),
    promo: promoOf(option),
  };
}

/** The cheapest sellable option of a listable product. Always exists when the product is listable. */
function cheapestSellable(product: StoredProduct): StoredOption | null {
  const sellable = product.options.filter((option) => option.active !== false);
  return sellable.slice().sort((a, b) => a.retail - b.retail)[0] ?? null;
}

export function createShoppingService(parts: ShoppingParts): ShoppingService {
  const { search, catalogue, carts, partner, db, clock } = parts;

  async function logRequest(args: {
    readonly channel: CartSource;
    readonly tool: string;
    readonly queryText: string | null;
    readonly resultCount: number | null;
    readonly startedAt: number;
    readonly outcome: string;
  }): Promise<void> {
    try {
      const latencyMs = clock.now() - args.startedAt;
      await db
        .prepare("INSERT INTO agent_requests (at, channel, tool, query_text, result_count, latency_ms, outcome) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
        .bind(new Date(clock.now()).toISOString(), args.channel, args.tool, args.queryText, args.resultCount, latencyMs, args.outcome)
        .run();
    } catch (cause) {
      console.error(JSON.stringify({ msg: "agent_requests log failed", tool: args.tool, error: cause instanceof Error ? cause.message : String(cause) }));
    }
  }

  async function searchDeals(query: SearchQuery, channel: CartSource): Promise<readonly DealCard[]> {
    const startedAt = clock.now();
    const hits = await search.search(query);
    const cards = hits.map(cardFromHit);
    await logRequest({ channel, tool: "search_deals", queryText: query.text, resultCount: cards.length, startedAt, outcome: cards.length === 0 ? "empty" : "ok" });
    return cards;
  }

  async function getDeal(productId: string): Promise<DealDetail | null> {
    const startedAt = clock.now();
    const product = await catalogue.getProduct(productId);
    if (!product || !product.listable) {
      await logRequest({ channel: "web", tool: "get_deal", queryText: productId, resultCount: 0, startedAt, outcome: "not_found" });
      return null;
    }
    const cheapest = cheapestSellable(product);
    if (!cheapest) {
      await logRequest({ channel: "web", tool: "get_deal", queryText: productId, resultCount: 0, startedAt, outcome: "not_found" });
      return null;
    }
    const card = cardFromOption(product, cheapest);
    const detail: DealDetail = {
      ...card,
      shortDescription: product.shortDescription,
      description: product.description,
      categoryLabels: product.categoryLabels,
      options: product.options.map(dealOptionOf),
      locations: product.locations,
    };
    await logRequest({ channel: "web", tool: "get_deal", queryText: productId, resultCount: 1, startedAt, outcome: "ok" });
    return detail;
  }

  async function createCheckoutLink(items: readonly CheckoutItem[], channel: CartSource): Promise<CheckoutResult> {
    const startedAt = clock.now();
    const log = (outcome: string, resultCount: number | null = items.length) => logRequest({ channel, tool: "create_checkout_link", queryText: null, resultCount, startedAt, outcome });

    if (items.length < 1 || items.length > 20 || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)) {
      await log("error", null);
      return { kind: "error", code: "BAD_REQUEST", message: "checkout takes 1 to 20 items, each with quantity 1 to 100" };
    }

    const resolved: { readonly item: CheckoutItem; readonly option: StoredOption }[] = [];
    for (const item of items) {
      const product = await catalogue.getProduct(item.productId);
      const option = product?.options.find((candidate) => candidate.optionId === item.optionId) ?? null;
      if (!product || !option) {
        await log("not_found");
        return { kind: "not_found", productId: item.productId, optionId: item.optionId };
      }
      if (!product.listable || option.active === false) {
        await log("unavailable");
        return { kind: "unavailable", reason: !product.listable ? "this product is no longer listed" : "this option is no longer sellable" };
      }
      resolved.push({ item, option });
    }

    const lines: CartLineRequest[] = resolved.map(({ item, option }) => ({
      productId: item.productId,
      optionId: item.optionId,
      quantity: item.quantity,
      expectedPriceMinor: option.retail,
    }));
    const outcome = await carts.create(lines, channel);

    switch (outcome.kind) {
      case "created": {
        const cart = outcome.cart;
        const result: CheckoutResult = {
          kind: "link",
          cartId: cart.id,
          buyLink: cart.buyLink,
          currency: cart.currency,
          precision: cart.totals.currencyPrecision,
          totalMinor: cart.totals.grandTotal,
          totalText: formatMoney(cart.totals.grandTotal, cart.currency, cart.totals.currencyPrecision),
          lines: cart.items.map(
            (line): CheckoutLine => ({
              productId: line.productId,
              optionId: line.optionId,
              title: line.title ?? "",
              quantity: line.quantity,
              unitPayMinor: line.pricing?.retail ?? 0,
              lineTotalMinor: line.lineTotal ?? 0,
            }),
          ),
          expiresAt: cart.utcExpiresAt,
        };
        await log("ok", cart.items.length);
        return result;
      }
      case "price_changed": {
        const option = resolved.find((candidate) => candidate.item.productId === outcome.productId && candidate.item.optionId === outcome.optionId)?.option;
        const currency = option?.currency ?? "USD";
        const precision = option?.precision ?? 2;
        await log("price_changed");
        return {
          kind: "price_changed",
          productId: outcome.productId,
          optionId: outcome.optionId,
          wasMinor: outcome.expectedPriceMinor,
          nowMinor: outcome.currentPriceMinor,
          nowText: formatMoney(outcome.currentPriceMinor, currency, precision),
        };
      }
      case "unavailable": {
        if (outcome.productId !== undefined && outcome.optionId !== undefined) {
          const { productId, optionId } = outcome;
          try {
            await catalogue.markUnavailable(productId, optionId);
          } catch (cause) {
            console.error(
              JSON.stringify({ at: "shopping.createCheckoutLink", problem: "markUnavailable failed", productId, optionId, message: cause instanceof Error ? cause.message : String(cause) }),
            );
          }
        }
        await log("unavailable");
        return { kind: "unavailable", reason: outcome.message };
      }
      case "error": {
        await log("error");
        return { kind: "error", code: outcome.error.code, message: outcome.error.message };
      }
    }
  }

  async function getOrderStatus(grouponOrderUuid: string): Promise<OrderStatusResult> {
    const startedAt = clock.now();
    const channel: CartSource = "web";
    const booked = await partner.getBooking(grouponOrderUuid);
    if (!booked.ok) {
      const outcome = booked.error.code === "INVALID_BOOKING_UUID" ? "not_found" : "error";
      await logRequest({ channel, tool: "get_order_status", queryText: grouponOrderUuid, resultCount: null, startedAt, outcome });
      if (booked.error.code === "INVALID_BOOKING_UUID") return { kind: "not_found" };
      return { kind: "error", code: booked.error.code, message: booked.error.message };
    }

    const booking = booked.value;
    const lines: OrderLine[] = [];
    for (const item of booking.items) {
      const product = item.productId ? await catalogue.getProduct(item.productId) : null;
      lines.push({
        productId: item.productId,
        optionId: item.optionId,
        title: product?.title ?? null,
        quantity: item.quantity,
        status: item.status,
        vouchers: item.unitItems.map((unit) => ({ status: unit.status, url: unit.myGrouponUrl })),
      });
    }

    const nowIso = new Date(clock.now()).toISOString();
    const rawJson = JSON.stringify(booking);
    const existing = await db.prepare("SELECT groupon_order_uuid FROM orders WHERE groupon_order_uuid = ?1").bind(grouponOrderUuid).first();
    if (existing) {
      await db
        .prepare("UPDATE orders SET status = ?2, last_checked_at = ?3, raw_json = ?4 WHERE groupon_order_uuid = ?1")
        .bind(grouponOrderUuid, booking.status, nowIso, rawJson)
        .run();
    } else {
      await db
        .prepare("INSERT INTO orders (groupon_order_uuid, source, first_seen_at, last_checked_at, status, raw_json) VALUES (?1, 'manual', ?2, ?2, ?3, ?4)")
        .bind(grouponOrderUuid, nowIso, booking.status, rawJson)
        .run();
    }

    await logRequest({ channel, tool: "get_order_status", queryText: grouponOrderUuid, resultCount: lines.length, startedAt, outcome: "ok" });
    return { kind: "order", uuid: booking.uuid, status: booking.status, pending: PENDING_BOOKING_STATUSES.includes(booking.status), lines };
  }

  return { searchDeals, getDeal, createCheckoutLink, getOrderStatus };
}
