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
  // 2: a repeating entry's note is copied onto each entry it books.
  `ALTER TABLE recurring ADD COLUMN note TEXT;`,
  // 3: sync. Every synced row knows when it last changed and whether that change is still to be uploaded;
  // deletions leave a marker until the server has them. See src/db/sync.ts.
  `
  ALTER TABLE transactions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE transactions ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE receipts ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE receipts ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE receipt_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE receipt_items ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE recurring ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE recurring ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE settings ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
  UPDATE transactions SET updated_at = created_at;
  UPDATE receipts SET updated_at = scanned_at;
  UPDATE receipt_items SET updated_at = COALESCE((SELECT scanned_at FROM receipts r WHERE r.id = receipt_items.receipt_id), '');
  UPDATE recurring SET updated_at = created_at;
  UPDATE settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
  CREATE TABLE sync_deletes (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (kind, id)
  );
  CREATE TABLE sync_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // 4: the savings goal (one active at a time) and the money moved in and out of it. Status and kind are
  // checked in code, not here, so a newer device can sync a value this version doesn't know yet.
  `
  CREATE TABLE goals (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    target_cents INTEGER NOT NULL,
    started_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    finished_on TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT '',
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE goal_deposits (
    id TEXT PRIMARY KEY NOT NULL,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    occurred_on TEXT NOT NULL,
    note TEXT,
    kind TEXT NOT NULL DEFAULT 'deposit',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT '',
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_deposits_goal ON goal_deposits(goal_id);
  CREATE INDEX idx_deposits_date ON goal_deposits(occurred_on);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (!row) throw new Error('Could not read the database schema version');
  if (row.user_version > MIGRATIONS.length) throw new Error('This data was saved by a newer version of Xpense');
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    // Each step and its version bump commit (or roll back) together.
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
