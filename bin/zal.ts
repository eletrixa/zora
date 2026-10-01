#!/usr/bin/env bun
/**
 * Command-line interface for the Zora shopping API: search, deal, checkout, order, job commands.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  bin/zal.ts
 * Deps:    src/contracts/ports.ts, src/lib/money.ts
 * Tested:  test/cli/zal.test.ts
 */

import type { DealCard, DealDetail, CheckoutResult, OrderStatusResult, ShoppingService, CheckoutItem } from "../src/contracts/ports";
import { formatMoney } from "../src/lib/money";

interface CLIEnv {
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  env: Record<string, string | undefined>;
  stdout: string[];
  stderr: string[];
  readVault: (name: string) => Promise<string | undefined>;
}

interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key === "json") {
        flags.json = true;
      } else if (i + 1 < rest.length) {
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("--")) {
          const value = rest[++i]!;
          flags[key] = value;
        } else {
          flags[key] = true;
        }
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      if (key === "q") {
        const value = rest[++i];
        if (value) flags.text = value;
      } else if (i + 1 < rest.length) {
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith("--")) {
          const value = rest[++i]!;
          flags[key] = value;
        } else {
          flags[key] = true;
        }
      } else {
        flags[key] = true;
      }
    } else {
      args.push(arg);
    }
  }

  return { command, args, flags };
}

function printError(io: CLIEnv, message: string): void {
  io.stderr.push(message + "\n");
}

function printUsage(io: CLIEnv): void {
  io.stdout.push(`zal — shopping CLI

Commands:
  zal search <text...> [--state IL] [--city Chicago] [--category Massage] [--max 50] [--limit 10] [--json]
  zal deal <productId> [--json]
  zal checkout <productId> <optionId> [--qty 1] [--json]
  zal order <grouponOrderUuid> [--json]
  zal job <sync-full|sync-delta|probe|cart-sample|promo-gap|cart-sweep|top-cities|category-walk>
  zal help
`);
}

async function getToken(io: CLIEnv, tokenEnvVar: string): Promise<string | null> {
  const fromEnv = io.env[tokenEnvVar];
  if (fromEnv) return fromEnv;

  const fromVault = await io.readVault(tokenEnvVar);
  if (fromVault) return fromVault;

  return null;
}

function formatDealCard(card: DealCard): string {
  const location = card.city || card.state ? `${card.city}${card.city && card.state ? ", " : ""}${card.state}` : "Location unknown";
  let output = `${card.title}\n${card.optionTitle}\n${location}\nYou pay ${card.payText}\nProduct: ${card.productId} Option: ${card.optionId}`;

  if (card.promo) {
    output += `\n${card.promo.instruction}`;
  }

  return output;
}

function formatDealDetail(deal: DealDetail): string {
  let output = formatDealCard(deal);
  output += `\n\n${deal.description}`;
  if (deal.categoryLabels.length > 0) {
    output += `\nCategories: ${deal.categoryLabels.join(", ")}`;
  }
  return output;
}

async function handleSearch(io: CLIEnv, args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const host = io.env.ZAL_HOST ?? "https://zorasocial.asajj.cz";
  const token = await getToken(io, "ZAL_AGENT_TOKEN");

  if (!token) {
    printError(io, "error: ZAL_AGENT_TOKEN not set and not found in vault");
    return 3;
  }

  const text = args.join(" ");
  const state = typeof flags.state === "string" ? flags.state : undefined;
  const city = typeof flags.city === "string" ? flags.city : undefined;
  const category = typeof flags.category === "string" ? flags.category : undefined;
  const maxStr = typeof flags.max === "string" ? flags.max : undefined;
  const limit = typeof flags.limit === "string" ? flags.limit : "10";

  // Validate maxPrice: must be a positive number (integer or decimal)
  let max: string | undefined;
  if (maxStr) {
    const dollars = Number(maxStr);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      printError(io, "error: --max must be a positive number");
      return 2;
    }
    max = maxStr;
  }

  if (!text && !state && !city && !category && !max) {
    printError(io, "error: search requires text or a filter (--state, --city, --category, --max)");
    return 2;
  }

  try {
    const query = new URLSearchParams();
    if (text) query.append("q", text);
    if (state) query.append("state", state);
    if (city) query.append("city", city);
    if (category) query.append("category", category);
    if (max) query.append("maxPrice", max);
    query.append("limit", limit);

    const response = await io.fetch(`${host}/api/v1/search?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      printError(io, `error: ${response.status}`);
      return 1;
    }

    const data = await response.json() as { deals: DealCard[]; count: number };

    if (flags.json) {
      io.stdout.push(JSON.stringify(data) + "\n");
    } else {
      for (const card of data.deals) {
        io.stdout.push(formatDealCard(card) + "\n\n");
      }
    }

    return 0;
  } catch (err) {
    printError(io, `error: network failure`);
    return 3;
  }
}

async function handleDeal(io: CLIEnv, args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const host = io.env.ZAL_HOST ?? "https://zorasocial.asajj.cz";
  const token = await getToken(io, "ZAL_AGENT_TOKEN");

  if (!token) {
    printError(io, "error: ZAL_AGENT_TOKEN not set and not found in vault");
    return 3;
  }

  const productId = args[0];
  if (!productId) {
    printError(io, "error: deal requires productId");
    return 2;
  }

  try {
    const response = await io.fetch(`${host}/api/v1/deals/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      printError(io, `error: deal not found`);
      return 1;
    }

    if (!response.ok) {
      printError(io, `error: ${response.status}`);
      return 1;
    }

    const deal = await response.json() as DealDetail;

    if (flags.json) {
      io.stdout.push(JSON.stringify(deal) + "\n");
    } else {
      io.stdout.push(formatDealDetail(deal) + "\n");
    }

    return 0;
  } catch (err) {
    printError(io, `error: network failure`);
    return 3;
  }
}

async function handleCheckout(io: CLIEnv, args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const host = io.env.ZAL_HOST ?? "https://zorasocial.asajj.cz";
  const token = await getToken(io, "ZAL_AGENT_TOKEN");

  if (!token) {
    printError(io, "error: ZAL_AGENT_TOKEN not set and not found in vault");
    return 3;
  }

  const productId = args[0];
  const optionId = args[1];
  if (!productId || !optionId) {
    printError(io, "error: checkout requires productId and optionId");
    return 2;
  }

  const qty = typeof flags.qty === "string" ? parseInt(flags.qty) : 1;
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
    printError(io, "error: qty must be an integer between 1 and 100");
    return 2;
  }

  try {
    // Note: We need the current price to pass expectedPrice. For now, using a placeholder.
    // A real implementation would fetch the deal first or have the price passed in.
    const items: CheckoutItem[] = [{ productId, optionId, quantity: qty }];

    const response = await io.fetch(`${host}/api/v1/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });

    let data: CheckoutResult;

    if (response.status === 409) {
      data = await response.json() as CheckoutResult;
      if (data.kind === "price_changed") {
        printError(io, `error: price changed to ${data.nowText}`);
        return 1;
      }
      if (data.kind === "unavailable") {
        printError(io, `error: ${data.reason}`);
        return 1;
      }
    } else if (response.status === 404) {
      printError(io, `error: deal not found`);
      return 1;
    } else if (response.status === 502) {
      data = await response.json() as CheckoutResult;
      printError(io, `error: ${data.kind === "error" ? data.message : "server error"}`);
      return 1;
    } else if (!response.ok) {
      printError(io, `error: ${response.status}`);
      return 1;
    } else {
      data = await response.json() as CheckoutResult;
    }

    if (flags.json) {
      io.stdout.push(JSON.stringify(data) + "\n");
    } else if (data.kind === "link") {
      io.stdout.push(`${data.totalText}\n${data.buyLink}\n`);
    }

    return 0;
  } catch (err) {
    printError(io, `error: network failure`);
    return 3;
  }
}

async function handleOrder(io: CLIEnv, args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const host = io.env.ZAL_HOST ?? "https://zorasocial.asajj.cz";
  const token = await getToken(io, "ZAL_AGENT_TOKEN");

  if (!token) {
    printError(io, "error: ZAL_AGENT_TOKEN not set and not found in vault");
    return 3;
  }

  const uuid = args[0];
  if (!uuid) {
    printError(io, "error: order requires grouponOrderUuid");
    return 2;
  }

  try {
    const response = await io.fetch(`${host}/api/v1/orders/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) {
      printError(io, `error: order not found`);
      return 1;
    }

    if (!response.ok) {
      printError(io, `error: ${response.status}`);
      return 1;
    }

    const order = await response.json() as OrderStatusResult;

    if (flags.json) {
      io.stdout.push(JSON.stringify(order) + "\n");
    } else if (order.kind === "order") {
      io.stdout.push(`Order ${order.uuid}\nStatus: ${order.status}\n`);
      for (const line of order.lines) {
        const title = line.title ?? "Unknown";
        io.stdout.push(`  ${title} (qty ${line.quantity}): ${line.status}\n`);
      }
    }

    return 0;
  } catch (err) {
    printError(io, `error: network failure`);
    return 3;
  }
}

async function handleJob(io: CLIEnv, args: string[]): Promise<number> {
  const host = io.env.ZAL_HOST ?? "https://zorasocial.asajj.cz";
  const token = await getToken(io, "ZAL_ADMIN_TOKEN");

  if (!token) {
    printError(io, "error: ZAL_ADMIN_TOKEN not set and not found in vault");
    return 3;
  }

  const job = args[0];
  const validJobs = ["sync-full", "sync-delta", "probe", "cart-sample", "promo-gap", "cart-sweep", "top-cities", "category-walk"];

  if (!job || !validJobs.includes(job)) {
    printError(io, `error: invalid job; must be one of: ${validJobs.join(", ")}`);
    return 2;
  }

  try {
    const response = await io.fetch(`${host}/admin/jobs/${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      printError(io, `error: ${response.status}`);
      return 1;
    }

    io.stdout.push(`Job ${job} started\n`);
    return 0;
  } catch (err) {
    printError(io, `error: network failure`);
    return 3;
  }
}

export async function main(argv: string[], io: CLIEnv): Promise<number> {
  const { command, args, flags } = parseArgs(argv);

  switch (command) {
    case "search":
      return handleSearch(io, args, flags);
    case "deal":
      return handleDeal(io, args, flags);
    case "checkout":
      return handleCheckout(io, args, flags);
    case "order":
      return handleOrder(io, args, flags);
    case "job":
      return handleJob(io, args);
    case "help":
    case "":
      printUsage(io);
      return 0;
    default:
      printError(io, `error: unknown command: ${command}`);
      printUsage(io);
      return 2;
  }
}

// Entry point when run directly
if (import.meta.main) {
  const io: CLIEnv = {
    fetch: globalThis.fetch,
    env: process.env as Record<string, string | undefined>,
    stdout: [],
    stderr: [],
    readVault: async (name: string) => {
      // Read from ~/s/.env.master if available
      try {
        const path = `${process.env.HOME ?? "/root"}/s/.env.master`;
        const content = await Bun.file(path).text();
        const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
        if (line) {
          return line.split("=", 2)[1];
        }
      } catch {
        // File not found or not readable
      }
      return undefined;
    },
  };

  const code = await main(process.argv.slice(2), io);

  for (const line of io.stdout) process.stdout.write(line);
  for (const line of io.stderr) process.stderr.write(line);

  process.exit(code);
}
