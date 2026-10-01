/**
 * MCP server (Streamable HTTP), mounted at /mcp behind the agent token. Stateless: every POST
 * gets one application/json answer, no SSE stream, no session id. Handles initialize,
 * notifications/initialized, ping, tools/list and tools/call for the four shopping tools.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/mcp/routes.ts
 * Deps:    hono, src/contracts, src/agent/mcp/{protocol,tools}.ts
 * Tested:  test/agent/mcp/routes.test.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../../contracts/env";
import { errorJson, PRIVATE_HEADERS } from "../../lib/http";
import { INVALID_PARAMS, isPlainObject, jsonRpcError, jsonRpcResult, METHOD_NOT_FOUND, PARSE_ERROR, type JsonRpcId, type JsonRpcResponse } from "./protocol";
import { findTool, TOOL_LIST } from "./tools";

export const agentMcp = new Hono<AppEnv>();

const MAX_BODY_BYTES = 64 * 1024;
const SUPPORTED_VERSIONS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const DEFAULT_VERSION = "2025-06-18";
const SERVER_VERSION = "1.0.0";

const PRICE_RULE_INSTRUCTIONS =
  "search_deals, get_deal and create_checkout_link report the price the shopper pays as `pay`. " +
  "A promo price is reported apart from `pay` and only applies when its code is typed at Groupon checkout.";

function jsonRpcResponse(c: import("hono").Context<AppEnv>, response: JsonRpcResponse) {
  return c.json(response, 200, PRIVATE_HEADERS);
}

function methodNotAllowed(c: import("hono").Context<AppEnv>) {
  return c.json({ error: { code: "method_not_allowed", message: "only POST is accepted" } }, 405, { ...PRIVATE_HEADERS, Allow: "POST" });
}

function buildInitializeResult(params: unknown) {
  const requested = isPlainObject(params) && typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
  const protocolVersion = requested && SUPPORTED_VERSIONS.has(requested) ? requested : DEFAULT_VERSION;
  return {
    protocolVersion,
    capabilities: { tools: {} },
    serverInfo: { name: "zora-agent-lab", version: SERVER_VERSION },
    instructions: PRICE_RULE_INSTRUCTIONS,
  };
}

async function handleToolsCall(c: import("hono").Context<AppEnv>, id: JsonRpcId, params: unknown) {
  if (!isPlainObject(params) || typeof params.name !== "string") {
    return jsonRpcResponse(c, jsonRpcError(id, INVALID_PARAMS, "params.name must be a string"));
  }
  if (params.arguments !== undefined && !isPlainObject(params.arguments)) {
    return jsonRpcResponse(c, jsonRpcError(id, INVALID_PARAMS, "params.arguments must be an object"));
  }
  const tool = findTool(params.name);
  if (!tool) return jsonRpcResponse(c, jsonRpcError(id, INVALID_PARAMS, `unknown tool: ${params.name}`));
  const result = await tool.call(c.var.deps.shopping, params.arguments ?? {});
  return jsonRpcResponse(c, jsonRpcResult(id, result));
}

agentMcp.get("/", methodNotAllowed);
agentMcp.delete("/", methodNotAllowed);

agentMcp.post("/", async (c) => {
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return errorJson(c, 413, "payload_too_large", `request body exceeds ${MAX_BODY_BYTES} bytes`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonRpcResponse(c, jsonRpcError(null, PARSE_ERROR, "Parse error"));
  }

  if (Array.isArray(parsed)) {
    return errorJson(c, 400, "batch_not_supported", "JSON-RPC batches are not supported; send one message per request.");
  }
  if (!isPlainObject(parsed)) {
    return jsonRpcResponse(c, jsonRpcError(null, PARSE_ERROR, "the message must be a JSON object"));
  }

  const message = parsed;
  const hasId = "id" in message;
  const id: JsonRpcId = hasId && (typeof message.id === "string" || typeof message.id === "number") ? message.id : null;
  const method = message.method;

  if (typeof method !== "string") {
    return jsonRpcResponse(c, jsonRpcError(id, PARSE_ERROR, "message.method must be a string"));
  }

  // A notification has no "id" member at all; answer 202 with no body regardless of the method.
  if (!hasId) return c.body(null, 202, PRIVATE_HEADERS);

  switch (method) {
    case "initialize":
      return jsonRpcResponse(c, jsonRpcResult(id, buildInitializeResult(message.params)));
    case "ping":
      return jsonRpcResponse(c, jsonRpcResult(id, {}));
    case "tools/list":
      return jsonRpcResponse(c, jsonRpcResult(id, { tools: TOOL_LIST }));
    case "tools/call":
      return handleToolsCall(c, id, message.params);
    default:
      return jsonRpcResponse(c, jsonRpcError(id, METHOD_NOT_FOUND, `unknown method: ${method}`));
  }
});
