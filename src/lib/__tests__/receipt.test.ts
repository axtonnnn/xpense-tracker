import { describe, expect, it } from '@jest/globals';

import type { ReceiptResult } from '../../../shared/schemas';
import { draftFromAI, draftWarnings, splitTotal, transactionCategory } from '../receipt';

const ai = (over: Partial<ReceiptResult> = {}): ReceiptResult => ({
  is_financial_document: true,
  doc_type: 'receipt',
  merchant: ' Corner Market ',
  date: '2026-10-20',
  due_date: null,
  currency: 'usd',
  subtotal: 30,
  tax: 3,
  tip: null,
  total: 33,
  category: 'groceries',
  necessity: 'need',
  items: [
    { name: 'Bread', quantity: 1, total_price: 20, category: 'groceries', necessity: 'need', reason: 'Staple' },
    { name: 'Candy', quantity: 1, total_price: 10, category: 'groceries', necessity: 'want', reason: 'Treat' },
  ],
  confidence: 'high',
  notes: null,
  ...over,
});

const ctx = { currency: 'USD', today: '2026-10-23' };

describe('draftFromAI', () => {
  it('converts to cents and tidies fields', () => {
    const d = draftFromAI(ai(), ctx);
    expect(d.merchant).toBe('Corner Market');
    expect(d.totalCents).toBe(3300);
    expect(d.items.map((i) => i.totalCents)).toEqual([2000, 1000]);
    expect(d.receiptCurrency).toBe('USD');
    expect(d.date).toBe('2026-10-20');
  });

  it('avoids floating-point drift on prices like 0.1 + 0.2', () => {
    const d = draftFromAI(ai({ total: 0.3, subtotal: null, tax: null, items: [] }), ctx);
    expect(d.totalCents).toBe(30);
  });

  it('falls back to today for missing, invalid or future dates', () => {
    expect(draftFromAI(ai({ date: null }), ctx).date).toBe('2026-10-23');
    expect(draftFromAI(ai({ date: '2026-02-30' }), ctx).date).toBe('2026-10-23');
    expect(draftFromAI(ai({ date: '2027-01-01' }), ctx).date).toBe('2026-10-23');
  });

  it('derives a total when the AI could not read one', () => {
    expect(draftFromAI(ai({ total: null }), ctx).totalCents).toBe(3300);
    expect(draftFromAI(ai({ total: null, subtotal: null, tax: null }), ctx).totalCents).toBe(3000);
  });
});

describe('splitTotal', () => {
  it('shares tax pro-rata so need + want equals the total', () => {
    const d = draftFromAI(ai(), ctx);
    const s = splitTotal(d);
    expect(s).toEqual({ need: 2200, want: 1100 });
    expect(s.need + s.want).toBe(d.totalCents);
  });

  it('handles discounts (negative lines) and odd cents', () => {
    const s = splitTotal({
      totalCents: 1001,
      necessity: 'need',
      items: [
        { totalCents: 700, necessity: 'need' },
        { totalCents: 400, necessity: 'want' },
        { totalCents: -100, necessity: 'want' },
      ],
    });
    expect(s.need + s.want).toBe(1001);
    expect(s.need).toBe(Math.round((1001 * 700) / 1000));
  });

  it('uses the document necessity when there are no items', () => {
    expect(splitTotal({ totalCents: 5000, necessity: 'need', items: [] })).toEqual({ need: 5000, want: 0 });
    expect(splitTotal({ totalCents: 5000, necessity: 'want', items: [] })).toEqual({ need: 0, want: 5000 });
  });
});

describe('transactionCategory', () => {
  it('picks the category with the most money', () => {
    const d = draftFromAI(
      ai({
        items: [
          { name: 'Shirt', quantity: 1, total_price: 25, category: 'shopping', necessity: 'want', reason: '' },
          { name: 'Milk', quantity: 1, total_price: 5, category: 'groceries', necessity: 'need', reason: '' },
        ],
      }),
      ctx,
    );
    expect(transactionCategory(d)).toBe('shopping');
  });
});

describe('draftWarnings', () => {
  it('is quiet for a clean receipt', () => {
    expect(draftWarnings(draftFromAI(ai(), ctx))).toEqual([]);
  });

  it('flags items that do not add up to the subtotal', () => {
    expect(draftWarnings(draftFromAI(ai({ subtotal: 45 }), ctx))).toContain('items_mismatch');
  });

  it('flags non-receipts, low confidence, foreign currency and missing totals', () => {
    const w = draftWarnings(
      draftFromAI(ai({ is_financial_document: false, confidence: 'low', currency: 'EUR', total: 0, subtotal: null, tax: null, items: [] }), ctx),
    );
    expect(w).toEqual(expect.arrayContaining(['not_receipt', 'low_confidence', 'currency_mismatch', 'no_total']));
  });
});
