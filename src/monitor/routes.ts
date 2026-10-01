/**
 * Collector ingest, mounted at /ingest behind the ingest token.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/monitor/routes.ts
 * Deps:    hono, src/monitor/ingest.ts, src/lib/http.ts
 * Tested:  test/monitor/routes.test.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../contracts/env";
import { errorJson } from "../lib/http";
import { MAX_BODY_BYTES, ingestBatch, parseBatch } from "./ingest";

export const ingest = new Hono<AppEnv>();

ingest.post("/observations", async (c) => {
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return errorJson(c, 413, "payload_too_large", "body exceeds 512 KB");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorJson(c, 400, "invalid_json", "body is not valid JSON");
  }

  const parsed = parseBatch(body);
  if (!parsed.ok) return errorJson(c, 400, parsed.code, parsed.message);

  const receipt = await ingestBatch(c.var.deps.db, parsed.batch);
  return c.json(receipt);
});

ingest.all("*", (c) => errorJson(c, 404, "not_found", "no such ingest route"));
