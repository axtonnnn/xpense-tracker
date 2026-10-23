// Pure money math behind the Dashboard. Everything here is unit-tested in __tests__/budget.test.ts.
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  parseISODate,
  startOfMonth,
  startOfWeek,
} from './dates';
import { upcomingOccurrences, type RecurringRule } from './recurring';

export type MoneyTx = {
  type: 'expense' | 'income';
  amount_cents: number;
  need_cents: number;
  want_cents: number;
  occurred_on: string;
  category: string;
};

export type Period = 'week' | 'month' | '6m' | '1y';
export const PRO_PERIODS: Period[] = ['6m', '1y'];

export type Bucket = {
  key: string;
  label: string;
  start: string;
  end: string;
  need: number;
  want: number;
  income: number;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function periodRange(period: Period, today: string): { start: string; end: string } {
  switch (period) {
    case 'week': {
      const start = startOfWeek(today);
      return { start, end: addDays(start, 6) };
    }
    case 'month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case '6m':
      return { start: startOfMonth(addMonths(startOfMonth(today), -5)), end: endOfMonth(today) };
    case '1y':
      return { start: startOfMonth(addMonths(startOfMonth(today), -11)), end: endOfMonth(today) };
  }
}

/** The previous period of the same length, for "vs last week/month" comparisons. */
export function previousRange(period: Period, today: string): { start: string; end: string } {
  switch (period) {
    case 'week':
      return periodRange('week', addDays(startOfWeek(today), -7));
    case 'month':
      return periodRange('month', addMonths(startOfMonth(today), -1));
    case '6m':
      return periodRange('6m', addMonths(startOfMonth(today), -6));
    case '1y':
      return periodRange('1y', addMonths(startOfMonth(today), -12));
  }
}

function emptyBucket(key: string, label: string, start: string, end: string): Bucket {
  return { key, label, start, end, need: 0, want: 0, income: 0 };
}

export function emptyBuckets(period: Period, today: string): Bucket[] {
  const { start, end } = periodRange(period, today);
  const out: Bucket[] = [];
  if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      out.push(emptyBucket(d, WEEKDAYS[i], d, d));
    }
  } else if (period === 'month') {
    const last = parseISODate(end).getDate();
    for (let from = 1; from <= last; from += 7) {
      const to = Math.min(from + 6, last);
      const s = addDays(start, from - 1);
      out.push(emptyBucket(s, `${from}–${to}`, s, addDays(start, to - 1)));
    }
  } else {
    const months = period === '6m' ? 6 : 12;
    for (let i = 0; i < months; i++) {
      const s = addMonths(start, i, 1);
      out.push(emptyBucket(s, MONTHS[parseISODate(s).getMonth()], s, endOfMonth(s)));
    }
  }
  return out;
}

export function chartSeries(txs: MoneyTx[], period: Period, today: string): Bucket[] {
  const buckets = emptyBuckets(period, today);
  for (const tx of txs) {
    const b = buckets.find((x) => tx.occurred_on >= x.start && tx.occurred_on <= x.end);
    if (!b) continue;
    if (tx.type === 'income') b.income += tx.amount_cents;
    else {
      b.need += tx.need_cents;
      b.want += tx.want_cents;
    }
  }
  return buckets;
}

export type Totals = { income: number; spent: number; need: number; want: number; saved: number };

export function totals(txs: MoneyTx[], start: string, end: string): Totals {
  const t = { income: 0, spent: 0, need: 0, want: 0, saved: 0 };
  for (const tx of txs) {
    if (tx.occurred_on < start || tx.occurred_on > end) continue;
    if (tx.type === 'income') t.income += tx.amount_cents;
    else {
      t.spent += tx.amount_cents;
      t.need += tx.need_cents;
      t.want += tx.want_cents;
    }
  }
  t.saved = t.income - t.spent;
  return t;
}

/** Share of spending that went to needs, 0–1, or null when nothing was spent. */
export function needsShare(need: number, want: number): number | null {
  const total = need + want;
  return total > 0 ? need / total : null;
}

export type SafeStatus = 'safe' | 'tight' | 'over' | 'unset';

export type SafeToSpend = {
  amount: number;
  perDay: number;
  daysLeft: number;
  income: number;
  upcomingBills: number;
  status: SafeStatus;
};

/**
 * What you can still spend this month without touching your savings goal or upcoming bills:
 * income (actual or expected, whichever is higher) − savings goal − spent − bills still due this month.
 */
export function safeToSpend(input: {
  today: string;
  txs: MoneyTx[];
  expectedIncomeCents: number;
  savingsGoalCents: number;
  recurring: (RecurringRule & { type: 'expense' | 'income' })[];
}): SafeToSpend {
  const start = startOfMonth(input.today);
  const end = endOfMonth(input.today);
  const t = totals(input.txs, start, end);
  const income = Math.max(t.income, input.expectedIncomeCents);
  let upcomingBills = 0;
  for (const r of input.recurring) {
    if (r.type !== 'expense') continue;
    upcomingBills += upcomingOccurrences(r, input.today, end).length * r.amount_cents;
  }
  const amount = income - input.savingsGoalCents - t.spent - upcomingBills;
  const daysLeft = diffDays(input.today, end) + 1;
  const perDay = amount > 0 ? Math.floor(amount / daysLeft) : 0;
  const budget = income - input.savingsGoalCents;
  let status: SafeStatus;
  if (income <= 0) status = 'unset';
  else if (amount < 0) status = 'over';
  else if (amount < budget * 0.2) status = 'tight';
  else status = 'safe';
  return { amount, perDay, daysLeft, income, upcomingBills, status };
}

/** Wants so far this period vs the same stretch of the previous period. */
export function wantsTrend(txs: MoneyTx[], period: Period, today: string): { current: number; previous: number; changePct: number | null } {
  const cur = periodRange(period, today);
  const prev = previousRange(period, today);
  const elapsed = diffDays(cur.start, today);
  const prevEnd = addDays(prev.start, elapsed) < prev.end ? addDays(prev.start, elapsed) : prev.end;
  const current = totals(txs, cur.start, today).want;
  const previous = totals(txs, prev.start, prevEnd).want;
  const changePct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, changePct };
}

export type CategoryTotal = { category: string; need: number; want: number; total: number };

export function categoryBreakdown(txs: MoneyTx[], start: string, end: string): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.occurred_on < start || tx.occurred_on > end) continue;
    const c = map.get(tx.category) ?? { category: tx.category, need: 0, want: 0, total: 0 };
    c.need += tx.need_cents;
    c.want += tx.want_cents;
    c.total += tx.amount_cents;
    map.set(tx.category, c);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Hourly pay in cents from monthly income and hours worked per week. */
export function hourlyRateCents(monthlyIncomeCents: number, hoursPerWeek: number): number | null {
  if (monthlyIncomeCents <= 0 || hoursPerWeek <= 0) return null;
  return Math.round((monthlyIncomeCents * 12) / 52 / hoursPerWeek);
}

export function hoursOfWork(priceCents: number, hourlyCents: number | null): number | null {
  if (!hourlyCents || hourlyCents <= 0) return null;
  return priceCents / hourlyCents;
}
