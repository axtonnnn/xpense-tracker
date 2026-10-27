import { describe, expect, it } from '@jest/globals';

import { safeToSpend, type MoneyTx } from '../budget';
import {
  arrivalMonth,
  checkinDue,
  extraFor,
  monthsBetween,
  movesBetween,
  progress,
  savedTotal,
  savingsEffect,
  type DepositLike,
} from '../goal';

const dep = (on: string, cents: number, kind = 'deposit'): DepositLike => ({ amount_cents: cents, occurred_on: on, kind });

describe('saved total', () => {
  it('adds deposits and money saved before the goal, and takes withdrawals off', () => {
    expect(savedTotal([dep('2026-09-20', 12000, 'starting'), dep('2026-10-01', 30000), dep('2026-10-12', 5000, 'withdrawal')])).toBe(37000);
  });

  it('ignores kinds it does not know (a newer app version) and never goes below zero', () => {
    expect(savedTotal([dep('2026-10-01', 30000), dep('2026-10-02', 99999, 'interest')])).toBe(30000);
    expect(savedTotal([dep('2026-10-01', 1000, 'withdrawal')])).toBe(0);
  });

  it('measures progress from 0 to 1', () => {
    expect(progress(42000, 120000)).toBeCloseTo(0.35);
    expect(progress(130000, 120000)).toBe(1);
    expect(progress(0, 0)).toBe(0);
  });
});

describe('what savings do to the month', () => {
  const deposits = [dep('2026-09-20', 12000, 'starting'), dep('2026-10-01', 30000), dep('2026-10-15', 5000), dep('2026-10-20', 2000, 'withdrawal')];

  it("counts a month's deposits and withdrawals, not the money saved before", () => {
    expect(movesBetween(deposits, '2026-10-01', '2026-10-31')).toEqual({ deposits: 35000, withdrawals: 2000 });
    expect(movesBetween(deposits, '2026-09-01', '2026-09-30')).toEqual({ deposits: 0, withdrawals: 0 });
  });

  it('only takes deposits beyond the set-aside out of what is safe to spend, and gives withdrawals back', () => {
    expect(savingsEffect({ deposits: 30000, withdrawals: 0 }, 30000)).toBe(0);
    expect(savingsEffect({ deposits: 10000, withdrawals: 0 }, 30000)).toBe(0);
    expect(savingsEffect({ deposits: 35000, withdrawals: 0 }, 30000)).toBe(-5000);
    expect(savingsEffect({ deposits: 35000, withdrawals: 2000 }, 30000)).toBe(-3000);
    expect(savingsEffect({ deposits: 5000, withdrawals: 0 }, 0)).toBe(-5000);
  });

  it('says how much of a new deposit comes out of what is safe to spend', () => {
    expect(extraFor(0, 30000, 30000)).toBe(0);
    expect(extraFor(30000, 5000, 30000)).toBe(5000);
    expect(extraFor(20000, 15000, 30000)).toBe(5000);
    expect(extraFor(40000, 1000, 30000)).toBe(1000);
  });

  it('feeds into safe to spend: the October example from the design', () => {
    const tx = (type: 'income' | 'expense', on: string, need: number, want: number): MoneyTx => ({
      type,
      amount_cents: need + want,
      need_cents: type === 'expense' ? need : 0,
      want_cents: type === 'expense' ? want : 0,
      occurred_on: on,
      category: 'x',
    });
    const txs = [tx('income', '2026-10-02', 272000, 0), tx('expense', '2026-10-03', 148392, 14588)];
    const base = { today: '2026-10-25', txs, expectedIncomeCents: 0, savingsGoalCents: 30000, recurring: [] };
    const planned = safeToSpend({ ...base, savingsMoves: { deposits: 30000, withdrawals: 0 } });
    expect(planned.amount).toBe(272000 - 148392 - 14588 - 30000);
    expect(planned.savings).toBe(30000);
    expect(planned.need).toBe(148392);
    const extra = safeToSpend({ ...base, savingsMoves: { deposits: 35000, withdrawals: 0 } });
    expect(extra.amount).toBe(planned.amount - 5000);
    expect(extra.savings).toBe(35000);
    const tookOut = safeToSpend({ ...base, savingsMoves: { deposits: 30000, withdrawals: 10000 } });
    expect(tookOut.amount).toBe(planned.amount + 10000);
    expect(tookOut.savings).toBe(20000);
  });
});

describe('when the goal is reached', () => {
  it('counts what is left of this month’s set-aside, then a set-aside each month', () => {
    // $420 saved, October's $300 already in: Nov 720, Dec 1,020, Jan 1,320.
    expect(arrivalMonth({ today: '2026-10-25', target: 120000, saved: 42000, setAside: 30000, depositedThisMonth: 30000 })).toBe('2027-01-01');
    // Starting from nothing on 1 November: Nov, Dec, Jan, Feb.
    expect(arrivalMonth({ today: '2026-11-01', target: 120000, saved: 0, setAside: 30000, depositedThisMonth: 0 })).toBe('2027-02-01');
  });

  it('is this month once saved, and unknown with nothing set aside', () => {
    expect(arrivalMonth({ today: '2026-10-25', target: 1000, saved: 1000, setAside: 0, depositedThisMonth: 0 })).toBe('2026-10-01');
    expect(arrivalMonth({ today: '2026-10-25', target: 120000, saved: 0, setAside: 0, depositedThisMonth: 0 })).toBeNull();
  });

  it('counts whole months between two days', () => {
    expect(monthsBetween('2026-09-20', '2027-02-01')).toBe(4);
    expect(monthsBetween('2026-10-01', '2026-10-20')).toBe(1);
  });
});

describe('new month check-in', () => {
  const base = { today: '2026-11-01', startedOn: '2026-09-20', setAside: 30000, answered: null };

  it("asks whether last month's set-aside went in", () => {
    expect(checkinDue({ ...base, deposits: [] })).toEqual({ month: '2026-10-01', amount: 30000, partial: false });
    expect(checkinDue({ ...base, deposits: [dep('2026-10-12', 10000)] })).toEqual({ month: '2026-10-01', amount: 20000, partial: true });
  });

  it('stays quiet once answered, when it all went in, or for a goal started this month', () => {
    expect(checkinDue({ ...base, deposits: [], answered: '2026-10' })).toBeNull();
    expect(checkinDue({ ...base, deposits: [dep('2026-10-01', 30000)] })).toBeNull();
    expect(checkinDue({ ...base, startedOn: '2026-11-01', deposits: [] })).toBeNull();
    expect(checkinDue({ ...base, setAside: 0, deposits: [] })).toBeNull();
  });
});
