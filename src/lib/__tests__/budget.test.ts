import { describe, expect, it } from '@jest/globals';

import {
  categoryBreakdown,
  comparePeriods,
  pctChange,
  chartSeries,
  emptyBuckets,
  hourlyRateCents,
  hoursOfWork,
  needsShare,
  periodRange,
  previousRange,
  safeToSpend,
  totals,
  wantsTrend,
  type MoneyTx,
} from '../budget';
import type { RecurringRule } from '../recurring';

const exp = (on: string, need: number, want: number, category = 'groceries'): MoneyTx => ({
  type: 'expense',
  amount_cents: need + want,
  need_cents: need,
  want_cents: want,
  occurred_on: on,
  category,
});
const inc = (on: string, amount: number): MoneyTx => ({
  type: 'income',
  amount_cents: amount,
  need_cents: 0,
  want_cents: 0,
  occurred_on: on,
  category: 'salary',
});

describe('periods', () => {
  it('uses Monday-based weeks', () => {
    // 2026-10-23 is a Friday
    expect(periodRange('week', '2026-10-23')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(previousRange('week', '2026-10-23')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });

  it('covers whole months, including February', () => {
    expect(periodRange('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(previousRange('month', '2026-03-31')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('spans 6 and 12 months back from the current month', () => {
    expect(periodRange('6m', '2026-10-23')).toEqual({ start: '2026-05-01', end: '2026-10-31' });
    expect(periodRange('1y', '2026-01-15')).toEqual({ start: '2025-02-01', end: '2026-01-31' });
  });

  it('splits a month into week-sized buckets', () => {
    const b = emptyBuckets('month', '2026-10-23');
    expect(b.map((x) => x.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–31']);
    expect(b[4]).toMatchObject({ start: '2026-10-29', end: '2026-10-31' });
    expect(emptyBuckets('month', '2026-02-10')).toHaveLength(4);
  });

  it('labels monthly buckets', () => {
    expect(emptyBuckets('6m', '2026-10-23').map((b) => b.label)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  });
});

describe('chartSeries and totals', () => {
  const txs = [exp('2026-10-19', 1000, 500), exp('2026-10-21', 2000, 0), inc('2026-10-20', 50000), exp('2026-10-26', 999, 0)];

  it('puts needs, wants and income into the right day', () => {
    const s = chartSeries(txs, 'week', '2026-10-23');
    expect(s[0]).toMatchObject({ label: 'Mon', need: 1000, want: 500, income: 0 });
    expect(s[1]).toMatchObject({ label: 'Tue', income: 50000 });
    expect(s[2]).toMatchObject({ need: 2000 });
    expect(s.reduce((n, b) => n + b.need, 0)).toBe(3000); // the 26th is outside this week
  });

  it('totals a range and computes savings', () => {
    expect(totals(txs, '2026-10-19', '2026-10-25')).toEqual({ income: 50000, spent: 3500, need: 3000, want: 500, saved: 46500 });
  });

  it('reports the needs share, or null when nothing was spent', () => {
    expect(needsShare(3000, 1000)).toBe(0.75);
    expect(needsShare(0, 0)).toBeNull();
  });

  it('ranks categories by total', () => {
    const b = categoryBreakdown([exp('2026-10-02', 0, 3000, 'dining'), exp('2026-10-03', 5000, 0)], '2026-10-01', '2026-10-31');
    expect(b.map((x) => x.category)).toEqual(['groceries', 'dining']);
  });
});

describe('safeToSpend', () => {
  const rent: RecurringRule & { type: 'expense' } = {
    id: 'r',
    type: 'expense',
    amount_cents: 100000,
    cadence: 'monthly',
    anchor_on: '2026-09-28',
    next_on: '2026-10-28',
    active: 1,
  };

  it('subtracts savings goal, spending and bills still due', () => {
    const s = safeToSpend({
      today: '2026-10-23',
      txs: [inc('2026-10-01', 300000), exp('2026-10-05', 40000, 10000)],
      expectedIncomeCents: 0,
      savingsGoalCents: 50000,
      recurring: [rent],
    });
    expect(s.upcomingBills).toBe(100000);
    expect(s.amount).toBe(300000 - 50000 - 50000 - 100000);
    expect(s.daysLeft).toBe(9);
    expect(s.perDay).toBe(Math.floor(100000 / 9));
    expect(s.status).toBe('safe');
  });

  it('uses expected income until the paycheck is logged', () => {
    const s = safeToSpend({ today: '2026-10-02', txs: [], expectedIncomeCents: 200000, savingsGoalCents: 0, recurring: [] });
    expect(s.amount).toBe(200000);
  });

  it('flags tight and over budgets', () => {
    const base = { today: '2026-10-23', expectedIncomeCents: 100000, savingsGoalCents: 0, recurring: [] };
    expect(safeToSpend({ ...base, txs: [exp('2026-10-01', 90000, 0)] }).status).toBe('tight');
    const over = safeToSpend({ ...base, txs: [exp('2026-10-01', 90000, 20000)] });
    expect(over.status).toBe('over');
    expect(over.perDay).toBe(0);
  });

  it('asks for income when none is known', () => {
    expect(safeToSpend({ today: '2026-10-23', txs: [], expectedIncomeCents: 0, savingsGoalCents: 0, recurring: [] }).status).toBe('unset');
  });
});

describe('wantsTrend', () => {
  it('compares the same stretch of the previous month', () => {
    const txs = [exp('2026-09-05', 0, 10000), exp('2026-09-25', 0, 99999), exp('2026-10-04', 0, 8000)];
    const t = wantsTrend(txs, 'month', '2026-10-23');
    expect(t).toEqual({ current: 8000, previous: 10000, changePct: -20 });
  });

  it('returns null change when there is nothing to compare', () => {
    expect(wantsTrend([exp('2026-10-04', 0, 8000)], 'month', '2026-10-23').changePct).toBeNull();
  });
});

describe('hours of work', () => {
  it('converts a price into hours at the user’s pay rate', () => {
    const rate = hourlyRateCents(346667, 40); // ≈ $20/h
    expect(rate).toBe(2000);
    expect(hoursOfWork(5000, rate)).toBe(2.5);
    expect(hoursOfWork(5000, null)).toBeNull();
    expect(hourlyRateCents(0, 40)).toBeNull();
  });
});

describe('comparePeriods', () => {
  it('compares month-to-date with the same days of last month', () => {
    const txs = [inc('2026-09-01', 300000), exp('2026-09-10', 20000, 5000), exp('2026-09-28', 99999, 0), inc('2026-10-01', 300000), exp('2026-10-12', 15000, 2000)];
    const { current, previous } = comparePeriods(txs, 'month', '2026-10-23');
    expect(current).toMatchObject({ income: 300000, spent: 17000 });
    expect(previous).toMatchObject({ income: 300000, spent: 25000 }); // Sep 28 is after "Sep 23", so it's left out
    expect(pctChange(current.spent, previous.spent)).toBe(-32);
    expect(pctChange(5, 0)).toBeNull();
  });

  it('reports the monthly budget for the safe-to-spend meter', () => {
    const s = safeToSpend({ today: '2026-10-23', txs: [], expectedIncomeCents: 300000, savingsGoalCents: 60000, recurring: [] });
    expect(s.budget).toBe(240000);
  });
});
