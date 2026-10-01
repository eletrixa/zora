/**
 * In-memory fakes of the ports other lanes implement, so every lane tests against the same
 * behaviour: FakeCatalogueStore, FakeSearchIndex, FakeCartService, FakeShoppingService.
 * They follow the contracts in src/contracts/ports.ts and nothing more.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/services.ts
 * Deps:    src/contracts, src/lib/money.ts, test/fakes/fixtures.ts
 * Tested:  test/contracts/ports.test.ts
 */
import type { OctoProduct } from "../../src/contracts/partner";
import type {
  CartLineRequest,
  CartOutcome,
  CartService,
  CartSource,
  CatalogueStore,
  CheckoutItem,
  CheckoutResult,
  Clock,
  DealCard,
  DealDetail,
  OpenCart,
  OrderStatusResult,
  PartnerClient,
  PriceChangeRow,
  Result,
  SearchHit,
  SearchIndex,
  SearchQuery,
  ShoppingService,
  StoredOption,
  StoredProduct,
  UpsertStats,
} from "../../src/contracts/ports";
import { formatMoney } from "../../src/lib/money";
import { STATE_NAMES } from "./fixtures";

const iso = (ms: number): string => new Date(ms).toISOString();

/** The guide's rule: active product, no availability required, at least one option not inactive. */
export const fakeIsListable = (product: OctoProduct): boolean =>
  product.status === "active" && !product.availabilityRequired && product.options.some((option) => option.active !== false);

export function toStored(product: OctoProduct, at: string): StoredProduct {
  const options: StoredOption[] = product.options.flatMap((option) => {
    const pricing = option.units[0]?.pricing[0];
    if (!pricing) return [];
    return [
      {
        productId: product.id,
        optionId: option.id,
        title: option.internalName,
        active: option.active,
        isDefault: option.default,
        currency: pricing.currency,
        precision: pricing.currencyPrecision,
        original: pricing.original,
        retail: pricing.retail,
        promoAmount: pricing.discountedPrice?.amount ?? null,
        promoCode: pricing.discountedPrice?.promoCode ?? null,
        promoEndsAt: pricing.discountedPrice?.endDate ?? null,
      },
    ];
  });
  return {
    id: product.id,
    reference: product.reference,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    status: product.status,
    availabilityRequired: product.availabilityRequired,
    listable: fakeIsListable(product),
    categoryLabels: product.categoryLabels,
    imageUrl: product.media[0]?.url ?? null,
    options,
    locations: product.locations.map((place) => ({
      name: place.name,
      street: place.street,
      city: place.city,
      state: place.state,
      postalCode: place.postalCode,
      latitude: place.latitude,
      longitude: place.longitude,
    })),
    firstSeenAt: at,
    updatedAt: at,
  };
}

export class FakeCatalogueStore implements CatalogueStore {
  readonly products = new Map<string, StoredProduct>();
  readonly seenInRun = new Map<string, string>();
  readonly changes: (PriceChangeRow & { readonly productId: string })[] = [];

  constructor(seed: readonly OctoProduct[] = [], at: string = iso(0)) {
    for (const product of seed) this.products.set(product.id, toStored(product, at));
  }

  async upsertProducts(products: readonly OctoProduct[], syncRunId: string, seenAt: string): Promise<UpsertStats> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let priceChanges = 0;
    for (const product of products) {
      const before = this.products.get(product.id);
      const after = toStored(product, seenAt);
      this.seenInRun.set(product.id, syncRunId);
      if (!before) {
        inserted++;
        this.products.set(product.id, after);
        continue;
      }
      const same = JSON.stringify({ ...before, firstSeenAt: "", updatedAt: "" }) === JSON.stringify({ ...after, firstSeenAt: "", updatedAt: "" });
      if (same) {
        unchanged++;
        continue;
      }
      updated++;
      for (const option of after.options) {
        const old = before.options.find((candidate) => candidate.optionId === option.optionId);
        if (!old) continue;
        const pairs: readonly [PriceChangeRow["field"], number | null, number | null][] = [
          ["retail", old.retail, option.retail],
          ["original", old.original, option.original],
          ["promo", old.promoAmount, option.promoAmount],
        ];
        for (const [field, oldMinor, newMinor] of pairs) {
          if (oldMinor === newMinor) continue;
          priceChanges++;
          this.changes.unshift({ productId: product.id, optionId: option.optionId, field, oldMinor, newMinor, detectedAt: seenAt });
        }
      }
      this.products.set(product.id, { ...after, firstSeenAt: before.firstSeenAt });
    }
    return { inserted, updated, unchanged, priceChanges };
  }

  async getProduct(productId: string): Promise<StoredProduct | null> {
    return this.products.get(productId) ?? null;
  }

  async getOption(productId: string, optionId: string): Promise<StoredOption | null> {
    return this.products.get(productId)?.options.find((option) => option.optionId === optionId) ?? null;
  }

  async countProducts(): Promise<{ total: number; listable: number }> {
    const all = [...this.products.values()];
    return { total: all.length, listable: all.filter((product) => product.listable).length };
  }

  async sampleListableOptions(count: number, seed: string): Promise<readonly StoredOption[]> {
    const pool = [...this.products.values()]
      .filter((product) => product.listable)
      .flatMap((product) => product.options.filter((option) => option.active !== false))
      .sort((a, b) => `${a.productId}/${a.optionId}`.localeCompare(`${b.productId}/${b.optionId}`));
    if (pool.length === 0) return [];
    const start = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % pool.length;
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, Math.max(0, count));
  }

  async retireUnseen(syncRunId: string): Promise<number> {
    let retired = 0;
    for (const [id, product] of this.products) {
      if (this.seenInRun.get(id) === syncRunId || !product.listable) continue;
      this.products.set(id, { ...product, listable: false });
      retired++;
    }
    return retired;
  }

  async markUnavailable(productId: string, optionId: string): Promise<boolean> {
    const product = this.products.get(productId);
    if (!product || !product.options.some((option) => option.optionId === optionId)) return false;
    const options = product.options.map((option) => (option.optionId === optionId ? { ...option, active: false } : option));
    this.products.set(productId, { ...product, options, listable: product.listable && options.some((option) => option.active !== false) });
    return true;
  }

  async priceHistory(productId: string, limit: number): Promise<readonly PriceChangeRow[]> {
    return this.changes.filter((change) => change.productId === productId).slice(0, limit);
  }
}

export class FakeSearchIndex implements SearchIndex {
  readonly queries: SearchQuery[] = [];

  constructor(readonly catalogue: FakeCatalogueStore) {}

  async search(query: SearchQuery): Promise<readonly SearchHit[]> {
    this.queries.push(query);
    const words = query.text.toLowerCase().split(/\s+/).filter((word) => word.length > 1 && word !== "in" && word !== "at");
    const limit = Math.min(query.limit ?? 10, 50);
    const hits: SearchHit[] = [];
    for (const product of this.catalogue.products.values()) {
      if (!product.listable) continue;
      const option = product.options.filter((candidate) => candidate.active !== false).sort((a, b) => a.retail - b.retail)[0];
      if (!option) continue;
      const places = product.locations.map((place) => `${place.name} ${place.city} ${place.state} ${STATE_NAMES[place.state ?? ""] ?? ""}`).join(" ");
      const haystack = `${product.title} ${product.shortDescription} ${product.description} ${product.categoryLabels.join(" ")} ${places}`.toLowerCase();
      const matched = words.filter((word) => haystack.includes(word)).length;
      if (words.length > 0 && matched < words.length) continue;
      if (query.state) {
        const wanted = query.state.toLowerCase();
        if (!product.locations.some((place) => place.state?.toLowerCase() === wanted || STATE_NAMES[place.state ?? ""]?.toLowerCase() === wanted)) continue;
      }
      if (query.city && !product.locations.some((place) => place.city?.toLowerCase() === query.city?.toLowerCase())) continue;
      if (query.category && !product.categoryLabels.some((label) => label.toLowerCase() === query.category?.toLowerCase())) continue;
      if (query.maxPriceMinor !== undefined && option.retail > query.maxPriceMinor) continue;
      const place = product.locations[0];
      hits.push({
        productId: product.id,
        optionId: option.optionId,
        title: product.title,
        optionTitle: option.title,
        city: place?.city ?? null,
        state: place?.state ?? null,
        imageUrl: product.imageUrl,
        currency: option.currency,
        precision: option.precision,
        original: option.original,
        retail: option.retail,
        promoAmount: option.promoAmount,
        promoCode: option.promoCode,
        promoEndsAt: option.promoEndsAt,
        score: matched + 1 / (1 + option.retail),
      });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export class FakeCartService implements CartService {
  readonly log: { cartId: string; source: CartSource; createdAt: string; status: "open" | "abandoned" }[] = [];

  constructor(
    readonly partner: PartnerClient,
    readonly clock: Clock,
  ) {}

  async create(lines: readonly CartLineRequest[], source: CartSource): Promise<CartOutcome> {
    const first = lines[0];
    const result = await this.partner.createCart(lines.map((line) => ({ productId: line.productId, optionId: line.optionId, quantity: line.quantity, expectedPrice: line.expectedPriceMinor })));
    if (result.ok) {
      this.log.push({ cartId: result.value.id, source, createdAt: iso(this.clock.now()), status: "open" });
      return { kind: "created", cart: result.value, meta: result.meta };
    }
    const { error, meta } = result;
    if (error.code === "PRICE_MISMATCH" && error.currentPrice !== undefined && first) {
      return { kind: "price_changed", productId: first.productId, optionId: first.optionId, expectedPriceMinor: first.expectedPriceMinor, currentPriceMinor: error.currentPrice, meta };
    }
    if (error.code === "PRODUCT_NOT_CARTABLE" || error.code === "INVALID_PRODUCT_ID") {
      return { kind: "unavailable", code: error.code, message: error.message, meta, ...(lines.length === 1 && first ? { productId: first.productId, optionId: first.optionId } : {}) };
    }
    return { kind: "error", error, meta };
  }

  async abandon(cartId: string): Promise<Result<null>> {
    const result = await this.partner.abandonCart(cartId);
    const row = this.log.find((entry) => entry.cartId === cartId);
    if (result.ok && row) row.status = "abandoned";
    return result;
  }

  async listOpen(olderThanMs: number): Promise<readonly OpenCart[]> {
    const cutoff = iso(this.clock.now() - olderThanMs);
    return this.log.filter((entry) => entry.status === "open" && entry.createdAt <= cutoff).map(({ cartId, source, createdAt }) => ({ cartId, source, createdAt }));
  }
}

/** Builds a card the way the shopping lane must: pay = retail, promo kept apart. */
export function cardOf(hit: SearchHit): DealCard {
  const payText = formatMoney(hit.retail, hit.currency, hit.precision);
  const promoText = hit.promoAmount === null ? null : formatMoney(hit.promoAmount, hit.currency, hit.precision);
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
    promo:
      hit.promoAmount === null || promoText === null
        ? null
        : {
            priceMinor: hit.promoAmount,
            priceText: promoText,
            code: hit.promoCode,
            endsAt: hit.promoEndsAt,
            instruction: hit.promoCode
              ? `Type code ${hit.promoCode} at Groupon checkout to pay ${promoText}. Without it you pay ${payText}.`
              : `Groupon may offer ${promoText} at checkout. Expect to pay ${payText}.`,
          },
  };
}

/** Scriptable ShoppingService for the adapters (agent-api, agent-mcp, pages). */
export class FakeShoppingService implements ShoppingService {
  cards: readonly DealCard[] = [];
  deal: DealDetail | null = null;
  checkout: CheckoutResult = { kind: "unavailable", reason: "not scripted" };
  order: OrderStatusResult = { kind: "not_found" };
  readonly calls: { readonly method: keyof ShoppingService; readonly args: readonly unknown[] }[] = [];

  async searchDeals(query: SearchQuery, channel: CartSource): Promise<readonly DealCard[]> {
    this.calls.push({ method: "searchDeals", args: [query, channel] });
    return this.cards;
  }

  async getDeal(productId: string): Promise<DealDetail | null> {
    this.calls.push({ method: "getDeal", args: [productId] });
    return this.deal;
  }

  async createCheckoutLink(items: readonly CheckoutItem[], channel: CartSource): Promise<CheckoutResult> {
    this.calls.push({ method: "createCheckoutLink", args: [items, channel] });
    return this.checkout;
  }

  async getOrderStatus(grouponOrderUuid: string): Promise<OrderStatusResult> {
    this.calls.push({ method: "getOrderStatus", args: [grouponOrderUuid] });
    return this.order;
  }
}
