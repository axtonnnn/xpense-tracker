import { describe, expect, it } from '@jest/globals';

import type { Tx } from '@/db/transactions';
import { toCSV } from '../csv';

const tx = (over: Partial<Tx> = {}): Tx => ({
  id: 't1',
  type: 'expense',
  amount_cents: 1250,
  need_cents: 1250,
  want_cents: 0,
  currency: 'USD',
  merchant: 'Corner Shop',
  note: null,
  category: 'groceries',
  occurred_on: '2026-10-31',
  source: 'manual',
  receipt_id: null,
  recurring_id: null,
  created_at: '',
  updated_at: '',
  ...over,
});

const row = (over: Partial<Tx>) => toCSV([tx(over)]).split('\n').slice(1).join('\n');

describe('toCSV', () => {
  it('writes a header and one line per entry', () => {
    expect(toCSV([tx()])).toBe(
      'date,type,amount,needs,wants,currency,category,merchant,note,source\n2026-10-31,expense,12.50,12.50,0.00,USD,groceries,Corner Shop,,manual',
    );
  });

  it('drops the prefix of a custom category', () => {
    expect(row({ category: 'custom:pets' })).toContain(',USD,pets,');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(row({ merchant: 'Shop, "The"', note: 'a\nb' })).toContain(',"Shop, ""The""","a\nb",manual');
  });

  it.each(['=HYPERLINK("http://x.test","y")', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1'])('keeps %j from running as a formula', (merchant) => {
    const out = row({ merchant });
    // The field, once any CSV quoting is removed, must start with the apostrophe.
    expect(out.split(',USD,groceries,')[1].replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('applies the same to notes', () => {
    expect(row({ note: '=1+1' })).toContain(",'=1+1,");
  });

  it('leaves ordinary text and plain numbers alone', () => {
    expect(row({ merchant: 'A=B Café' })).toContain(',A=B Café,');
    expect(row({ note: '-12.50' })).toContain(',-12.50,');
  });
});
