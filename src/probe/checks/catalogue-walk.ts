/**
 * Probe check "catalogue-walk": three pages of the full-load walk page cleanly, with no repeats
 * and a usable cursor, per the guide's "Syncing the catalog" section.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/catalogue-walk.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/catalogue-walk.test.ts
 */
import type { CallMeta, ProbeCheck, ProbeStepResult } from "../../contracts/ports";

const CHECK = "catalogue-walk" as const;
const STEPS = ["page-1", "page-2", "page-3", "no-repeat", "cursor"] as const;

function mk(step: string, verdict: "pass" | "fail" | "skip", meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult {
  return { check: CHECK, step, verdict, httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}
const pass = (step: string, meta: CallMeta | null, detail: string): ProbeStepResult => mk(step, "pass", meta, null, detail);
const fail = (step: string, meta: CallMeta | null, errorCode: string | null, detail: string): ProbeStepResult => mk(step, "fail", meta, errorCode, detail);
const skip = (step: string, detail: string): ProbeStepResult => mk(step, "skip", null, null, detail);
const noKeySkip = (): ProbeStepResult[] => STEPS.map((step) => skip(step, "no API key yet"));
const crashed = (thrown: unknown): ProbeStepResult[] => [mk("crashed", "fail", null, null, thrown instanceof Error ? thrown.message : String(thrown))];

interface FetchedPage {
  readonly ids: readonly string[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export const check: ProbeCheck = {
  name: CHECK,
  run: async (ctx) => {
    try {
      const steps: ProbeStepResult[] = [];
      const pages: FetchedPage[] = [];
      let cursor: string | undefined;
      let stoppedReason: "ended" | "failed" | null = null;

      for (let i = 1; i <= 3; i++) {
        const stepId = `page-${i}`;
        if (stoppedReason === "ended") {
          steps.push(skip(stepId, "the walk already ended: the previous page had hasMore false"));
          continue;
        }
        if (stoppedReason === "failed") {
          steps.push(skip(stepId, "an earlier page failed"));
          continue;
        }

        const result = await ctx.partner.listProducts({ limit: 10, cursor });
        if (!result.ok) {
          if (result.error.code === "NO_KEY") return noKeySkip();
          steps.push(fail(stepId, result.meta, result.error.code, `expected page ${i} to succeed, got ${result.error.code}`));
          stoppedReason = "failed";
          continue;
        }

        const page = result.value;
        steps.push(pass(stepId, result.meta, `${page.products.length} products, hasMore=${page.hasMore}`));
        pages.push({ ids: page.products.map((product) => product.id), hasMore: page.hasMore, nextCursor: page.nextCursor });
        if (page.hasMore) {
          cursor = page.nextCursor ?? undefined;
        } else {
          stoppedReason = "ended";
        }
      }

      const seenOnPage = new Map<string, number>();
      let repeat: { readonly id: string; readonly first: number; readonly second: number } | null = null;
      for (let index = 0; index < pages.length && !repeat; index++) {
        const page = pages[index]!;
        for (const id of page.ids) {
          const firstSeen = seenOnPage.get(id);
          if (firstSeen !== undefined) {
            repeat = { id, first: firstSeen + 1, second: index + 1 };
            break;
          }
          seenOnPage.set(id, index);
        }
      }
      steps.push(
        repeat
          ? fail("no-repeat", null, null, `product ${repeat.id} appeared on both page ${repeat.first} and page ${repeat.second}`)
          : pass("no-repeat", null, `no product id repeated across ${pages.length} page(s)`),
      );

      const badCursorAt = pages.findIndex((page) => page.hasMore && !page.nextCursor);
      steps.push(
        badCursorAt >= 0
          ? fail("cursor", null, null, `page ${badCursorAt + 1} had hasMore true but nextCursor was ${JSON.stringify(pages[badCursorAt]?.nextCursor)}`)
          : pass("cursor", null, "nextCursor was a non-empty string whenever hasMore was true"),
      );

      return steps;
    } catch (thrown) {
      return crashed(thrown);
    }
  },
};
