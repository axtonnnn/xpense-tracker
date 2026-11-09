// The savings goal: one active at a time, and the money moved in and out of it. Both sync like entries.
import type { SQLiteDatabase } from 'expo-sqlite';

import { recordDeletions } from './changes';
import { newId, nowISO } from './ids';
import { notifyChange, useLiveQuery } from './live';
import { inTransaction } from './tx';
import { savedTotal, type DepositKind, type GoalStatus } from '@/lib/goal';

export type Goal = {
  id: string;
  name: string;
  target_cents: number;
  started_on: string;
  status: GoalStatus;
  finished_on: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalDeposit = {
  id: string;
  goal_id: string;
  amount_cents: number;
  occurred_on: string;
  note: string | null;
  kind: DepositKind;
  created_at: string;
};

/** The goal being saved for. If two devices each started one while offline, the newest wins. */
export async function getActiveGoal(db: SQLiteDatabase): Promise<Goal | null> {
  return (await db.getFirstAsync<Goal>("SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")) ?? null;
}

export async function getGoal(db: SQLiteDatabase, id: string): Promise<Goal | null> {
  return (await db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', id)) ?? null;
}

/** Goals that are done (bought or stopped), newest first. */
export async function listFinishedGoals(db: SQLiteDatabase): Promise<Goal[]> {
  return db.getAllAsync<Goal>("SELECT * FROM goals WHERE status != 'active' ORDER BY COALESCE(finished_on, created_at) DESC");
}

/** A goal's deposits and withdrawals, newest first. */
export async function listDeposits(db: SQLiteDatabase, goalId: string): Promise<GoalDeposit[]> {
  return db.getAllAsync<GoalDeposit>('SELECT * FROM goal_deposits WHERE goal_id = ? ORDER BY occurred_on DESC, created_at DESC', goalId);
}

/** Every goal's money moves in a date range (a month's budget counts them whatever the goal). */
export async function depositsBetween(db: SQLiteDatabase, start: string, end: string): Promise<GoalDeposit[]> {
  return db.getAllAsync<GoalDeposit>('SELECT * FROM goal_deposits WHERE occurred_on BETWEEN ? AND ? ORDER BY occurred_on', start, end);
}

export async function createGoal(
  db: SQLiteDatabase,
  g: { name: string; targetCents: number; startedOn: string; alreadySavedCents?: number },
): Promise<string> {
  const id = newId();
  const now = nowISO();
  await inTransaction(db, async () => {
    // One goal at a time: starting a new one ends any other that is still running.
    const running = await db.getAllAsync<{ id: string }>("SELECT id FROM goals WHERE status = 'active'");
    for (const r of running) {
      await db.runAsync("UPDATE goals SET status = 'stopped', finished_on = ?, updated_at = ?, dirty = 1 WHERE id = ?", g.startedOn, now, r.id);
    }
    await db.runAsync(
      `INSERT INTO goals (id, name, target_cents, started_on, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      id,
      g.name.trim(),
      g.targetCents,
      g.startedOn,
      now,
      now,
    );
    if (g.alreadySavedCents && g.alreadySavedCents > 0) {
      await db.runAsync(
        `INSERT INTO goal_deposits (id, goal_id, amount_cents, occurred_on, note, kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'starting', ?, ?)`,
        newId(),
        id,
        g.alreadySavedCents,
        g.startedOn,
        'Already saved',
        now,
        now,
      );
    }
  });
  notifyChange();
  return id;
}

export async function updateGoal(db: SQLiteDatabase, id: string, patch: { name?: string; targetCents?: number }): Promise<void> {
  const goal = await getGoal(db, id);
  if (!goal) return;
  await db.runAsync(
    'UPDATE goals SET name = ?, target_cents = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    patch.name?.trim() || goal.name,
    patch.targetCents ?? goal.target_cents,
    nowISO(),
    id,
  );
  notifyChange();
}

/** Ends the goal: "I bought it" (paid from savings) or stopped to start another. */
export async function finishGoal(db: SQLiteDatabase, id: string, status: Exclude<GoalStatus, 'active'>, on: string): Promise<void> {
  await db.runAsync('UPDATE goals SET status = ?, finished_on = ?, updated_at = ?, dirty = 1 WHERE id = ?', status, on, nowISO(), id);
  notifyChange();
}

/** Deletes a goal and everything moved in and out of it, on every device. */
export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  await inTransaction(db, async () => {
    const deposits = await db.getAllAsync<{ id: string }>('SELECT id FROM goal_deposits WHERE goal_id = ?', id);
    await db.runAsync('DELETE FROM goal_deposits WHERE goal_id = ?', id);
    await db.runAsync('DELETE FROM goals WHERE id = ?', id);
    await recordDeletions(
      db,
      'goal_deposit',
      deposits.map((d) => d.id),
    );
    await recordDeletions(db, 'goal', [id]);
  });
  notifyChange();
}

export async function addDeposit(
  db: SQLiteDatabase,
  d: { goalId: string; amountCents: number; occurredOn: string; note?: string | null; kind?: DepositKind },
): Promise<string> {
  const id = newId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO goal_deposits (id, goal_id, amount_cents, occurred_on, note, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    d.goalId,
    Math.abs(d.amountCents),
    d.occurredOn,
    d.note?.trim() || null,
    d.kind ?? 'deposit',
    now,
    now,
  );
  notifyChange();
  return id;
}

export async function deleteDeposit(db: SQLiteDatabase, id: string): Promise<void> {
  await inTransaction(db, async () => {
    await db.runAsync('DELETE FROM goal_deposits WHERE id = ?', id);
    await recordDeletions(db, 'goal_deposit', [id]);
  });
  notifyChange();
}

export type GoalState = { goal: Goal; deposits: GoalDeposit[]; saved: number };

async function loadActive(db: SQLiteDatabase): Promise<GoalState | null> {
  const goal = await getActiveGoal(db);
  if (!goal) return null;
  const deposits = await listDeposits(db, goal.id);
  return { goal, deposits, saved: savedTotal(deposits) };
}

/** The active goal with its deposits; `null` when there is none, `undefined` while loading. */
export function useActiveGoal(): GoalState | null | undefined {
  return useLiveQuery(loadActive, []).data;
}
