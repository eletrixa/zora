/**
 * Compact, readable text for each tool result. The price a shopper pays is always `pay`; a promo
 * is reported apart from it, with the sentence the shopper must act on.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/mcp/format.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/agent/mcp/routes.test.ts
 */
import type { CheckoutResult, DealCard, DealDetail, OrderStatusResult } from "../../contracts/ports";

function place(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? "location unknown";
}

function dealLine(card: DealCard): string {
  const promo = card.promo ? ` — ${card.promo.instruction}` : "";
  return `${card.title} (${card.optionTitle}) — ${place(card.city, card.state)} — Pay ${card.payText}${promo} — product_id=${card.productId} option_id=${card.optionId}`;
}

export function formatSearchResults(cards: readonly DealCard[]): string {
  if (cards.length === 0) return "No deals matched. Try a broader search or different filters.";
  return cards.map(dealLine).join("\n");
}

export function formatDeal(deal: DealDetail): string {
  const lines = [`${deal.title} — ${place(deal.city, deal.state)}`, deal.shortDescription, dealLine(deal)];
  for (const option of deal.options) {
    if (!option.sellable) continue;
    const promo = option.promo ? ` — ${option.promo.instruction}` : "";
    lines.push(`Option: ${option.title} — Pay ${option.payText}${promo} — option_id=${option.optionId}`);
  }
  return lines.join("\n");
}

export function formatDealNotFound(productId: string): string {
  return `No deal found for product ${productId}. Search again with search_deals.`;
}

export function formatCheckout(result: CheckoutResult): string {
  switch (result.kind) {
    case "link": {
      const lines = result.lines.map((line) => `${line.title} x${line.quantity} — product_id=${line.productId} option_id=${line.optionId}`);
      return [...lines, `Total: ${result.totalText}`, `Checkout link: ${result.buyLink}`].join("\n");
    }
    case "price_changed":
      return `The price changed for product ${result.productId} option ${result.optionId}. It was ${(result.wasMinor / 100).toFixed(2)}, now ${result.nowText}. Confirm the new price, then call create_checkout_link again.`;
    case "unavailable":
      return `This deal is not available right now: ${result.reason}. Search for another deal with search_deals.`;
    case "not_found":
      return `No such product/option: product_id=${result.productId} option_id=${result.optionId}. Search again with search_deals.`;
    case "error":
      return `Checkout failed (${result.code}): ${result.message}. Try again in a moment.`;
  }
}

export function formatOrderStatus(result: OrderStatusResult, requestedUuid: string): string {
  switch (result.kind) {
    case "order": {
      const lines = [`Order ${result.uuid}: ${result.status}${result.pending ? " (pending)" : ""}`];
      for (const line of result.lines) {
        lines.push(`- ${line.title ?? line.optionId} x${line.quantity}: ${line.status}`);
        for (const voucher of line.vouchers) lines.push(`  voucher ${voucher.status}: ${voucher.url}`);
      }
      return lines.join("\n");
    }
    case "not_found":
      return `No order found for ${requestedUuid}.`;
    case "error":
      return `Could not check the order (${result.code}): ${result.message}.`;
  }
}
