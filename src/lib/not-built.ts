/**
 * Placeholder for a lane that is not built yet: every method call rejects with a clear message.
 * Lets the Worker deploy and serve the finished parts while other lanes are in progress.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/not-built.ts
 * Deps:    none
 * Tested:  test/lib/lib.test.ts
 */

export class NotBuiltError extends Error {
  constructor(readonly lane: string, readonly member: string) {
    super(`lane "${lane}" is not built yet (called ${member})`);
    this.name = "NotBuiltError";
  }
}

export function notBuilt<T extends object>(lane: string): T {
  return new Proxy({} as T, {
    get(_target, member) {
      if (member === "then") return undefined; // never look like a promise
      return () => Promise.reject(new NotBuiltError(lane, String(member)));
    },
  });
}
