/// <reference types="node" />
// A stand-in for expo-sqlite in tests: Node's built-in SQLite behind the few async methods the app uses.
import type { SQLiteDatabase } from 'expo-sqlite';

type Param = string | number | null;

export function nodeDatabase(): SQLiteDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const params = (args: unknown[]) => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as Param[];
  const fake = {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const r = db.prepare(sql).run(...params(args));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getFirstAsync: async (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...params(args)) as unknown) ?? null,
    getAllAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).all(...params(args)) as unknown[],
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return fake as unknown as SQLiteDatabase;
}
