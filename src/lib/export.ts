import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Tx } from '@/db/transactions';
import { toCSV } from './csv';
import { writeCacheFile } from './files';

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
