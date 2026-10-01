/**
 * The zora collector: reads public groupon.com listing pages and the partner guide hub page,
 * and posts what it saw to the lab's /ingest/observations endpoint. Runs on the machine zora, on
 * a daily systemd timer, never inside the Worker.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  collector/run.ts
 * Deps:    collector/parse.ts, src/contracts/ingest.ts
 * Tested:  test/collector/run.test.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GuideVersionObservation, IngestBatch, IngestReceipt } from "../src/contracts/ingest";
import { countListedEntries, parseGuideVersion, parseListing } from "./parse";

export const COLLECTOR_NAME = "zora-public-prices";
const MIN_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 25_000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MAX_CONSECUTIVE_FAILURES = 3;

export interface CollectorConfig {
  readonly host: string;
  readonly guideUrl: string;
  readonly listingPages: readonly string[];
}

/** Everything run() needs from the outside world, so it never touches fetch, timers or fs itself. */
export interface CollectorIO {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => Date;
  readonly print: (line: string) => void;
  readonly token: string;
  readonly config: CollectorConfig;
}

async function fetchPage(io: CollectorIO, url: string): Promise<{ status: number; body: string }> {
  try {
    const response = await io.fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    return { status: response.status, body };
  } catch {
    return { status: 0, body: "" };
  }
}

async function postBatch(io: CollectorIO, batch: IngestBatch): Promise<IngestReceipt | null> {
  try {
    const response = await io.fetch(`${io.config.host}/ingest/observations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${io.token}` },
      body: JSON.stringify(batch),
    });
    return (await response.json()) as IngestReceipt;
  } catch {
    return null;
  }
}

/**
 * Reads every listing page, one after another with at least MIN_INTERVAL_MS between requests,
 * posts one `public_prices` batch per page and one `guide_version` batch for the run, prints one
 * line per page, and answers the process exit code: 0 when at least one price was accepted
 * somewhere, 1 otherwise.
 */
export async function main(io: CollectorIO): Promise<number> {
  let consecutiveFailures = 0;
  let totalAccepted = 0;
  let stopped = false;

  for (const url of io.config.listingPages) {
    const { status, body } = await fetchPage(io, url);

    if (status !== 200) {
      consecutiveFailures += 1;
      io.print(`${url} ${status} 0 0 0`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        stopped = true;
        break;
      }
      await io.sleep(MIN_INTERVAL_MS);
      continue;
    }
    consecutiveFailures = 0;

    const observedAt = io.now().toISOString();
    const observations = parseListing(body, url, observedAt);
    const entries = countListedEntries(body);
    const accepted = observations.length;
    const rejected = entries - accepted;
    totalAccepted += accepted;

    await postBatch(io, { kind: "public_prices", collector: COLLECTOR_NAME, observations });
    io.print(`${url} ${status} ${entries} ${accepted} ${rejected}`);
    await io.sleep(MIN_INTERVAL_MS);
  }

  if (!stopped) {
    const { status: guideStatus, body: guideBody } = await fetchPage(io, io.config.guideUrl);
    const guideObservation: GuideVersionObservation = {
      sourceUrl: io.config.guideUrl,
      version: guideStatus === 200 ? parseGuideVersion(guideBody) : null,
      httpStatus: guideStatus,
      observedAt: io.now().toISOString(),
    };
    await postBatch(io, { kind: "guide_version", collector: COLLECTOR_NAME, observation: guideObservation });
    io.print(`${io.config.guideUrl} ${guideStatus} guide-version ${guideObservation.version ?? "none"}`);
  }

  return totalAccepted > 0 ? 0 : 1;
}

/** ZAL_INGEST_TOKEN from the environment, else that one variable from ~/s/.env.master. Never printed. */
export function resolveToken(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.ZAL_INGEST_TOKEN;
  if (fromEnv) return fromEnv;
  const vaultPath = join(homedir(), "s", ".env.master");
  let text: string;
  try {
    text = readFileSync(vaultPath, "utf8");
  } catch {
    throw new Error("ZAL_INGEST_TOKEN is not set and ~/s/.env.master could not be read");
  }
  const match = /^ZAL_INGEST_TOKEN=(.*)$/m.exec(text);
  if (!match?.[1]) throw new Error("ZAL_INGEST_TOKEN is not set in the environment or in ~/s/.env.master");
  return match[1].trim();
}

if (import.meta.main) {
  const config: CollectorConfig = JSON.parse(readFileSync(join(import.meta.dir, "pages.json"), "utf8"));
  const io: CollectorIO = {
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    print: (line) => console.log(line),
    token: resolveToken(),
    config,
  };
  main(io)
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(JSON.stringify({ collector: COLLECTOR_NAME, error: String(error) }));
      process.exit(1);
    });
}
