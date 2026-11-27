import { describe, expect, it } from '@jest/globals';

import { safeToSpend } from '../budget';
import { formatMoney, splitMoney } from '../money';
import { splitTotal } from '../receipt';

// ¥100,000 to spend with 3 days of the month left: about ¥33,333.33 a day, i.e. 3333333 "cents", not a whole yen.
const budgetPerDayFixture = safeToSpend({
  today: '2026-11-28',
  txs: [],
  expectedIncomeCents: 10_000_000,
  savingsGoalCents: 0,
  recurring: [],
}).perDay;

describe('formatMoney keeps each currency’s own decimals', () => {
  it('shows yen without decimals, even for amounts that are not whole yen', () => {
    expect(budgetPerDayFixture).toBe(3333333);
    expect(formatMoney(budgetPerDayFixture, 'JPY')).not.toMatch(/[.,]33$/);
    expect(formatMoney(budgetPerDayFixture, 'JPY')).toMatch(/33,333$/);
    const { need, want } = splitTotal({
      totalCents: 100000,
      necessity: 'want',
      items: [
        { totalCents: 30000, necessity: 'need' },
        { totalCents: 40000, necessity: 'want' },
      ],
    });
    expect(formatMoney(need, 'JPY')).toMatch(/429$/);
    expect(formatMoney(want, 'JPY')).toMatch(/571$/);
  });

  it('gives the yen hero amount no fraction', () => {
    expect(splitMoney(budgetPerDayFixture, 'JPY')).toMatchObject({ whole: '33,333', fraction: '' });
  });

  it('still shows cents for dollars and euros', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(500, 'USD')).toBe('$5.00');
    expect(formatMoney(123456, 'EUR')).toMatch(/1,234\.56/);
    expect(splitMoney(72820, 'USD')).toMatchObject({ symbol: '$', whole: '728', fraction: '.20' });
  });

  it('keeps compact amounts whole', () => {
    expect(formatMoney(123456, 'USD', { compact: true })).toBe('$1,235');
  });
});
