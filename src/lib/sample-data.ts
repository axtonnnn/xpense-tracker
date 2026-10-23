// Development helper: fills the app with ~3 months of realistic entries (Settings → Developer).
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from '@/db/live';
import { addRecurring } from '@/db/recurring';
import { insertTransaction, type NewTx } from '@/db/transactions';
import { inTransaction } from '@/db/tx';
import { addDays, addMonths, startOfMonth, today } from './dates';

// Small deterministic random generator so sample data looks the same every time.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function loadSampleData(db: SQLiteDatabase, currency: string): Promise<void> {
  const rand = rng(42);
  const t = today();
  const start = startOfMonth(addMonths(startOfMonth(t), -2, 1));
  const entries: NewTx[] = [];
  const add = (e: Omit<NewTx, 'currency'>) => entries.push({ ...e, currency });
  const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100);

  for (let d = start; d <= t; d = addDays(d, 1)) {
    const day = Number(d.slice(8, 10));
    const weekday = new Date(`${d}T12:00:00`).getDay();
    if (day === 1) add({ type: 'income', amountCents: 260000, category: 'salary', merchant: 'Paycheck', occurredOn: d });
    if (day === 15) add({ type: 'income', amountCents: 260000, category: 'salary', merchant: 'Paycheck', occurredOn: d });
    if (day === 1) add({ type: 'expense', amountCents: 145000, necessity: 'need', category: 'housing', merchant: 'Rent', occurredOn: d });
    if (day === 5) add({ type: 'expense', amountCents: between(70, 110), necessity: 'need', category: 'utilities', merchant: 'City Power & Water', occurredOn: d });
    if (day === 9) add({ type: 'expense', amountCents: 6500, necessity: 'need', category: 'utilities', merchant: 'Internet', occurredOn: d });
    if (day === 12) add({ type: 'expense', amountCents: 1599, necessity: 'want', category: 'subscriptions', merchant: 'Netflix', occurredOn: d });
    if (day === 20) add({ type: 'expense', amountCents: 1099, necessity: 'want', category: 'subscriptions', merchant: 'Spotify', occurredOn: d });
    if (weekday === 6) add({ type: 'expense', amountCents: between(60, 120), necessity: 'need', category: 'groceries', merchant: 'Green Valley Market', occurredOn: d });
    if (weekday === 3) add({ type: 'expense', amountCents: between(30, 55), necessity: 'need', category: 'transport', merchant: 'Shell', occurredOn: d });
    if (weekday === 5 && rand() < 0.8) add({ type: 'expense', amountCents: between(25, 70), necessity: 'want', category: 'dining', merchant: 'Luigi’s Pizza', occurredOn: d });
    if (rand() < 0.35) add({ type: 'expense', amountCents: between(4, 7), necessity: 'want', category: 'dining', merchant: 'Corner Coffee', occurredOn: d });
    if (rand() < 0.08) add({ type: 'expense', amountCents: between(20, 90), necessity: 'want', category: 'shopping', merchant: 'Target', occurredOn: d });
    if (rand() < 0.04) add({ type: 'expense', amountCents: between(15, 45), necessity: 'need', category: 'health', merchant: 'CVS Pharmacy', occurredOn: d });
  }

  await inTransaction(db, async () => {
    for (const e of entries) await insertTransaction(db, e, false);
  });
  await addRecurring(db, {
    type: 'expense',
    label: 'Rent',
    amountCents: 145000,
    category: 'housing',
    necessity: 'need',
    cadence: 'monthly',
    startOn: addMonths(startOfMonth(t), 1, 1),
  });
  notifyChange();
}
