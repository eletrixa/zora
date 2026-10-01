/**
 * The price block ("you pay" plus the struck list price) and the promo note. The promo price
 * never stands alone: it appears only inside the fixed instruction sentence.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/components/price.ts
 * Deps:    src/lib/html.ts, src/lib/money.ts, src/contracts/ports.ts
 * Tested:  test/ui/components/price.test.ts
 */
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import type { DealCard, PromoNote } from "../../contracts/ports";

export function promoNote(promo: PromoNote): string {
  return `<div class="promo"><svg class="promo-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B93A22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle></svg><span class="promo-text">${esc(promo.instruction)}</span></div>`;
}

export function priceBlock(
  card: Pick<DealCard, "payText" | "listPriceMinor" | "payMinor" | "currency" | "precision" | "promo">,
  size: "card" | "large" = "card",
): string {
  const sizeClass = size === "large" ? " price--large" : "";
  const list =
    card.listPriceMinor > card.payMinor
      ? `<span class="price-list">${esc(formatMoney(card.listPriceMinor, card.currency, card.precision))}</span>`
      : "";
  const promo = card.promo ? promoNote(card.promo) : "";
  return `<div class="price${sizeClass}"><div class="price-row"><span class="price-label">You pay</span><span class="price-pay">${esc(card.payText)}</span>${list}</div>${promo}</div>`;
}
