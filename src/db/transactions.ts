import type { SQLiteDatabase } from 'expo-sqlite';

import type { Necessity } from '../../shared/schemas';
import { recordDeletions } from './changes';
import { newId, nowISO } from './ids';
import { notifyChange } from './live';
import { inTransaction } from './tx';
import { deleteReceiptImage } from '@/lib/files';
import type { ReceiptDraft } from '@/lib/receipt';
import { splitTotal, transactionCategory } from '@/lib/receipt';

export type TxType = 'expense' | 'income';
export type TxSource = 'manual' | 'scan' | 'recurring';

export type Tx = {
  id: string;
  type: TxType;
  amount_cents: number;
  need_cents: number;
  want_cents: number;
  currency: string;
  merchant: string | null;
  note: string | null;
  category: string;
  occurred_on: string;
  source: TxSource;
  receipt_id: string | null;
  recurring_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReceiptRow = {
  id: string;
  image_uri: string | null;
  doc_type: string;
  merchant: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_cents: number;
  due_on: string | null;
  scanned_at: string;
};

export type ReceiptItemRow = {
  id: string;
  receipt_id: string;
  position: number;
  name: string;
  qty: number | null;
  total_cents: number;
  category: string;
  necessity: Necessity;
  reason: string | null;
};

export type NewTx = {
  type: TxType;
  amountCents: number;
  necessity?: Necessity | null;
  currency: string;
  merchant?: string | null;
  note?: string | null;
  category: string;
  occurredOn: string;
  source?: TxSource;
  recurringId?: string | null;
  /** A fixed id (repeating entries use rule:date, so two devices booking the same paycheck agree). */
  id?: string;
};

/** For a manual expense the whole amount goes into one bucket; income has no need/want split. */
export function splitFor(type: TxType, amountCents: number, necessity?: Necessity | null) {
  if (type === 'income') return { need: 0, want: 0 };
  return necessity === 'need' ? { need: amountCents, want: 0 } : { need: 0, want: amountCents };
}

export async function insertTransaction(db: SQLiteDatabase, tx: NewTx, notify = true): Promise<string> {
  const id = tx.id ?? newId();
  const split = splitFor(tx.type, tx.amountCents, tx.necessity);
  const now = nowISO();
  // A fixed id that already exists was booked by another device and synced here: keep that one.
  await db.runAsync(
    `INSERT ${tx.id ? 'OR IGNORE ' : ''}INTO transactions (id, type, amount_cents, need_cents, want_cents, currency, merchant, note,
       category, occurred_on, source, recurring_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tx.type,
    tx.amountCents,
    split.need,
    split.want,
    tx.currency,
    tx.merchant?.trim() || null,
    tx.note?.trim() || null,
    tx.category,
    tx.occurredOn,
    tx.source ?? 'manual',
    tx.recurringId ?? null,
    now,
    now,
  );
  if (notify) notifyChange();
  return id;
}

export type TxPatch = Partial<Pick<NewTx, 'amountCents' | 'merchant' | 'note' | 'category' | 'occurredOn'>> & {
  necessity?: Necessity | null;
};

export async function updateTransaction(db: SQLiteDatabase, id: string, patch: TxPatch): Promise<void> {
  const current = await db.getFirstAsync<Tx>('SELECT * FROM transactions WHERE id = ?', id);
  if (!current) return;
  const amount = patch.amountCents ?? current.amount_cents;
  let need = current.need_cents;
  let want = current.want_cents;
  if (patch.necessity !== undefined || patch.amountCents !== undefined) {
    if (current.receipt_id && patch.necessity === undefined) {
      // Keep a scanned receipt's mixed split, scaled to the new amount.
      const base = current.need_cents + current.want_cents;
      need = base > 0 ? Math.round((amount * current.need_cents) / base) : 0;
      want = amount - need;
    } else {
      const fallback: Necessity = current.need_cents >= current.want_cents ? 'need' : 'want';
      const s = splitFor(current.type, amount, patch.necessity ?? fallback);
      need = s.need;
      want = s.want;
    }
  }
  await db.runAsync(
    `UPDATE transactions SET amount_cents = ?, need_cents = ?, want_cents = ?, merchant = ?, note = ?,
       category = ?, occurred_on = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    amount,
    need,
    want,
    patch.merchant !== undefined ? patch.merchant?.trim() || null : current.merchant,
    patch.note !== undefined ? patch.note?.trim() || null : current.note,
    patch.category ?? current.category,
    patch.occurredOn ?? current.occurred_on,
    nowISO(),
    id,
  );
  notifyChange();
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const tx = await db.getFirstAsync<Tx>('SELECT * FROM transactions WHERE id = ?', id);
  if (!tx) return;
  let imageUri: string | null = null;
  await inTransaction(db, async () => {
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
    await recordDeletions(db, 'transaction', [id]);
    if (tx.receipt_id) {
      const r = await db.getFirstAsync<{ image_uri: string | null }>(
        'SELECT image_uri FROM receipts WHERE id = ?',
        tx.receipt_id,
      );
      imageUri = r?.image_uri ?? null;
      const items = await db.getAllAsync<{ id: string }>('SELECT id FROM receipt_items WHERE receipt_id = ?', tx.receipt_id);
      await db.runAsync('DELETE FROM receipts WHERE id = ?', tx.receipt_id);
      await recordDeletions(db, 'receipt', [tx.receipt_id]);
      await recordDeletions(
        db,
        'receipt_item',
        items.map((it) => it.id),
      );
    }
  });
  if (imageUri) deleteReceiptImage(imageUri);
  notifyChange();
}

export async function listBetween(db: SQLiteDatabase, from: string, to: string): Promise<Tx[]> {
  return db.getAllAsync<Tx>(
    'SELECT * FROM transactions WHERE occurred_on >= ? AND occurred_on <= ? ORDER BY occurred_on DESC, created_at DESC',
    from,
    to,
  );
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: string,
): Promise<{ tx: Tx; receipt: ReceiptRow | null; items: ReceiptItemRow[] } | null> {
  const tx = await db.getFirstAsync<Tx>('SELECT * FROM transactions WHERE id = ?', id);
  if (!tx) return null;
  if (!tx.receipt_id) return { tx, receipt: null, items: [] };
  const receipt = await db.getFirstAsync<ReceiptRow>('SELECT * FROM receipts WHERE id = ?', tx.receipt_id);
  const items = await db.getAllAsync<ReceiptItemRow>(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY position',
    tx.receipt_id,
  );
  return { tx, receipt, items };
}

export type RecentScan = Tx & { image_uri: string | null; doc_type: string };

export async function listRecentScans(db: SQLiteDatabase, limit = 10): Promise<RecentScan[]> {
  return db.getAllAsync<RecentScan>(
    `SELECT t.*, r.image_uri, r.doc_type FROM transactions t JOIN receipts r ON r.id = t.receipt_id
     ORDER BY r.scanned_at DESC LIMIT ?`,
    limit,
  );
}

export async function saveScannedReceipt(
  db: SQLiteDatabase,
  draft: ReceiptDraft,
  imageUri: string | null,
  aiJson: string,
): Promise<string> {
  const receiptId = newId();
  const txId = newId();
  const split = splitTotal(draft);
  const now = nowISO();
  await inTransaction(db, async () => {
    await db.runAsync(
      `INSERT INTO receipts (id, image_uri, doc_type, merchant, subtotal_cents, tax_cents, tip_cents, total_cents,
         due_on, ai_json, scanned_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      receiptId,
      imageUri,
      draft.docType,
      draft.merchant || null,
      draft.subtotalCents,
      draft.taxCents,
      draft.tipCents,
      draft.totalCents,
      draft.dueDate,
      aiJson,
      now,
      now,
    );
    for (const [i, item] of draft.items.entries()) {
      await db.runAsync(
        `INSERT INTO receipt_items (id, receipt_id, position, name, qty, total_cents, category, necessity, reason, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        receiptId,
        i,
        item.name,
        item.qty,
        item.totalCents,
        item.category,
        item.necessity,
        item.reason,
        now,
      );
    }
    await db.runAsync(
      `INSERT INTO transactions (id, type, amount_cents, need_cents, want_cents, currency, merchant, note, category,
         occurred_on, source, receipt_id, created_at, updated_at) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, 'scan', ?, ?, ?)`,
      txId,
      draft.totalCents,
      split.need,
      split.want,
      draft.currency,
      draft.merchant || null,
      null, // the AI's remark (draft.notes) is shown while reviewing; the note field is the person's own
      transactionCategory(draft),
      draft.date,
      receiptId,
      now,
      now,
    );
  });
  notifyChange();
  return txId;
}

/** Re-labels one receipt line as need/want and re-derives the parent transaction's split. */
export async function setItemNecessity(
  db: SQLiteDatabase,
  txId: string,
  itemId: string,
  necessity: Necessity,
): Promise<void> {
  await inTransaction(db, async () => {
    // Read inside the transaction so quick successive toggles each see the previous one.
    const found = await getTransaction(db, txId);
    if (!found?.receipt) return;
    const items = found.items.map((it) => (it.id === itemId ? { ...it, necessity } : it));
    const split = splitTotal({
      totalCents: found.tx.amount_cents,
      necessity: found.tx.need_cents >= found.tx.want_cents ? 'need' : 'want',
      items: items.map((it) => ({ totalCents: it.total_cents, necessity: it.necessity })),
    });
    const now = nowISO();
    await db.runAsync('UPDATE receipt_items SET necessity = ?, updated_at = ?, dirty = 1 WHERE id = ?', necessity, now, itemId);
    await db.runAsync(
      'UPDATE transactions SET need_cents = ?, want_cents = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      split.need,
      split.want,
      now,
      txId,
    );
  });
  notifyChange();
}

export async function allTransactions(db: SQLiteDatabase): Promise<Tx[]> {
  return db.getAllAsync<Tx>('SELECT * FROM transactions ORDER BY occurred_on DESC, created_at DESC');
}

/** Wipes this account's copy on the device (after the account itself was deleted). Nothing is synced. */
export async function deleteAllData(db: SQLiteDatabase): Promise<string[]> {
  const images = await db.getAllAsync<{ image_uri: string }>(
    'SELECT image_uri FROM receipts WHERE image_uri IS NOT NULL',
  );
  await inTransaction(db, async () => {
    await db.execAsync(
      `DELETE FROM transactions; DELETE FROM receipt_items; DELETE FROM receipts; DELETE FROM recurring; DELETE FROM settings;
       DELETE FROM sync_deletes; DELETE FROM sync_state;`,
    );
  });
  images.forEach((r) => deleteReceiptImage(r.image_uri));
  notifyChange();
  return images.map((r) => r.image_uri);
}
