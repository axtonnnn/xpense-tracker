// Which entries the History search and filter chips keep. Pure so it can be unit-tested.
import { formatFigure } from './money';

export type HistoryFilter = 'all' | 'expense' | 'income' | 'need' | 'want';

export type SearchableEntry = {
  type: 'expense' | 'income';
  amount_cents: number;
  need_cents: number;
  want_cents: number;
  currency: string;
  merchant: string | null;
  note: string | null;
};

/**
 * True when an entry passes the filter and its shop, note, category or amount contains the query.
 * The amount is matched both as typed plainly ("1483.92") and as the list shows it ("1,483.92",
 * or "1,200" for yen), so searching for a figure copied off the screen finds it.
 */
export function matchesEntry(tx: SearchableEntry, filter: HistoryFilter, query: string, categoryLabel: string): boolean {
  if (filter === 'expense' && tx.type !== 'expense') return false;
  if (filter === 'income' && tx.type !== 'income') return false;
  if (filter === 'need' && (tx.type !== 'expense' || tx.need_cents <= 0)) return false;
  if (filter === 'want' && (tx.type !== 'expense' || tx.want_cents <= 0)) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const plain = (tx.amount_cents / 100).toFixed(2);
  const shown = formatFigure(tx.amount_cents, tx.currency);
  const hay = `${tx.merchant ?? ''} ${tx.note ?? ''} ${categoryLabel} ${plain} ${shown}`.toLowerCase();
  return hay.includes(q);
}
