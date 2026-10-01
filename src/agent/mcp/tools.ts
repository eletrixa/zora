/**
 * The four MCP tools: schema, argument validation and the ShoppingService call behind each one.
 * A tool never throws; it always returns a tool result, isError true or false.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/mcp/tools.ts
 * Deps:    src/contracts/ports.ts, src/agent/mcp/schemas.ts, src/agent/mcp/format.ts
 * Tested:  test/agent/mcp/routes.test.ts
 */
import type { ShoppingService } from "../../contracts/ports";
import { formatCheckout, formatDeal, formatDealNotFound, formatOrderStatus, formatSearchResults } from "./format";
import {
  CREATE_CHECKOUT_LINK_SCHEMA,
  GET_DEAL_SCHEMA,
  GET_ORDER_STATUS_SCHEMA,
  SEARCH_DEALS_SCHEMA,
  validateCreateCheckoutLink,
  validateGetDeal,
  validateGetOrderStatus,
  validateSearchDeals,
} from "./schemas";

export interface ToolContent {
  readonly type: "text";
  readonly text: string;
}

export interface ToolResult {
  readonly content: readonly ToolContent[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

function argumentError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  call(shopping: ShoppingService, args: unknown): Promise<ToolResult>;
}

const CHANNEL = "agent-mcp" as const;

const PRICE_RULE_SENTENCE = "The price to pay at checkout is `pay`; a promo needs its code typed at Groupon checkout, or the shopper pays `pay`.";

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "search_deals",
    description: `Search Groupon deals by text, place, category and price. ${PRICE_RULE_SENTENCE}`,
    inputSchema: SEARCH_DEALS_SCHEMA,
    async call(shopping, args) {
      const parsed = validateSearchDeals(args);
      if (!parsed.ok) return argumentError(parsed.message);
      const cards = await shopping.searchDeals(parsed.value, CHANNEL);
      return { content: [{ type: "text", text: formatSearchResults(cards) }], structuredContent: { deals: cards } };
    },
  },
  {
    name: "get_deal",
    description: "Get the full detail of one deal by product id, including every sellable option and its price.",
    inputSchema: GET_DEAL_SCHEMA,
    async call(shopping, args) {
      const parsed = validateGetDeal(args);
      if (!parsed.ok) return argumentError(parsed.message);
      const deal = await shopping.getDeal(parsed.value.productId);
      if (!deal) return { content: [{ type: "text", text: formatDealNotFound(parsed.value.productId) }], structuredContent: { found: false, productId: parsed.value.productId }, isError: true };
      return { content: [{ type: "text", text: formatDeal(deal) }], structuredContent: { deal } };
    },
  },
  {
    name: "create_checkout_link",
    description: `Put 1..20 product/option lines in a cart and get the Groupon checkout link (buyLink), verbatim. ${PRICE_RULE_SENTENCE}`,
    inputSchema: CREATE_CHECKOUT_LINK_SCHEMA,
    async call(shopping, args) {
      const parsed = validateCreateCheckoutLink(args);
      if (!parsed.ok) return argumentError(parsed.message);
      const result = await shopping.createCheckoutLink(parsed.value, CHANNEL);
      return { content: [{ type: "text", text: formatCheckout(result) }], structuredContent: { checkout: result }, isError: result.kind !== "link" };
    },
  },
  {
    name: "get_order_status",
    description: "Look up a Groupon order by its groupon_order_uuid and report its status and voucher links.",
    inputSchema: GET_ORDER_STATUS_SCHEMA,
    async call(shopping, args) {
      const parsed = validateGetOrderStatus(args);
      if (!parsed.ok) return argumentError(parsed.message);
      const result = await shopping.getOrderStatus(parsed.value.uuid);
      return { content: [{ type: "text", text: formatOrderStatus(result, parsed.value.uuid) }], structuredContent: { order: result }, isError: result.kind !== "order" };
    },
  },
];

export const TOOL_LIST = TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
