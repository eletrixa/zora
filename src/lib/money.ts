/**
 * Money helpers. Amounts are integers in minor units everywhere; this is the only formatter.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/money.ts
 * Deps:    none
 * Tested:  test/lib/lib.test.ts
 */

const SYMBOLS: Readonly<Record<string, string>> = { USD: "$" };

/** formatMoney(4900, "USD", 2) === "$49.00". Unknown currency: "49.00 XYZ". */
export function formatMoney(minor: number, currency: string, precision: number): string {
  if (!Number.isInteger(minor)) throw new Error(`money must be an integer in minor units, got ${minor}`);
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) throw new Error(`bad precision ${precision}`);
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(precision + 1, "0");
  const whole = precision === 0 ? digits : digits.slice(0, -precision);
  const fraction = precision === 0 ? "" : `.${digits.slice(-precision)}`;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = SYMBOLS[currency];
  const body = symbol ? `${symbol}${grouped}${fraction}` : `${grouped}${fraction} ${currency}`;
  return negative ? `-${body}` : body;
}

/** (retail - promo) / retail, 0 when retail is 0 or promo is not lower. */
export function gapShare(retailMinor: number, promoMinor: number): number {
  if (retailMinor <= 0 || promoMinor >= retailMinor) return 0;
  return (retailMinor - promoMinor) / retailMinor;
}
