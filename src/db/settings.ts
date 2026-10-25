import type { SQLiteDatabase } from 'expo-sqlite';

import { nowISO } from './ids';
import { useLiveQuery, notifyChange } from './live';
import { inTransaction } from './tx';
import { parseCustomCategories, type CustomCategory } from '@/lib/categories';

export type Settings = {
  onboarded: boolean;
  /** What to call the person ("Sunday morning, Sam"). */
  name: string;
  /** What they're saving up for, in their words, e.g. "a car" or "moving out". */
  savingFor: string;
  currency: string;
  monthlyIncomeCents: number;
  savingsGoalCents: number;
  hoursPerWeek: number;
  aiConsent: boolean;
  appLock: boolean;
  customCategories: CustomCategory[];
  devPro: boolean;
  /** Last trial count the AI server reported; null until the first scan. */
  trialRemaining: number | null;
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  savingFor: '',
  currency: 'USD',
  monthlyIncomeCents: 0,
  savingsGoalCents: 0,
  hoursPerWeek: 40,
  aiConsent: false,
  appLock: false,
  customCategories: [],
  devPro: false,
  trialRemaining: null,
};

type Key =
  | 'onboarded'
  | 'name'
  | 'saving_for'
  | 'currency'
  | 'monthly_income_cents'
  | 'savings_goal_cents'
  | 'hours_per_week'
  | 'ai_consent'
  | 'app_lock'
  | 'custom_categories'
  | 'dev_pro'
  | 'trial_remaining'
  | 'review_asked';

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: Key; value: string }>('SELECT key, value FROM settings');
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: Key, d: number) => {
    const n = Number(m.get(k));
    return m.has(k) && Number.isFinite(n) ? n : d;
  };
  const bool = (k: Key, d: boolean) => (m.has(k) ? m.get(k) === '1' : d);
  return {
    onboarded: bool('onboarded', DEFAULT_SETTINGS.onboarded),
    name: m.get('name') ?? '',
    savingFor: m.get('saving_for') ?? '',
    currency: m.get('currency') ?? DEFAULT_SETTINGS.currency,
    monthlyIncomeCents: num('monthly_income_cents', 0),
    savingsGoalCents: num('savings_goal_cents', 0),
    hoursPerWeek: num('hours_per_week', DEFAULT_SETTINGS.hoursPerWeek),
    aiConsent: bool('ai_consent', false),
    appLock: bool('app_lock', false),
    customCategories: parseCustomCategories(m.get('custom_categories')),
    devPro: bool('dev_pro', false),
    trialRemaining: m.has('trial_remaining') ? num('trial_remaining', 0) : null,
  };
}

/** Settings that belong to this device, not the account: they never sync. */
export const DEVICE_SETTINGS: Key[] = ['ai_consent', 'app_lock', 'dev_pro', 'trial_remaining', 'review_asked'];

export async function setSettings(
  db: SQLiteDatabase,
  values: Partial<Record<Key, string | number | boolean>>,
): Promise<void> {
  const now = nowISO();
  await inTransaction(db, async () => {
    for (const [key, raw] of Object.entries(values)) {
      if (raw === undefined) continue;
      const value = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 1`,
        key,
        value,
        now,
      );
    }
  });
  notifyChange();
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []).data;
}
