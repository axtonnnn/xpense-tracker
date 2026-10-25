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

  // Someone in their first full-time job, living alone: paid weekly, renting a studio, bus to work.
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const day = Number(d.slice(8, 10));
    const weekday = new Date(`${d}T12:00:00`).getDay();
    if (weekday === 5) add({ type: 'income', amountCents: 68000, category: 'salary', merchant: 'Paycheck', occurredOn: d });
    if (day === 1) add({ type: 'expense', amountCents: 105000, necessity: 'need', category: 'housing', merchant: 'Rent', occurredOn: d });
    if (day === 6) add({ type: 'expense', amountCents: 4500, necessity: 'need', category: 'utilities', merchant: 'Phone plan', occurredOn: d });
    if (day === 9) add({ type: 'expense', amountCents: 5500, necessity: 'need', category: 'utilities', merchant: 'Internet', occurredOn: d });
    if (day === 14) add({ type: 'expense', amountCents: between(28, 46), necessity: 'need', category: 'utilities', merchant: 'Electricity', occurredOn: d });
    if (day === 12) add({ type: 'expense', amountCents: 1199, necessity: 'want', category: 'subscriptions', merchant: 'Spotify', occurredOn: d });
    if (day === 18) add({ type: 'expense', amountCents: 2500, necessity: 'want', category: 'entertainment', merchant: 'Gym', occurredOn: d });
    if (weekday === 1) add({ type: 'expense', amountCents: 3000, necessity: 'need', category: 'transport', merchant: 'Bus pass', occurredOn: d });
    if (weekday === 6) add({ type: 'expense', amountCents: between(42, 78), necessity: 'need', category: 'groceries', merchant: 'Green Valley Market', occurredOn: d });
    if (weekday === 5 && rand() < 0.75) add({ type: 'expense', amountCents: between(14, 38), necessity: 'want', category: 'dining', merchant: 'Luigi’s Pizza', occurredOn: d });
    if (rand() < 0.3) add({ type: 'expense', amountCents: between(4, 7), necessity: 'want', category: 'dining', merchant: 'Corner Café', occurredOn: d });
    if (rand() < 0.06) add({ type: 'expense', amountCents: between(20, 70), necessity: 'want', category: 'shopping', merchant: 'Thrift & Co', occurredOn: d });
    if (rand() < 0.05) add({ type: 'expense', amountCents: between(12, 32), necessity: 'want', category: 'entertainment', merchant: 'Northside Cinema', occurredOn: d });
    if (rand() < 0.03) add({ type: 'expense', amountCents: between(10, 40), necessity: 'need', category: 'health', merchant: 'Pharmacy', occurredOn: d });
  }

  await inTransaction(db, async () => {
    for (const e of entries) await insertTransaction(db, e, false);
  });
  // From here on the paycheck and the rent book themselves.
  let friday = addDays(t, 1);
  while (new Date(`${friday}T12:00:00`).getDay() !== 5) friday = addDays(friday, 1);
  await addRecurring(db, { type: 'income', label: 'Paycheck', amountCents: 68000, category: 'salary', necessity: null, cadence: 'weekly', startOn: friday });
  await addRecurring(db, {
    type: 'expense',
    label: 'Rent',
    amountCents: 105000,
    category: 'housing',
    necessity: 'need',
    cadence: 'monthly',
    startOn: addMonths(startOfMonth(t), 1, 1),
  });
  await addRecurring(db, {
    type: 'expense',
    label: 'Phone plan',
    amountCents: 4500,
    category: 'utilities',
    necessity: 'need',
    cadence: 'monthly',
    startOn: addMonths(startOfMonth(t), 1, 6),
  });
  notifyChange();
}
