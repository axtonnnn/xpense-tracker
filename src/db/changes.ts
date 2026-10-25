import type { SQLiteDatabase } from 'expo-sqlite';

import { nowISO } from './ids';

/** The kinds of synced records, in the order a fresh device must apply them (parents before children). */
export const KINDS = ['setting', 'recurring', 'receipt', 'receipt_item', 'transaction'] as const;
export type Kind = (typeof KINDS)[number];

/**
 * Leaves a marker for each deleted row so sync can tell the account's other devices. Call it in the same
 * transaction as the delete.
 */
export async function recordDeletions(db: SQLiteDatabase, kind: Kind, ids: string[]): Promise<void> {
  const at = nowISO();
  for (const id of ids) {
    await db.runAsync(
      'INSERT INTO sync_deletes (kind, id, deleted_at) VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET deleted_at = excluded.deleted_at',
      kind,
      id,
      at,
    );
  }
}
