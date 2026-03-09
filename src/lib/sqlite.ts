/**
 * Runtime-adaptive SQLite adapter.
 * Uses bun:sqlite when running in Bun, better-sqlite3 when running in Node.
 * Both libraries share a compatible API (exec, prepare, close, transaction).
 */

type Statement = {
  run(...params: any[]): any;
  get(...params: any[]): any;
  all(...params: any[]): any[];
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  transaction<F extends (...args: any[]) => any>(fn: F): F;
  close(): void;
};

type SqliteConstructor = new (path: string) => SqliteDatabase;

const isBun = typeof globalThis.Bun !== "undefined";

let DatabaseCtor: SqliteConstructor;

if (isBun) {
  const mod = await import("bun:sqlite");
  DatabaseCtor = mod.Database as unknown as SqliteConstructor;
} else {
  const mod = await import("better-sqlite3");
  DatabaseCtor = mod.default as unknown as SqliteConstructor;
}

export { DatabaseCtor as Database };
export type { SqliteDatabase, Statement };
