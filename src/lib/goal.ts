// Pure maths behind the savings goal. Unit-tested in __tests__/goal.test.ts.
//
// The monthly set-aside (Settings → "Set aside each month") is already kept out of what's safe to spend.
// Moving it into the goal changes nothing; adding more than that in a month comes out of what's safe to
// spend, and taking money out puts it back. Money saved before the goal began never touches a month.
import { addMonths, endOfMonth, parseISODate, startOfMonth } from './dates';

export type GoalStatus = 'active' | 'bought' | 'stopped';
export type DepositKind = 'deposit' | 'withdrawal' | 'starting';

export type DepositLike = { amount_cents: number; occurred_on: string; kind: string };

/** Money in is positive, money taken out negative. A kind from a newer app version counts as nothing. */
export function signedAmount(d: DepositLike): number {
  if (d.kind === 'deposit' || d.kind === 'starting') return d.amount_cents;
  if (d.kind === 'withdrawal') return -d.amount_cents;
  return 0;
}

export function savedTotal(deposits: DepositLike[]): number {
  return Math.max(0, deposits.reduce((sum, d) => sum + signedAmount(d), 0));
}

export type Moves = { deposits: number; withdrawals: number };

/** Money moved into and out of savings between two days (inclusive). */
export function movesBetween(deposits: DepositLike[], start: string, end: string): Moves {
  const out = { deposits: 0, withdrawals: 0 };
  for (const d of deposits) {
    if (d.occurred_on < start || d.occurred_on > end) continue;
    if (d.kind === 'deposit') out.deposits += d.amount_cents;
    else if (d.kind === 'withdrawal') out.withdrawals += d.amount_cents;
  }
  return out;
}

/**
 * How a month's savings moves change what's safe to spend: deposits beyond the set-aside come out of it,
 * withdrawals go back in. Negative means less to spend.
 */
export function savingsEffect(moves: Moves, setAside: number): number {
  return moves.withdrawals - Math.max(0, moves.deposits - Math.max(0, setAside));
}

/** How much of a new deposit would come out of what's safe to spend this month. */
export function extraFor(depositedThisMonth: number, amount: number, setAside: number): number {
  const before = Math.max(0, depositedThisMonth - setAside);
  const after = Math.max(0, depositedThisMonth + amount - setAside);
  return after - before;
}

/** 0–1 of the way there. */
export function progress(saved: number, target: number): number {
  if (target <= 0) return saved > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, saved / target));
}

/**
 * The month the goal is reached at the monthly set-aside, as its first day ("2027-01-01"), or null when
 * nothing is set aside each month. Whatever of this month's set-aside hasn't gone in yet still counts.
 */
export function arrivalMonth(input: { today: string; target: number; saved: number; setAside: number; depositedThisMonth: number }): string | null {
  let month = startOfMonth(input.today);
  if (input.saved >= input.target) return month;
  if (input.setAside <= 0) return null;
  let saved = input.saved + Math.max(0, input.setAside - input.depositedThisMonth);
  // 50 years: stop rather than count forever towards a tiny set-aside.
  for (let i = 0; i < 600; i++) {
    if (saved >= input.target) return month;
    month = addMonths(month, 1);
    saved += input.setAside;
  }
  return null;
}

/** "February", or "February 2028" when it's a year or more away. */
export function monthName(monthStart: string, today: string): string {
  const d = parseISODate(monthStart);
  const months = (d.getFullYear() - parseISODate(today).getFullYear()) * 12 + d.getMonth() - parseISODate(today).getMonth();
  return d.toLocaleDateString(undefined, months >= 12 ? { month: 'long', year: 'numeric' } : { month: 'long' });
}

/** Whole months between the goal's start and a day, at least 1 ("Four months of setting money aside"). */
export function monthsBetween(start: string, end: string): number {
  const a = parseISODate(start);
  const b = parseISODate(end);
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0);
  return Math.max(1, whole);
}

export type Checkin = { month: string; amount: number; partial: boolean };

/**
 * In a new month: did last month's set-aside go into savings? Asked once per month (the answer syncs as
 * `answered`, "2026-10"), only for a goal that was already running last month, and not when enough
 * went in already.
 */
export function checkinDue(input: {
  today: string;
  startedOn: string;
  setAside: number;
  deposits: DepositLike[];
  answered: string | null;
}): Checkin | null {
  if (input.setAside <= 0) return null;
  const month = addMonths(startOfMonth(input.today), -1);
  const end = endOfMonth(month);
  if (input.startedOn > end) return null;
  if (input.answered === month.slice(0, 7)) return null;
  const went = movesBetween(input.deposits, month, end).deposits;
  if (went >= input.setAside) return null;
  return { month, amount: input.setAside - went, partial: went > 0 };
}
