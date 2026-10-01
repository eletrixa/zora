/**
 * A small catalogue that conforms to the generated API types. Thirteen products that cover
 * every case the rules care about: promo with a code, promo without a code, no promo, sold out,
 * availability required, every option inactive, an option with active = null, two locations.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/fixtures.ts
 * Deps:    src/contracts/partner.ts
 * Tested:  test/contracts/ports.test.ts
 */
import type { OctoLocation, OctoOption, OctoProduct } from "../../src/contracts/partner";

export interface OptionSpec {
  readonly id: string;
  readonly title: string;
  readonly original: number;
  readonly retail: number;
  readonly promo?: { readonly amount: number; readonly code: string | null; readonly endDate: string | null } | null;
  readonly active?: boolean | null;
  readonly isDefault?: boolean;
}

export interface ProductSpec {
  readonly id: string;
  readonly title: string;
  readonly short: string;
  readonly categories: readonly string[];
  readonly places: readonly (readonly [name: string, city: string, state: string, postalCode: string])[];
  readonly options: readonly OptionSpec[];
  readonly status?: OctoProduct["status"];
  readonly availabilityRequired?: boolean;
}

export function makeOption(spec: OptionSpec): OctoOption {
  return {
    id: spec.id,
    internalName: spec.title,
    reference: null,
    active: spec.active === undefined ? true : spec.active,
    default: spec.isDefault ?? false,
    availabilityLocalStartTimes: [],
    cancellationCutoff: "0 hours",
    cancellationCutoffAmount: 0,
    cancellationCutoffUnit: "hour",
    requiredContactFields: [],
    restrictions: { minUnits: 1, maxUnits: null },
    selections: [],
    units: [
      {
        id: `${spec.id}-unit`,
        internalName: "Voucher",
        reference: null,
        type: "ADULT",
        restrictions: { minQuantity: 1, maxQuantity: null },
        pricing: [
          {
            currency: "USD",
            currencyPrecision: 2,
            original: spec.original,
            retail: spec.retail,
            net: null,
            includedTaxes: [],
            discountedPrice: spec.promo ? { amount: spec.promo.amount, promoCode: spec.promo.code, endDate: spec.promo.endDate } : null,
          },
        ],
      },
    ],
  };
}

const location = ([name, city, state, postalCode]: readonly [string, string, string, string], index: number): OctoLocation => ({
  id: `loc-${index}`,
  name,
  street: `${100 + index} Main St`,
  city,
  state,
  postalCode,
  country: "US",
  latitude: 41.88 + index / 100,
  longitude: -87.63 - index / 100,
});

export function makeProduct(spec: ProductSpec): OctoProduct {
  return {
    id: spec.id,
    internalName: spec.title,
    reference: `${spec.id}-permalink`,
    title: spec.title,
    shortDescription: spec.short,
    description: `${spec.short} Valid for new and returning customers. Appointment required.`,
    locale: "en-US",
    timeZone: "America/Chicago",
    status: spec.status ?? "active",
    availabilityRequired: spec.availabilityRequired ?? false,
    availabilityType: "OPENING_HOURS",
    allowFreesale: true,
    instantConfirmation: true,
    instantDelivery: true,
    redemptionMethod: "DIGITAL",
    deliveryFormats: ["QRCODE"],
    deliveryMethods: ["VOUCHER"],
    categoryLabels: [...spec.categories],
    media: [{ url: `https://img.example.test/${spec.id}.webp`, role: "cover", width: 700, height: 420 }],
    locations: spec.places.map(location),
    options: spec.options.map(makeOption),
  };
}

const END = "2026-10-31T23:59:00-05:00";

export const FIXTURE_SPECS: readonly ProductSpec[] = [
  {
    id: "p-massage-chi",
    title: "Swedish Massage at Foot Smile Spa",
    short: "A 60 or 90 minute Swedish massage that eases sore muscles.",
    categories: ["Beauty & Spas", "Massage"],
    places: [["Foot Smile Spa", "Chicago", "IL", "60611"]],
    options: [
      { id: "o-massage-chi-60", title: "60-Minute Swedish Massage", original: 8000, retail: 4900, promo: { amount: 3920, code: "SAVE20", endDate: END }, isDefault: true },
      { id: "o-massage-chi-90", title: "90-Minute Swedish Massage", original: 12000, retail: 6900 },
    ],
  },
  {
    id: "p-massage-nyc",
    title: "Deep Tissue Massage at Hudson Wellness",
    short: "A 60 minute deep tissue massage in Midtown.",
    categories: ["Beauty & Spas", "Massage"],
    places: [["Hudson Wellness", "New York", "NY", "10018"]],
    options: [{ id: "o-massage-nyc-60", title: "60-Minute Deep Tissue Massage", original: 11000, retail: 5900, isDefault: true }],
  },
  {
    id: "p-oil-chi",
    title: "Full Synthetic Oil Change at Lakeview Auto",
    short: "Oil change with filter and a 21-point inspection.",
    categories: ["Automotive", "Oil Change"],
    places: [["Lakeview Auto", "Chicago", "IL", "60657"]],
    options: [{ id: "o-oil-chi", title: "Full Synthetic Oil Change", original: 8999, retail: 4499, promo: { amount: 3599, code: "AUTO20", endDate: END }, isDefault: true }],
  },
  {
    id: "p-bowling-chi",
    title: "Two Hours of Bowling for Four at Pin Palace",
    short: "Lane rental and shoes for up to four people.",
    categories: ["Things To Do", "Bowling"],
    places: [["Pin Palace", "Chicago", "IL", "60618"]],
    options: [{ id: "o-bowling-chi", title: "Two Hours of Bowling for Four", original: 9000, retail: 3900, isDefault: true }],
  },
  {
    id: "p-facial-la",
    title: "Hydrafacial at Glow Studio",
    short: "A 45 minute hydrafacial for clear skin.",
    categories: ["Beauty & Spas", "Facial"],
    places: [["Glow Studio", "Los Angeles", "CA", "90028"]],
    options: [{ id: "o-facial-la", title: "One Hydrafacial", original: 19900, retail: 9900, promo: { amount: 8415, code: "GLOW15", endDate: null }, isDefault: true }],
  },
  {
    id: "p-pizza-chi",
    title: "Pizza Dinner for Two at Nonna's",
    short: "One large pizza, two salads and two soft drinks.",
    categories: ["Food & Drink", "Pizza"],
    places: [["Nonna's", "Chicago", "IL", "60614"]],
    options: [{ id: "o-pizza-chi", title: "Pizza Dinner for Two", original: 5000, retail: 2900, isDefault: true }],
  },
  {
    id: "p-yoga-austin",
    title: "Ten Yoga Classes at Sunrise Yoga",
    short: "Ten drop-in classes for every level.",
    categories: ["Health & Fitness", "Yoga"],
    places: [["Sunrise Yoga", "Austin", "TX", "78701"]],
    options: [{ id: "o-yoga-austin", title: "Ten Yoga Classes", original: 15000, retail: 4500, promo: { amount: 3600, code: null, endDate: END }, isDefault: true }],
  },
  {
    id: "p-escape-nyc",
    title: "Escape Room for Four at Lockdown NYC",
    short: "A private 60 minute escape room for four players.",
    categories: ["Things To Do", "Escape Room"],
    places: [["Lockdown NYC", "New York", "NY", "10001"]],
    options: [{ id: "o-escape-nyc", title: "Escape Room for Four", original: 14000, retail: 7900, isDefault: true }],
  },
  {
    id: "p-soldout-chi",
    title: "Hot Stone Massage at River North Spa",
    short: "A 75 minute hot stone massage.",
    categories: ["Beauty & Spas", "Massage"],
    places: [["River North Spa", "Chicago", "IL", "60654"]],
    status: "sold_out",
    options: [{ id: "o-soldout-chi", title: "75-Minute Hot Stone Massage", original: 13000, retail: 6500, isDefault: true }],
  },
  {
    id: "p-kayak-chi",
    title: "Kayak Tour on the Chicago River",
    short: "A guided two hour kayak tour. Date must be booked.",
    categories: ["Things To Do", "Kayaking"],
    places: [["Urban Kayaks", "Chicago", "IL", "60601"]],
    availabilityRequired: true,
    options: [{ id: "o-kayak-chi", title: "Two-Hour Kayak Tour", original: 7000, retail: 4200, isDefault: true }],
  },
  {
    id: "p-carwash-chi",
    title: "Full-Service Car Wash at Sparkle Wash",
    short: "Exterior wash and interior vacuum.",
    categories: ["Automotive", "Car Wash"],
    places: [["Sparkle Wash", "Chicago", "IL", "60622"]],
    options: [{ id: "o-carwash-chi", title: "Full-Service Car Wash", original: 3000, retail: 1500, active: false, isDefault: true }],
  },
  {
    id: "p-nails-miami",
    title: "Gel Manicure at Coral Nails",
    short: "A gel manicure with a colour of your choice.",
    categories: ["Beauty & Spas", "Nails"],
    places: [["Coral Nails", "Miami", "FL", "33130"]],
    options: [{ id: "o-nails-miami", title: "One Gel Manicure", original: 4000, retail: 2200, active: null, isDefault: true }],
  },
  {
    id: "p-laser-chi",
    title: "Laser Hair Removal at Smooth Clinic",
    short: "Six sessions on a small area.",
    categories: ["Beauty & Spas", "Hair Removal"],
    places: [
      ["Smooth Clinic Loop", "Chicago", "IL", "60602"],
      ["Smooth Clinic Evanston", "Evanston", "IL", "60201"],
    ],
    options: [
      { id: "o-laser-chi-small", title: "Six Sessions, Small Area", original: 50000, retail: 9900, isDefault: true },
      { id: "o-laser-chi-old", title: "Three Sessions, Small Area", original: 25000, retail: 5900, active: false },
    ],
  },
];

export const FIXTURE_PRODUCTS: readonly OctoProduct[] = FIXTURE_SPECS.map(makeProduct);

/** Ids of the fixture products the guide's rule makes listable. */
export const LISTABLE_IDS: readonly string[] = [
  "p-massage-chi",
  "p-massage-nyc",
  "p-oil-chi",
  "p-bowling-chi",
  "p-facial-la",
  "p-pizza-chi",
  "p-yoga-austin",
  "p-escape-nyc",
  "p-nails-miami",
  "p-laser-chi",
];

/**
 * Groupon's top category (category1 permalink) per fixture product, as the products API would answer the
 * `category1` filter. Bowling sits in two categories on purpose. The catalogue never stores this; the daily
 * category walk tags it into product_categories.
 */
export const FIXTURE_CATEGORY1: Readonly<Record<string, readonly string[]>> = {
  "p-massage-chi": ["beauty-and-spas"],
  "p-massage-nyc": ["beauty-and-spas"],
  "p-oil-chi": ["automotive"],
  "p-bowling-chi": ["things-to-do", "food-and-drink"],
  "p-facial-la": ["beauty-and-spas"],
  "p-pizza-chi": ["food-and-drink"],
  "p-yoga-austin": ["health-and-fitness"],
  "p-escape-nyc": ["things-to-do"],
  "p-soldout-chi": ["beauty-and-spas"],
  "p-kayak-chi": ["things-to-do"],
  "p-carwash-chi": ["automotive"],
  "p-nails-miami": ["beauty-and-spas"],
  "p-laser-chi": ["beauty-and-spas"],
};

export const STATE_NAMES: Readonly<Record<string, string>> = {
  IL: "Illinois",
  NY: "New York",
  CA: "California",
  TX: "Texas",
  FL: "Florida",
};

/** A fresh deep copy, so a test can change prices without touching other tests. */
export const freshProducts = (): OctoProduct[] => structuredClone(FIXTURE_PRODUCTS) as OctoProduct[];
