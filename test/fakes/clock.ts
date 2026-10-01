/**
 * A clock that tests control: sleep() returns at once and moves time forward.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/clock.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/contracts/ports.test.ts
 */
import type { Clock } from "../../src/contracts/ports";

export const FIXED_START = Date.parse("2026-10-01T00:00:00.000Z");

export class FakeClock implements Clock {
  #now: number;
  /** Every sleep asked for, in order. Lets a test assert backoff and pacing. */
  readonly sleeps: number[] = [];

  constructor(start: number = FIXED_START) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.#now += Math.max(0, ms);
  }

  advance(ms: number): void {
    this.#now += ms;
  }
}

/**
 * A clock for tests of things that happen AT THE SAME TIME. Unlike FakeClock, a sleep here does
 * not move time: the sleeper stays parked until the test moves the clock past its wake time.
 * So callers that start together all see the same `now`, as they do on a real clock.
 */
export class QueueClock implements Clock {
  #now: number;
  #sleepers: { readonly wakeAt: number; readonly wake: () => void }[] = [];
  readonly sleeps: number[] = [];

  constructor(start: number = FIXED_START) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.#sleepers.push({ wakeAt: this.#now + ms, wake: resolve });
    });
  }

  get parked(): number {
    return this.#sleepers.length;
  }

  /** Lets every pending promise callback run, so parked callers reach their next await. */
  async settle(): Promise<void> {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }

  /** Moves time to the next sleeper's wake time, again and again, until nobody is parked. */
  async drain(): Promise<void> {
    await this.settle();
    while (this.#sleepers.length > 0) {
      this.#sleepers.sort((a, b) => a.wakeAt - b.wakeAt);
      const next = this.#sleepers.shift();
      if (!next) break;
      this.#now = Math.max(this.#now, next.wakeAt);
      next.wake();
      await this.settle();
    }
  }
}
