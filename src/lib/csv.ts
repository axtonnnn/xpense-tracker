// Turns entries into the CSV export. Pure, so it can be unit-tested (__tests__/csv.test.ts).
import type { Tx } from '@/db/transactions';
import { fromCents } from './money';

const COLUMNS = ['date', 'type', 'amount', 'needs', 'wants', 'currency', 'category', 'merchant', 'note', 'source'] as const;

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function cell(v: string | number | null): string {
  let s = v === null ? '' : String(v);
  // Merchants can come off a scanned receipt, so a text like =HYPERLINK(…) isn't always the person's own.
  // Spreadsheet apps run it as a formula even inside quotes; a leading ' makes it plain text.
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(txs: Tx[]): string {
  const rows = txs.map((t) =>
    [
      t.occurred_on,
      t.type,
      fromCents(t.amount_cents).toFixed(2),
      fromCents(t.need_cents).toFixed(2),
      fromCents(t.want_cents).toFixed(2),
      t.currency,
      t.category.replace(/^custom:/, ''),
      t.merchant,
      t.note,
      t.source,
    ]
      .map(cell)
      .join(','),
  );
  return [COLUMNS.join(','), ...rows].join('\n');
}
