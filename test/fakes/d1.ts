/**
 * A minimal, honest `D1Database` backed by `bun:sqlite`, so code written against a D1 binding
 * runs under `bun test`. bun's SQLite ships FTS5, so products_fts works as in production.
 * It refuses more than 100 bound values per statement, as D1 does.
 * Methods D1 has but nothing here uses (withSession, dump, raw with column names) throw
 * rather than fake an answer. Adapted from an earlier project's D1 test helper.
 *
 * `createTestDb()` builds an in-memory database with every migrations/*.sql applied in
 * filename order and returns { d1, sqlite }; the raw handle lets a test seed or inspect rows.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/d1.ts
 * Deps:    bun:sqlite, migrations/*.sql
 * Tested:  test/contracts/schema.test.ts
 */
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** D1's limit on bound values per statement. */
const MAX_BOUND_VALUES = 100;

/** The pair returned by createTestDb: the D1-shaped binding + the raw sqlite handle. */
export type TestDb = { d1: D1Database; sqlite: Database };

// --- the narrow slice of the bun:sqlite Statement surface we actually call ---
// Declared locally so this shim carries its own contract instead of leaning on
// bun's generic Statement types (which aren't installed as a typings package here).
type SqliteBindable = null | number | bigint | string | boolean | Uint8Array;
interface SqliteChanges {
  changes: number;
  lastInsertRowid: number | bigint;
}
interface SqliteStatement {
  all(...params: SqliteBindable[]): Array<Record<string, unknown>>;
  get(...params: SqliteBindable[]): Record<string, unknown> | null | undefined;
  values(...params: SqliteBindable[]): unknown[][];
  run(...params: SqliteBindable[]): SqliteChanges;
}

/** Build a full D1Meta. Only .changes / .last_row_id carry real values; the rest are
 *  plausible constants, because D1 never lets meta be partial. */
function meta(over: Partial<D1Meta> = {}): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
    ...over,
  };
}

class FakeD1PreparedStatement implements D1PreparedStatement {
  readonly #stmt: SqliteStatement;
  readonly #params: readonly unknown[];

  constructor(stmt: SqliteStatement, params: readonly unknown[] = []) {
    this.#stmt = stmt;
    this.#params = params;
  }

  // D1 binds are immutable: bind() yields a new statement carrying these params. D1 refuses more than
  // 100 of them; the fake does too, so a test meets the limit that crashed the delta sync in production.
  bind(...values: unknown[]): D1PreparedStatement {
    if (values.length > MAX_BOUND_VALUES) throw new Error(`D1_ERROR: variable number must be between ?1 and ?${MAX_BOUND_VALUES}: ${values.length} values bound`);
    return new FakeD1PreparedStatement(this.#stmt, values);
  }

  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  async first<T>(colName?: string): Promise<T | null> {
    const row = this.#stmt.get(...this.#args()) ?? null;
    if (row === null) return null;
    if (colName !== undefined) return (row[colName] ?? null) as T | null;
    return row as unknown as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const ch = this.#stmt.run(...this.#args());
    const changes = ch?.changes ?? 0;
    return {
      success: true,
      results: [] as T[],
      meta: meta({
        changes,
        rows_written: changes,
        changed_db: changes > 0,
        last_row_id: Number(ch?.lastInsertRowid ?? 0),
      }),
    };
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.resolve(this.allSync<T>());
  }

  /** Synchronous core of all() — also reused by Database.batch() inside a txn. */
  allSync<T = Record<string, unknown>>(): D1Result<T> {
    const rows = this.#stmt.all(...this.#args()) as T[];
    return { success: true, results: rows, meta: meta({ rows_read: rows.length }) };
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    if (options?.columnNames) {
      // Nothing here calls raw() with column names; refuse rather than invent a column list.
      throw new Error("not implemented: raw({ columnNames: true })");
    }
    return this.#stmt.values(...this.#args()) as T[];
  }

  #args(): SqliteBindable[] {
    return this.#params as SqliteBindable[];
  }
}

class FakeD1Database implements D1Database {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  prepare(query: string): D1PreparedStatement {
    // bun's .query() caches the compiled statement by SQL — params are supplied per call.
    return new FakeD1PreparedStatement(this.#db.query(query) as unknown as SqliteStatement);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const fakes = statements as FakeD1PreparedStatement[];
    // D1 runs a batch as one implicit transaction; mirror that with a sqlite txn.
    const runAll = this.#db.transaction(() => fakes.map((s) => s.allSync<T>()));
    return runAll() as D1Result<T>[];
  }

  async exec(query: string): Promise<D1ExecResult> {
    const started = Date.now();
    this.#db.exec(query);
    return { count: countStatements(query), duration: Date.now() - started };
  }

  withSession(): D1DatabaseSession {
    throw new Error("not implemented: D1Database.withSession");
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error("not implemented: D1Database.dump");
  }
}

function countStatements(sql: string): number {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--")).length;
}

// --- migrations ------------------------------------------------------------
const REPO_ROOT = join(import.meta.dir, "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "migrations");

let MIGRATION_SQL: string | null = null;
/** Concatenate every migrations/*.sql in filename order. bun:sqlite's exec runs the
 *  whole multi-statement string, so we don't hand-split on ';' (which would break on
 *  semicolons inside string/JSON literals). Cached — the files don't change per run. */
function migrationSql(): string {
  if (MIGRATION_SQL !== null) return MIGRATION_SQL;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith(".sql"))
    .sort();
  const sql = files.map((f: string) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
  MIGRATION_SQL = sql;
  return sql;
}

export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.exec(migrationSql());
  return { d1: new FakeD1Database(sqlite), sqlite };
}
