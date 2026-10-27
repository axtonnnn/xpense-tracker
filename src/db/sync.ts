// Two-way sync between this device's database and the account's copy on Supabase.
//
// The server keeps one table, `records`: one row per entry, receipt, receipt line, repeat or setting, its
// data as JSON (supabase/schema.sql). Each device:
//   1. pulls what changed since it last looked (with a few minutes of overlap, so nothing slips past),
//   2. applies it unless its own copy is newer (last edit wins),
//   3. pushes its own changes and deletions.
// Receipt photos and AI raw answers stay on the device that scanned them.
// If the server is missing a newer kind (its schema.sql predates it), those records wait on the device
// and everything else keeps syncing; running supabase/schema.sql again lets them through.
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { KINDS, NEWER_KINDS, type Kind } from './changes';
import { notifyChange } from './live';
import { DEVICE_SETTINGS } from './settings';
import { inTransaction } from './tx';
import { deleteReceiptImage } from '@/lib/files';

export type RemoteRecord = {
  kind: Kind;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  updated_at: string;
  synced_at?: string;
};

/** The server side of sync; a fake one stands in for Supabase in tests. */
export type Remote = {
  pull: (since: string | null) => Promise<RemoteRecord[]>;
  push: (records: RemoteRecord[]) => Promise<void>;
};

type Table = { name: string; key: string; columns: string[] };

// Only these columns travel. Everything else (photo paths, sync flags) is the device's own business.
export const TABLES: Record<Kind, Table> = {
  setting: { name: 'settings', key: 'key', columns: ['key', 'value'] },
  recurring: {
    name: 'recurring',
    key: 'id',
    columns: ['id', 'type', 'label', 'amount_cents', 'category', 'necessity', 'note', 'cadence', 'anchor_on', 'next_on', 'active', 'created_at'],
  },
  receipt: {
    name: 'receipts',
    key: 'id',
    columns: ['id', 'doc_type', 'merchant', 'subtotal_cents', 'tax_cents', 'tip_cents', 'total_cents', 'due_on', 'scanned_at'],
  },
  receipt_item: {
    name: 'receipt_items',
    key: 'id',
    columns: ['id', 'receipt_id', 'position', 'name', 'qty', 'total_cents', 'category', 'necessity', 'reason'],
  },
  transaction: {
    name: 'transactions',
    key: 'id',
    columns: [
      'id', 'type', 'amount_cents', 'need_cents', 'want_cents', 'currency', 'merchant', 'note', 'category',
      'occurred_on', 'source', 'receipt_id', 'recurring_id', 'created_at',
    ],
  },
  goal: { name: 'goals', key: 'id', columns: ['id', 'name', 'target_cents', 'started_on', 'status', 'finished_on', 'created_at'] },
  goal_deposit: {
    name: 'goal_deposits',
    key: 'id',
    columns: ['id', 'goal_id', 'amount_cents', 'occurred_on', 'note', 'kind', 'created_at'],
  },
};

/** Rows pulled again on every sync, so a change saved on the server just as we looked isn't missed. */
const OVERLAP_MS = 5 * 60 * 1000;
const PUSH_BATCH = 200;

/** Server timestamps come back as "…+00:00"; compare everything in one format. */
export const normalizeTime = (t: string) => {
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : t;
};

/** Whether a pulled record should replace the local row: the newer edit wins, and pending deletions win. */
export function shouldApply(remoteUpdatedAt: string, local: { updated_at: string } | null, pendingDelete: boolean): boolean {
  if (pendingDelete) return false;
  if (!local) return true;
  return normalizeTime(remoteUpdatedAt) > normalizeTime(local.updated_at);
}

/** A local row as it travels: only the synced columns. */
export function toRecord(kind: Kind, row: Record<string, unknown>): RemoteRecord {
  const t = TABLES[kind];
  const data: Record<string, unknown> = {};
  for (const c of t.columns) data[c] = row[c] ?? null;
  return { kind, id: String(row[t.key]), data, deleted: false, updated_at: String(row.updated_at) };
}

async function getCursor(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'cursor'");
  return row?.value ?? null;
}

async function setCursor(db: SQLiteDatabase, value: string): Promise<void> {
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", value);
}

async function applyRecord(db: SQLiteDatabase, r: RemoteRecord, images: string[]): Promise<boolean> {
  const t = TABLES[r.kind];
  if (!t) return false;
  if (r.kind === 'setting' && DEVICE_SETTINGS.includes(r.id as never)) return false;
  const local = await db.getFirstAsync<{ updated_at: string; dirty: number }>(`SELECT updated_at, dirty FROM ${t.name} WHERE ${t.key} = ?`, r.id);
  const pending = !!(await db.getFirstAsync('SELECT 1 FROM sync_deletes WHERE kind = ? AND id = ?', r.kind, r.id));
  const remoteAt = normalizeTime(r.updated_at);
  // A deletion stamped the same moment as the row it deletes still deletes it.
  if (r.deleted && local && !pending && remoteAt >= normalizeTime(local.updated_at)) {
    if (r.kind === 'receipt') {
      const img = await db.getFirstAsync<{ image_uri: string | null }>('SELECT image_uri FROM receipts WHERE id = ?', r.id);
      if (img?.image_uri) images.push(img.image_uri);
    }
    await db.runAsync(`DELETE FROM ${t.name} WHERE ${t.key} = ?`, r.id);
    return true;
  }
  if (local && normalizeTime(local.updated_at) === remoteAt) {
    // Our own change coming back: it's on the server now.
    if (local.dirty) await db.runAsync(`UPDATE ${t.name} SET dirty = 0 WHERE ${t.key} = ? AND updated_at = ?`, r.id, local.updated_at);
    return false;
  }
  if (!shouldApply(remoteAt, local, pending)) return false;

  // A deletion of a row this device never had, or one it changed since: nothing to do.
  if (r.deleted || !r.data) return false;

  const data = { ...r.data };
  // A line or entry whose receipt (or repeat) isn't on this device keeps going without the link.
  if (r.kind === 'receipt_item' && !(await db.getFirstAsync('SELECT 1 FROM receipts WHERE id = ?', String(data.receipt_id)))) return false;
  if (r.kind === 'goal_deposit' && !(await db.getFirstAsync('SELECT 1 FROM goals WHERE id = ?', String(data.goal_id)))) return false;
  if (r.kind === 'transaction') {
    if (data.receipt_id && !(await db.getFirstAsync('SELECT 1 FROM receipts WHERE id = ?', String(data.receipt_id)))) data.receipt_id = null;
    if (data.recurring_id && !(await db.getFirstAsync('SELECT 1 FROM recurring WHERE id = ?', String(data.recurring_id)))) data.recurring_id = null;
  }
  const cols = t.columns;
  const values = cols.map((c) => (data[c] === undefined ? null : data[c])) as (string | number | null)[];
  values[cols.indexOf(t.key)] = r.id;
  const updates = cols.filter((c) => c !== t.key).map((c) => `${c} = excluded.${c}`);
  await db.runAsync(
    `INSERT INTO ${t.name} (${cols.join(', ')}, updated_at, dirty) VALUES (${cols.map(() => '?').join(', ')}, ?, 0)
     ON CONFLICT(${t.key}) DO UPDATE SET ${[...updates, 'updated_at = excluded.updated_at', 'dirty = 0'].join(', ')}`,
    ...values,
    remoteAt,
  );
  return true;
}

export type SyncResult = { pulled: number; pushed: number };

/** One full round: pull, apply, push. SyncProvider makes sure only one runs at a time. */
export async function syncOnce(db: SQLiteDatabase, remote: Remote): Promise<SyncResult> {
  const cursor = await getCursor(db);
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
  const incoming = await remote.pull(since);
  const order = (k: Kind) => KINDS.indexOf(k);
  incoming.sort((a, b) => order(a.kind) - order(b.kind));

  let pulled = 0;
  const images: string[] = [];
  let newest = cursor;
  await inTransaction(db, async () => {
    for (const r of incoming) {
      if (await applyRecord(db, r, images)) pulled++;
      if (r.synced_at && (!newest || normalizeTime(r.synced_at) > newest)) newest = normalizeTime(r.synced_at);
    }
    if (newest && newest !== cursor) await setCursor(db, newest);
  });
  images.forEach(deleteReceiptImage);
  if (pulled > 0) notifyChange();

  // Push: changed rows in parent-first order, then deletions.
  let pushed = 0;
  const held = new Set<Kind>();
  /** Pushes one batch; a newer kind the server doesn't know yet is held back instead of failing the sync. */
  const send = async (kind: Kind, records: RemoteRecord[]): Promise<boolean> => {
    try {
      await remote.push(records);
      return true;
    } catch (e) {
      if (!NEWER_KINDS.includes(kind)) throw e;
      if (!held.has(kind)) console.warn(`[sync] the server doesn't take "${kind}" yet; run supabase/schema.sql again`, e);
      held.add(kind);
      return false;
    }
  };
  for (const kind of KINDS) {
    const t = TABLES[kind];
    for (;;) {
      const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t.name} WHERE dirty = 1 LIMIT ${PUSH_BATCH}`);
      const local = kind === 'setting' ? rows.filter((r) => DEVICE_SETTINGS.includes(String(r.key) as never)) : [];
      const records = rows.filter((r) => !local.includes(r)).map((r) => toRecord(kind, r));
      if (records.length > 0 && !(await send(kind, records))) break;
      for (const r of rows) {
        await db.runAsync(`UPDATE ${t.name} SET dirty = 0 WHERE ${t.key} = ? AND updated_at = ?`, r[t.key] as string, r.updated_at as string);
      }
      pushed += records.length;
      if (rows.length < PUSH_BATCH) break;
    }
  }
  const deletions = await db.getAllAsync<{ kind: Kind; id: string; deleted_at: string }>('SELECT kind, id, deleted_at FROM sync_deletes');
  for (const kind of KINDS) {
    const mine = deletions.filter((d) => d.kind === kind);
    for (let i = 0; i < mine.length; i += PUSH_BATCH) {
      const batch = mine.slice(i, i + PUSH_BATCH);
      if (!(await send(kind, batch.map((d) => ({ kind: d.kind, id: d.id, data: null, deleted: true, updated_at: d.deleted_at }))))) break;
      for (const d of batch) await db.runAsync('DELETE FROM sync_deletes WHERE kind = ? AND id = ? AND deleted_at = ?', d.kind, d.id, d.deleted_at);
      pushed += batch.length;
    }
  }
  return { pulled, pushed };
}

/** How many changes on this device haven't reached the server yet. */
export async function pendingChanges(db: SQLiteDatabase): Promise<number> {
  let n = 0;
  for (const kind of KINDS) {
    const t = TABLES[kind];
    const extra = kind === 'setting' ? ` AND key NOT IN (${DEVICE_SETTINGS.map(() => '?').join(', ')})` : '';
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t.name} WHERE dirty = 1${extra}`, ...(kind === 'setting' ? DEVICE_SETTINGS : []));
    n += row?.n ?? 0;
  }
  const del = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_deletes');
  return n + (del?.n ?? 0);
}

const PAGE = 1000;

/** The real server: the `records` table, protected by row-level security (each account sees only its own). */
export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(since) {
      const out: RemoteRecord[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = client.from('records').select('kind, id, data, deleted, updated_at, synced_at').eq('user_id', userId);
        if (since) q = q.gt('synced_at', since);
        const { data, error } = await q.order('synced_at', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        out.push(...((data ?? []) as RemoteRecord[]));
        if (!data || data.length < PAGE) return out;
      }
    },
    async push(records) {
      const { error } = await client.from('records').upsert(
        records.map((r) => ({ user_id: userId, kind: r.kind, id: r.id, data: r.data, deleted: r.deleted, updated_at: r.updated_at })),
        { onConflict: 'user_id,kind,id' },
      );
      if (error) throw new Error(error.message);
    },
  };
}
