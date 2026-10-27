import type { SQLiteDatabase } from 'expo-sqlite';

import type { Necessity } from '../../shared/schemas';
import { recordDeletions } from './changes';
import { newId, nowISO } from './ids';
import { notifyChange } from './live';
import { inTransaction } from './tx';
import { insertTransaction, type TxType } from './transactions';
import { today as todayISO } from '@/lib/dates';
import { dueOccurrences, resumeOn, type Cadence, type RecurringRule } from '@/lib/recurring';

export type Recurring = RecurringRule & {
  label: string;
  category: string;
  necessity: Necessity | null;
  note: string | null;
  created_at: string;
};

export const FREE_RECURRING_LIMIT = 3;

export async function listRecurring(db: SQLiteDatabase): Promise<Recurring[]> {
  return db.getAllAsync<Recurring>('SELECT * FROM recurring ORDER BY active DESC, type DESC, label');
}

export async function countActiveRecurring(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM recurring WHERE active = 1');
  return row?.n ?? 0;
}

export async function addRecurring(
  db: SQLiteDatabase,
  r: {
    type: TxType;
    label: string;
    amountCents: number;
    category: string;
    necessity: Necessity | null;
    note?: string | null;
    cadence: Cadence;
    startOn: string;
  },
): Promise<string> {
  const id = newId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO recurring (id, type, label, amount_cents, category, necessity, note, cadence, anchor_on, next_on, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    r.type,
    r.label,
    r.amountCents,
    r.category,
    r.type === 'income' ? null : r.necessity,
    r.note?.trim() || null,
    r.cadence,
    r.startOn,
    r.startOn,
    now,
    now,
  );
  notifyChange();
  return id;
}

export async function setRecurringActive(db: SQLiteDatabase, id: string, active: boolean, today = todayISO()): Promise<void> {
  await inTransaction(db, async () => {
    const rule = await db.getFirstAsync<Recurring>('SELECT * FROM recurring WHERE id = ?', id);
    if (!rule) return;
    // Resuming picks up from today; what was missed while paused is not booked.
    const nextOn = active ? resumeOn(rule, today) : rule.next_on;
    await db.runAsync(
      'UPDATE recurring SET active = ?, next_on = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      active ? 1 : 0,
      nextOn,
      nowISO(),
      id,
    );
  });
  notifyChange();
}

export async function deleteRecurring(db: SQLiteDatabase, id: string): Promise<void> {
  await inTransaction(db, async () => {
    await db.runAsync('DELETE FROM recurring WHERE id = ?', id);
    await recordDeletions(db, 'recurring', [id]);
  });
  notifyChange();
}

/** Takes back a repeat that was just added: the rule and the entries it booked, on every device. */
export async function removeRecurringAndEntries(db: SQLiteDatabase, id: string): Promise<void> {
  await inTransaction(db, async () => {
    const booked = await db.getAllAsync<{ id: string }>('SELECT id FROM transactions WHERE recurring_id = ?', id);
    await db.runAsync('DELETE FROM transactions WHERE recurring_id = ?', id);
    await recordDeletions(
      db,
      'transaction',
      booked.map((b) => b.id),
    );
    await db.runAsync('DELETE FROM recurring WHERE id = ?', id);
    await recordDeletions(db, 'recurring', [id]);
  });
  notifyChange();
}

/** Books every due salary/bill as a transaction. Safe to call on every app start, even concurrently. */
export async function applyDueRecurring(db: SQLiteDatabase, today: string, currency: string): Promise<number> {
  let booked = 0;
  // Read inside the (serialized) transaction so two overlapping calls can't book the same bill twice.
  await inTransaction(db, async () => {
    const rules = await db.getAllAsync<Recurring>('SELECT * FROM recurring WHERE active = 1 AND next_on <= ?', today);
    for (const rule of rules) {
      const { dates, nextOn } = dueOccurrences(rule, today);
      for (const date of dates) {
        await insertTransaction(
          db,
          {
            type: rule.type,
            amountCents: rule.amount_cents,
            necessity: rule.necessity,
            currency,
            merchant: rule.label,
            note: rule.note,
            category: rule.category,
            occurredOn: date,
            source: 'recurring',
            recurringId: rule.id,
            id: `${rule.id}:${date}`,
          },
          false,
        );
      }
      await db.runAsync('UPDATE recurring SET next_on = ?, updated_at = ?, dirty = 1 WHERE id = ?', nextOn, nowISO(), rule.id);
      booked += dates.length;
    }
  });
  if (booked > 0) notifyChange();
  return booked;
}
