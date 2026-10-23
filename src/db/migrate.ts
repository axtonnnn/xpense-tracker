import type { SQLiteDatabase } from 'expo-sqlite';

// Each entry upgrades the schema by one version; never edit a shipped migration, append a new one.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE receipts (
    id TEXT PRIMARY KEY NOT NULL,
    image_uri TEXT,
    doc_type TEXT NOT NULL,
    merchant TEXT,
    subtotal_cents INTEGER,
    tax_cents INTEGER,
    tip_cents INTEGER,
    total_cents INTEGER NOT NULL,
    due_on TEXT,
    ai_json TEXT,
    scanned_at TEXT NOT NULL
  );
  CREATE TABLE receipt_items (
    id TEXT PRIMARY KEY NOT NULL,
    receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    qty REAL,
    total_cents INTEGER NOT NULL,
    category TEXT NOT NULL,
    necessity TEXT NOT NULL CHECK (necessity IN ('need', 'want')),
    reason TEXT
  );
  CREATE INDEX idx_items_receipt ON receipt_items(receipt_id);
  CREATE TABLE recurring (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    label TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    category TEXT NOT NULL,
    necessity TEXT,
    cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
    anchor_on TEXT NOT NULL,
    next_on TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount_cents INTEGER NOT NULL,
    need_cents INTEGER NOT NULL DEFAULT 0,
    want_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    merchant TEXT,
    note TEXT,
    category TEXT NOT NULL,
    occurred_on TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scan', 'recurring')),
    receipt_id TEXT REFERENCES receipts(id) ON DELETE SET NULL,
    recurring_id TEXT REFERENCES recurring(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_tx_date ON transactions(occurred_on);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
