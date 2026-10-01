<!-- Module: docs/lanes/agent-mcp.md · Tested: n/a -->
# Lane agent-mcp

**You build:** `src/agent/mcp/` — an MCP server over Streamable HTTP, mounted at `/mcp` behind the agent token.
**Keep this export:** `agentMcp: Hono<AppEnv>` in `src/agent/mcp/routes.ts`.
**No new packages, no Durable Object.** Write the small JSON-RPC 2.0 server by hand. It is stateless: every POST is answered with one `application/json` response (the Streamable HTTP transport allows a plain JSON answer; no SSE stream, no session id).
**Read first:** `src/contracts/ports.ts` (ShoppingService and result types), `src/lib/http.ts`, the MCP specification for the Streamable HTTP transport and for `initialize`, `tools/list`, `tools/call` (fetch it from modelcontextprotocol.io; protocol revision `2025-06-18`, and accept `2025-03-26` and `2024-11-05` from clients).
**Test with:** `createApp({ deps: world.deps })` with `makeWorld()`; script `world.shopping`.

## Behaviour

1. `POST /mcp` with one JSON-RPC message (batches: answer 400, the 2025-06-18 revision dropped them). `GET /mcp` and `DELETE /mcp` answer 405 with `Allow: POST`.
2. Methods: `initialize` (answer `protocolVersion` = the client's if supported, else `2025-06-18`; `capabilities: { tools: {} }`; `serverInfo: { name: "zora-agent-lab", version }`; `instructions` with the price rule in two sentences), `notifications/initialized` and any other notification (no `id`) → HTTP 202 with no body, `ping` → `{}`, `tools/list`, `tools/call`. Unknown method → JSON-RPC error `-32601`. Broken JSON → `-32700`. Bad params → `-32602`.
3. Tools, channel `"agent-mcp"`:
   - `search_deals` `{ text?, state?, city?, category?, max_price_usd?, limit? }`
   - `get_deal` `{ product_id }`
   - `create_checkout_link` `{ items: [{ product_id, option_id, quantity }] }`
   - `get_order_status` `{ groupon_order_uuid }`
   Each has a JSON Schema `inputSchema` with descriptions an agent can act on. The description of `search_deals` and `create_checkout_link` states the price rule: the price to pay is `pay`, a promo needs the code typed at Groupon checkout.
4. A tool result has `content: [{ type: "text", text }]` with a compact, readable text (one deal per line: title, place, price to pay, promo sentence, ids) AND `structuredContent` with the service result. A result that is not a success (`price_changed`, `unavailable`, `not_found`, `error`) sets `isError: true` and says in plain words what happened and what to do next. Argument validation failures are tool results with `isError: true`, not protocol errors.
5. `buyLink` is given verbatim, on its own line, labelled "Checkout link".
6. Validate like the HTTP API: lengths, integers, 1..20 items, quantity 1..100, body at most 64 KB.

## Tests you must have

initialize with version negotiation; notification gets 202; tools/list returns four tools with schemas; each tool's success text and structured content; price rule sentence present in a search result with a promo; error results; unknown tool; unknown method; broken JSON; batch refused; GET refused.
