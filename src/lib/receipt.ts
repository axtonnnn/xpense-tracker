// Turns Claude's receipt reading into an editable draft (in cents) and derives the need/want split.
import type { ExpenseCategory, Necessity, ReceiptResult } from '../../shared/schemas';
import { isValidISODate } from './dates';
import { toCents } from './money';

export type DraftItem = {
  key: string;
  name: string;
  qty: number | null;
  totalCents: number;
  category: string;
  necessity: Necessity;
  reason: string | null;
};

export type ReceiptDraft = {
  isFinancialDocument: boolean;
  docType: 'receipt' | 'bill' | 'invoice' | 'other';
  merchant: string;
  date: string;
  dueDate: string | null;
  currency: string;
  receiptCurrency: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  totalCents: number;
  category: ExpenseCategory | string;
  necessity: Necessity;
  items: DraftItem[];
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
};

export type DraftWarning = 'not_receipt' | 'low_confidence' | 'items_mismatch' | 'currency_mismatch' | 'no_total';

const nullableCents = (n: number | null) => (n === null || !Number.isFinite(n) ? null : toCents(n));

export function draftFromAI(result: ReceiptResult, ctx: { currency: string; today: string }): ReceiptDraft {
  const items: DraftItem[] = result.items.map((it, i) => ({
    key: `ai-${i}`,
    name: it.name.trim() || `Item ${i + 1}`,
    qty: it.quantity,
    totalCents: toCents(it.total_price),
    category: it.category,
    necessity: it.necessity,
    reason: it.reason || null,
  }));
  const subtotalCents = nullableCents(result.subtotal);
  const taxCents = nullableCents(result.tax);
  const tipCents = nullableCents(result.tip);
  const itemsSum = items.reduce((s, it) => s + it.totalCents, 0);
  const totalCents =
    nullableCents(result.total) ??
    (subtotalCents !== null ? subtotalCents + (taxCents ?? 0) + (tipCents ?? 0) : itemsSum);
  const receiptCurrency = result.currency && /^[A-Za-z]{3}$/.test(result.currency) ? result.currency.toUpperCase() : null;

  return {
    isFinancialDocument: result.is_financial_document,
    docType: result.doc_type,
    merchant: result.merchant?.trim() ?? '',
    date: result.date && isValidISODate(result.date) && result.date <= ctx.today ? result.date : ctx.today,
    dueDate: result.due_date && isValidISODate(result.due_date) ? result.due_date : null,
    currency: ctx.currency,
    receiptCurrency,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
    category: result.category,
    necessity: result.necessity,
    items,
    confidence: result.confidence,
    notes: result.notes?.trim() || null,
  };
}

/**
 * Splits the total into need and want. Tax, tip, fees and discounts (total − items) are shared
 * pro-rata with the items, so need + want always equals the total.
 */
export function splitTotal(d: {
  totalCents: number;
  necessity: Necessity;
  items: { totalCents: number; necessity: Necessity }[];
}): { need: number; want: number } {
  let needSum = 0;
  let wantSum = 0;
  for (const it of d.items) {
    if (it.necessity === 'need') needSum += it.totalCents;
    else wantSum += it.totalCents;
  }
  needSum = Math.max(0, needSum);
  wantSum = Math.max(0, wantSum);
  const itemsSum = needSum + wantSum;
  if (itemsSum <= 0) {
    return d.necessity === 'need' ? { need: d.totalCents, want: 0 } : { need: 0, want: d.totalCents };
  }
  const need = Math.min(d.totalCents, Math.max(0, Math.round((d.totalCents * needSum) / itemsSum)));
  return { need, want: d.totalCents - need };
}

/** The category with the most money on the receipt, falling back to the document's own category. */
export function transactionCategory(d: Pick<ReceiptDraft, 'items' | 'category'>): string {
  const byCat = new Map<string, number>();
  for (const it of d.items) byCat.set(it.category, (byCat.get(it.category) ?? 0) + it.totalCents);
  let best: string | null = null;
  let bestSum = 0;
  for (const [cat, sum] of byCat) {
    if (sum > bestSum) {
      best = cat;
      bestSum = sum;
    }
  }
  return best ?? d.category;
}

export function itemsTotal(d: Pick<ReceiptDraft, 'items'>): number {
  return d.items.reduce((s, it) => s + it.totalCents, 0);
}

export function draftWarnings(d: ReceiptDraft): DraftWarning[] {
  const w: DraftWarning[] = [];
  if (!d.isFinancialDocument) w.push('not_receipt');
  if (d.confidence === 'low') w.push('low_confidence');
  if (d.totalCents <= 0) w.push('no_total');
  if (d.receiptCurrency && d.receiptCurrency !== d.currency) w.push('currency_mismatch');
  if (d.items.length > 0) {
    const sum = itemsTotal(d);
    const expected = d.subtotalCents ?? d.totalCents - (d.taxCents ?? 0) - (d.tipCents ?? 0);
    const tolerance = Math.max(5, Math.round(Math.abs(expected) * 0.02));
    if (Math.abs(sum - expected) > tolerance) w.push('items_mismatch');
  }
  return w;
}

export const WARNING_TEXT: Record<DraftWarning, string> = {
  not_receipt: "This doesn't look like a receipt or bill. Check the details before saving.",
  low_confidence: 'The photo was hard to read. Please double-check the amounts.',
  items_mismatch: "The items don't add up to the subtotal. Some lines may be missing or misread.",
  currency_mismatch: 'This receipt uses a different currency. Amounts are saved as shown.',
  no_total: 'No total was found. Enter the total before saving.',
};
