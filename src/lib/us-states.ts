/**
 * The fifty US states the partner API knows: two-letter code to full name. Locations carry the
 * code ("IL"); the `state` filter of GET /products and the inventory scope take the full name.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/us-states.ts
 * Deps:    none
 * Tested:  test/lib/lib.test.ts
 */

export const STATE_NAME_BY_CODE: Readonly<Record<string, string>> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const CODE_BY_NAME: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code]));

/** "il", "IL" or "Illinois" to "IL". null for anything else. */
export function stateCode(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (value.length === 0) return null;
  const upper = value.toUpperCase();
  if (upper.length === 2 && STATE_NAME_BY_CODE[upper]) return upper;
  return CODE_BY_NAME[value.toLowerCase()] ?? null;
}

/** "IL" to "Illinois". null for an unknown code. */
export const stateName = (code: string | null | undefined): string | null => STATE_NAME_BY_CODE[(code ?? "").toUpperCase()] ?? null;
