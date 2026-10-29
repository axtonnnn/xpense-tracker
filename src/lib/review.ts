import type { SQLiteDatabase } from 'expo-sqlite';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

import { setSettings } from '@/db/settings';

/** Ask for an App Store / Play rating once, right after the third saved scan (a moment of success). */
export async function maybeAskForReview(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await db.getFirstAsync("SELECT 1 FROM settings WHERE key = 'review_asked'")) return;
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM receipts');
    if ((row?.n ?? 0) < 3 || !(await StoreReview.hasAction())) return;
    await setSettings(db, { review_asked: true });
    await StoreReview.requestReview();
  } catch {
    // A rating prompt is never worth an error message.
  }
}
