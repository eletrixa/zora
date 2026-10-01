/**
 * Pure mapping between an OctoProduct and the catalogue's SQL rows: bind-parameter builders for
 * writes, and row-to-domain mappers for reads. No I/O here, so it is cheap to test in isolation.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/catalogue/rows.ts
 * Deps:    src/contracts/partner.ts, src/contracts/ports.ts, src/lib/us-states.ts
 * Tested:  test/catalogue/index.test.ts
 */
import type { OctoLocation, OctoOption, OctoPricing, OctoProduct } from "../contracts/partner";
import type { StoredLocation, StoredOption, StoredProduct } from "../contracts/ports";
import { stateName } from "../lib/us-states";

/** places text of products_fts: for each location, name/city/state code/full state name, space separated. */
export const placesText = (product: OctoProduct): string =>
  product.locations
    .flatMap((place) => [place.name, place.city, place.state, stateName(place.state)])
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");

export const categoriesText = (product: OctoProduct): string => product.categoryLabels.join(" ");

/** The guide's price rule: the first pricing entry of the option's first unit. null = not stored. */
export const pricingOf = (option: OctoOption): OctoPricing | null => option.units[0]?.pricing[0] ?? null;

/** Options with a price to store, in the order the API sent them (= the order we keep on read). */
export const storableOptions = (product: OctoProduct): readonly OctoOption[] => product.options.filter((option) => pricingOf(option) !== null);

// ---------------------------------------------------------------- write: bind-parameter tuples

export type InsertProductParams = readonly [
  id: string,
  reference: string | null,
  title: string,
  shortDescription: string,
  description: string,
  status: string,
  availabilityRequired: number,
  listable: number,
  categoryLabels: string,
  imageUrl: string | null,
  rawJson: string,
  contentHash: string,
  firstSeenAt: string,
  updatedAt: string,
  lastSeenAt: string,
  lastSeenRunId: string,
];

export function insertProductParams(product: OctoProduct, listable: boolean, contentHash: string, seenAt: string, syncRunId: string): InsertProductParams {
  return [
    product.id,
    product.reference,
    product.title,
    product.shortDescription,
    product.description,
    product.status,
    product.availabilityRequired ? 1 : 0,
    listable ? 1 : 0,
    JSON.stringify(product.categoryLabels),
    product.media[0]?.url ?? null,
    JSON.stringify(product),
    contentHash,
    seenAt,
    seenAt,
    seenAt,
    syncRunId,
  ];
}

export type UpdateChangedProductParams = readonly [
  reference: string | null,
  title: string,
  shortDescription: string,
  description: string,
  status: string,
  availabilityRequired: number,
  listable: number,
  categoryLabels: string,
  imageUrl: string | null,
  rawJson: string,
  contentHash: string,
  updatedAt: string,
  lastSeenAt: string,
  lastSeenRunId: string,
  id: string,
];

export function updateChangedProductParams(product: OctoProduct, listable: boolean, contentHash: string, seenAt: string, syncRunId: string): UpdateChangedProductParams {
  return [
    product.reference,
    product.title,
    product.shortDescription,
    product.description,
    product.status,
    product.availabilityRequired ? 1 : 0,
    listable ? 1 : 0,
    JSON.stringify(product.categoryLabels),
    product.media[0]?.url ?? null,
    JSON.stringify(product),
    contentHash,
    seenAt,
    seenAt,
    syncRunId,
    product.id,
  ];
}

export type UpsertOptionParams = readonly [
  productId: string,
  optionId: string,
  title: string,
  active: number | null,
  isDefault: number,
  currency: string,
  precision: number,
  original: number,
  retail: number,
  promoAmount: number | null,
  promoCode: string | null,
  promoEndsAt: string | null,
  updatedAt: string,
];

export function upsertOptionParams(productId: string, option: OctoOption, pricing: OctoPricing, seenAt: string): UpsertOptionParams {
  return [
    productId,
    option.id,
    option.internalName,
    option.active === null ? null : option.active ? 1 : 0,
    option.default ? 1 : 0,
    pricing.currency,
    pricing.currencyPrecision,
    pricing.original,
    pricing.retail,
    pricing.discountedPrice?.amount ?? null,
    pricing.discountedPrice?.promoCode ?? null,
    pricing.discountedPrice?.endDate ?? null,
    seenAt,
  ];
}

export type InsertLocationParams = readonly [
  productId: string,
  idx: number,
  name: string | null,
  street: string | null,
  city: string | null,
  state: string | null,
  postalCode: string | null,
  latitude: number | null,
  longitude: number | null,
];

export const insertLocationParams = (productId: string, place: OctoLocation, idx: number): InsertLocationParams => [
  productId,
  idx,
  place.name,
  place.street,
  place.city,
  place.state,
  place.postalCode,
  place.latitude,
  place.longitude,
];

// ---------------------------------------------------------------- read: row-to-domain mappers

export interface OptionRow {
  readonly product_id: string;
  readonly option_id: string;
  readonly title: string;
  readonly active: number | null;
  readonly is_default: number;
  readonly currency: string;
  readonly precision: number;
  readonly original: number;
  readonly retail: number;
  readonly promo_amount: number | null;
  readonly promo_code: string | null;
  readonly promo_ends_at: string | null;
}

export const mapOptionRow = (row: OptionRow): StoredOption => ({
  productId: row.product_id,
  optionId: row.option_id,
  title: row.title,
  active: row.active === null ? null : row.active !== 0,
  isDefault: row.is_default !== 0,
  currency: row.currency,
  precision: row.precision,
  original: row.original,
  retail: row.retail,
  promoAmount: row.promo_amount,
  promoCode: row.promo_code,
  promoEndsAt: row.promo_ends_at,
});

export interface LocationRow {
  readonly name: string | null;
  readonly street: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postal_code: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export const mapLocationRow = (row: LocationRow): StoredLocation => ({
  name: row.name,
  street: row.street,
  city: row.city,
  state: row.state,
  postalCode: row.postal_code,
  latitude: row.latitude,
  longitude: row.longitude,
});

export interface ProductRow {
  readonly id: string;
  readonly reference: string | null;
  readonly title: string;
  readonly short_description: string;
  readonly description: string;
  readonly status: string;
  readonly availability_required: number;
  readonly listable: number;
  readonly category_labels: string;
  readonly image_url: string | null;
  readonly first_seen_at: string;
  readonly updated_at: string;
}

export const mapProductRow = (row: ProductRow, options: readonly StoredOption[], locations: readonly StoredLocation[]): StoredProduct => ({
  id: row.id,
  reference: row.reference,
  title: row.title,
  shortDescription: row.short_description,
  description: row.description,
  status: row.status as StoredProduct["status"],
  availabilityRequired: row.availability_required !== 0,
  listable: row.listable !== 0,
  categoryLabels: JSON.parse(row.category_labels) as readonly string[],
  imageUrl: row.image_url,
  options,
  locations,
  firstSeenAt: row.first_seen_at,
  updatedAt: row.updated_at,
});
