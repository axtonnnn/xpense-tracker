import { describe, expect, it } from '@jest/globals';

import { matchesEntry, type SearchableEntry } from '../history-search';
import { formatFigure } from '../money';

const entry = (over: Partial<SearchableEntry> = {}): SearchableEntry => ({
  type: 'expense',
  amount_cents: 148392,
  need_cents: 148392,
  want_cents: 0,
  currency: 'USD',
  merchant: 'Corner Shop',
  note: 'weekly shop',
  ...over,
});

describe('matchesEntry', () => {
  it('finds an amount as the list shows it, with grouping', () => {
    const shown = formatFigure(148392, 'USD'); // "1,483.92" in en-US
    expect(matchesEntry(entry(), 'all', shown, 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'all', shown.slice(0, 5), 'Groceries')).toBe(true);
  });

  it('finds a yen amount as shown, without the cents it never displays', () => {
    const yen = entry({ currency: 'JPY', amount_cents: 120000, need_cents: 120000 });
    expect(matchesEntry(yen, 'all', formatFigure(120000, 'JPY'), 'Groceries')).toBe(true);
    expect(matchesEntry(yen, 'all', '1200', 'Groceries')).toBe(true);
  });

  it('still finds a plainly typed amount', () => {
    expect(matchesEntry(entry(), 'all', '1483.92', 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'all', '1483', 'Groceries')).toBe(true);
  });

  it('matches shop, note and category without caring about case or spaces around the query', () => {
    expect(matchesEntry(entry(), 'all', '  corner ', 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'all', 'WEEKLY', 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'all', 'grocer', 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'all', 'cinema', 'Groceries')).toBe(false);
  });

  it('applies the filter chips before the search', () => {
    expect(matchesEntry(entry(), 'income', '', 'Groceries')).toBe(false);
    expect(matchesEntry(entry(), 'need', '', 'Groceries')).toBe(true);
    expect(matchesEntry(entry(), 'want', '', 'Groceries')).toBe(false);
    expect(matchesEntry(entry({ type: 'income', need_cents: 0 }), 'income', 'corner', 'Paycheck')).toBe(true);
  });
});
