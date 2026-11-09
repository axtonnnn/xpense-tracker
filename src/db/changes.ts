import type { SQLiteDatabase } from 'expo-sqlite';

import { nowISO } from './ids';

/** The kinds of synced records, in the order a fresh device must apply them (parents before children). */
export const KINDS = ['setting', 'recurring', 'receipt', 'receipt_item', 'transaction', 'goal', 'goal_deposit'] as const;
export type Kind = (typeof KINDS)[number];

/**
 * Kinds added after the first release. An account whose server schema predates them (supabase/schema.sql
 * not run again since) rejects them; sync keeps them on the device and carries on with everything else.
 */
export const NEWER_KINDS: readonly Kind[] = ['goal', 'goal_deposit'];

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
