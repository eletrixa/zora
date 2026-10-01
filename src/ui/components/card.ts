/**
 * One deal card as Finder.dc.html draws it, and the grid that lays several out: the photo or its
 * monogram, the title (the whole card is the link), the option, the place, then at the card's foot
 * You pay, the original struck and the save pill. A promo is one muted line under the option when
 * the card has a rank, else the inline promo note (the deal page's precedent). The grid numbers its
 * cards.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/components/card.ts
 * Deps:    src/lib/html.ts, src/lib/money.ts, src/contracts/ports.ts, ./blocks.ts, ./price.ts
 * Tested:  test/ui/components/card.test.ts
 */
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import type { DealCard } from "../../contracts/ports";
import { CARD_COVER, monogram, promoLine, savePill } from "./blocks";
import { promoNote } from "./price";

function locationText(city: string | null, state: string | null): string {
  if (city === null && state === null) return "Location not listed";
  return [city, state].filter((part): part is string => part !== null).join(", ");
}

function image(card: DealCard): string {
  if (card.imageUrl) return `<img class="card-image" src="${esc(card.imageUrl)}" loading="lazy" alt="">`;
  return `<div class="card-image card-image--mono" aria-hidden="true">${esc(monogram(card.title))}</div>`;
}

function saving(card: DealCard, label: string | undefined): string {
  if (card.listPriceMinor <= card.payMinor || card.listPriceMinor <= 0) return "";
  const saveMinor = card.listPriceMinor - card.payMinor;
  const sharePct = (saveMinor / card.listPriceMinor) * 100;
  return savePill({ saveText: formatMoney(saveMinor, card.currency, card.precision), sharePct, label });
}

/**
 * `options.rank` is the card's number in its list: with a promo it draws the promo line under the
 * option, so the promo price appears only inside that sentence. `options.label` is the label of the tile that
 * names this card ("Biggest saving", "Cheapest"); it fills the save pill.
 */
export function dealCard(card: DealCard, options?: { rank?: number; label?: string }): string {
  const rank = options?.rank;
  const line = card.promo && rank !== undefined ? promoLine(card.promo) : "";
  const note = card.promo && rank === undefined ? promoNote(card.promo) : "";
  const original =
    card.listPriceMinor > card.payMinor
      ? `<s class="price-list" data-label="Original">${esc(formatMoney(card.listPriceMinor, card.currency, card.precision))}</s>`
      : "";
  return (
    `<article class="card">${image(card)}<div class="card-body">` +
    `<div class="card-head"><a class="card-title" href="/deals/${esc(card.productId)}">${esc(card.title)}${CARD_COVER}</a>` +
    `<span class="card-option">${esc(card.optionTitle)}</span>` +
    `<span class="card-location">${esc(locationText(card.city, card.state))}</span>${line}</div>` +
    `<div class="card-buy"><div class="price-row"><span class="price-label">You pay</span>` +
    `<span class="price-pay" data-label="You pay">${esc(card.payText)}</span>${original}</div>` +
    `${saving(card, options?.label)}${note}</div></div></article>`
  );
}

/** Three cards a row, one on the phone, numbered from 1. */
export function dealGrid(
  cards: readonly DealCard[],
  options?: { labelFor?: (card: DealCard, rank: number) => string | undefined },
): string {
  return `<div class="grid">${cards
    .map((card, i) => {
      const label = options?.labelFor?.(card, i + 1);
      return dealCard(card, label === undefined ? { rank: i + 1 } : { rank: i + 1, label });
    })
    .join("")}</div>`;
}
