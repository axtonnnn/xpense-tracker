import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Tx } from '@/db/transactions';
import { writeCacheFile } from './files';
import { fromCents } from './money';

const COLUMNS = ['date', 'type', 'amount', 'needs', 'wants', 'currency', 'category', 'merchant', 'note', 'source'] as const;

function cell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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

export async function shareCSV(txs: Tx[], fileName: string): Promise<void> {
  const csv = toCSV(txs);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const uri = writeCacheFile(fileName, csv);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions', UTI: 'public.comma-separated-values-text' });
}
