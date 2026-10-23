import { describe, expect, it } from '@jest/globals';

import { categorize } from '../categorize';
import { niceTicks, roundedTopBar } from '../chart';
import { addMonths, isValidISODate, startOfWeek } from '../dates';
import { parseAmount } from '../money';
import { dueOccurrences, monthlyEquivalent, upcomingOccurrences, type RecurringRule } from '../recurring';

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['1,234.56', 123456],
    ['12,50', 1250],
    ['1.234,56', 123456],
    ['$ 9.99', 999],
    ['0.1', 10],
  ])('%s → %i cents', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it('rejects empty or junk input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('dates', () => {
  it('clamps month ends and keeps the anchor day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('validates real calendar dates only', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19'); // Monday
  });
});

describe('categorize', () => {
  it.each([
    ['Trader Joe’s', 'groceries', 'need'],
    ['Uber Eats order', 'dining', 'want'],
    ['Uber to work', 'transport', 'need'],
    ['Netflix', 'subscriptions', 'want'],
    ['Monthly rent', 'housing', 'need'],
    ['Gas bill', 'utilities', 'need'],
    ['Shell gas station', 'transport', 'need'],
    ['CVS pharmacy', 'health', 'need'],
  ])('%s → %s (%s)', (text, category, necessity) => {
    expect(categorize(text)).toEqual({ category, necessity });
  });

  it('returns null when unsure', () => {
    expect(categorize('Bob')).toBeNull();
    expect(categorize('  ')).toBeNull();
  });
});

describe('recurring', () => {
  const rule = (over: Partial<RecurringRule>): RecurringRule => ({
    id: 'x',
    type: 'expense',
    amount_cents: 1000,
    cadence: 'monthly',
    anchor_on: '2026-01-31',
    next_on: '2026-01-31',
    active: 1,
    ...over,
  });

  it('books every missed occurrence and advances next date', () => {
    const r = dueOccurrences(rule({}), '2026-04-15');
    expect(r.dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(r.nextOn).toBe('2026-04-30');
  });

  it('handles weekly and biweekly cadences', () => {
    expect(dueOccurrences(rule({ cadence: 'weekly', next_on: '2026-10-01', anchor_on: '2026-10-01' }), '2026-10-22').dates).toHaveLength(4);
    expect(dueOccurrences(rule({ cadence: 'biweekly', next_on: '2026-10-01', anchor_on: '2026-10-01' }), '2026-10-22').nextOn).toBe('2026-10-29');
  });

  it('ignores paused rules', () => {
    expect(dueOccurrences(rule({ active: 0 }), '2026-12-31').dates).toEqual([]);
  });

  it('lists bills still to come this month', () => {
    const r = rule({ cadence: 'weekly', next_on: '2026-10-23', anchor_on: '2026-10-02' });
    expect(upcomingOccurrences(r, '2026-10-23', '2026-10-31')).toEqual(['2026-10-30']);
  });

  it('converts cadences to a monthly equivalent', () => {
    expect(monthlyEquivalent({ amount_cents: 1200, cadence: 'weekly' })).toBe(5200);
    expect(monthlyEquivalent({ amount_cents: 1200, cadence: 'biweekly' })).toBe(2600);
  });
});

describe('chart helpers', () => {
  it('chooses clean ticks that cover the max', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(95000)).toEqual([0, 50000, 100000]);
    expect(niceTicks(240000)).toEqual([0, 100000, 200000, 300000]);
    const t = niceTicks(123456);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(123456);
  });

  it('draws nothing for empty bars and clamps the corner radius', () => {
    expect(roundedTopBar(0, 0, 10, 0)).toBe('');
    expect(roundedTopBar(0, 10, 10, 2)).toContain('Q0,10 2,10');
  });
});
