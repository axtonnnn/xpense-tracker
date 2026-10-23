import type { SQLiteDatabase } from 'expo-sqlite';

// SQLite can't nest transactions on one connection, and app-start work (booking due bills) can
// overlap with a user's save. Queue every transaction so they run one after another.
let queue: Promise<unknown> = Promise.resolve();

export function inTransaction(db: SQLiteDatabase, task: () => Promise<void>): Promise<void> {
  const run = queue.then(() => db.withTransactionAsync(task));
  queue = run.catch(() => undefined);
  return run;
}
