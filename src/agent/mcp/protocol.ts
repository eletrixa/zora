/**
 * JSON-RPC 2.0 message shapes and response helpers for the MCP Streamable HTTP transport.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/mcp/protocol.ts
 * Deps:    none
 * Tested:  test/agent/mcp/routes.test.ts
 */

export type JsonRpcId = string | number | null;

export interface JsonRpcErrorObject {
  readonly code: number;
  readonly message: string;
}

export type JsonRpcResponse =
  | { readonly jsonrpc: "2.0"; readonly id: JsonRpcId; readonly result: unknown }
  | { readonly jsonrpc: "2.0"; readonly id: JsonRpcId; readonly error: JsonRpcErrorObject };

export function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
