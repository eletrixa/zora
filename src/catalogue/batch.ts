/**
 * D1 write helpers: packing statement groups into the batches D1 accepts without ever splitting a
 * group across two batches (a batch is one transaction), and building the "?1,?2,..." placeholder
 * lists an IN (...) clause needs for a bounded set of ids.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/catalogue/batch.ts
 * Deps:    none (Workers/Bun D1 types are ambient)
 * Tested:  test/catalogue/index.test.ts
 */

/** D1 rejects a batch above a few hundred statements; we keep well under that. */
export const BATCH_CHUNK_SIZE = 40;

/** D1 rejects a statement with more than 100 bound parameters; an IN (...) of ids stays under that. */
export const ID_CHUNK_SIZE = 90;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Runs every statement through db.batch(), in chunks of BATCH_CHUNK_SIZE. Each chunk is its own
 * implicit D1 transaction, so this is only safe when every statement is independent of every
 * other: nothing here guarantees two statements land in the same chunk. Callers whose statements
 * must commit or fail together (e.g. every write for one product) use runGroupsInChunks instead.
 */
export async function runInChunks(db: D1Database, statements: readonly D1PreparedStatement[]): Promise<void> {
  for (const part of chunk(statements, BATCH_CHUNK_SIZE)) {
    if (part.length > 0) await db.batch(part);
  }
}

/**
 * Packs whole groups of statements into batches of up to BATCH_CHUNK_SIZE statements, never
 * splitting a group: everything in one group always lands in the same db.batch() call, so it
 * commits or fails together. Small groups are packed together up to the size budget; a group
 * bigger than BATCH_CHUNK_SIZE goes alone in its own (larger) batch rather than being split.
 */
export async function runGroupsInChunks(db: D1Database, groups: readonly (readonly D1PreparedStatement[])[]): Promise<void> {
  let pending: D1PreparedStatement[] = [];
  const flush = async (): Promise<void> => {
    if (pending.length === 0) return;
    await db.batch(pending);
    pending = [];
  };
  for (const group of groups) {
    if (group.length === 0) continue;
    if (pending.length > 0 && pending.length + group.length > BATCH_CHUNK_SIZE) await flush();
    if (group.length > BATCH_CHUNK_SIZE) {
      await flush();
      await db.batch(group as D1PreparedStatement[]);
      continue;
    }
    pending.push(...group);
  }
  await flush();
}

/** "?1,?2,?3" for a 1-based bind list of the given length. */
export const placeholders = (count: number, offset = 0): string => Array.from({ length: count }, (_, i) => `?${offset + i + 1}`).join(",");
