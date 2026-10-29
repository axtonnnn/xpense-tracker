import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
  privacyUrl?: string;
  termsUrl?: string;
  supportUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Base URL of the Cloudflare Worker, from app.json (or EXPO_PUBLIC_API_URL in a local .env).
 * "demo" returns sample AI answers in development builds, so the app can be tried before deploying.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || '').replace(/\/$/, '');
export const DEMO_AI = __DEV__ && API_URL === 'demo';

export const REVENUECAT_KEY =
  Platform.select({ ios: extra.revenueCatIosKey, android: extra.revenueCatAndroidKey }) ?? '';

/** Apple's standard EULA. App Review accepts it as the Terms of Use when an app has no custom terms. */
const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// The deployed AI server also hosts the privacy policy, terms and support pages (worker/src/pages.ts),
// so these only need setting in app.json to point somewhere else.
const SERVER = /^https:\/\//.test(API_URL) ? API_URL : '';
export const PRIVACY_URL = extra.privacyUrl || (SERVER && `${SERVER}/privacy`);
export const TERMS_URL = extra.termsUrl || (SERVER ? `${SERVER}/terms` : Platform.OS === 'ios' ? APPLE_STANDARD_EULA : '');
export const SUPPORT_URL = extra.supportUrl || (SERVER && `${SERVER}/support`);

/**
 * Accounts and sync run on Supabase: the project URL and its publishable (anon) key, from app.json
 * (or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY in a local .env). The publishable key is
 * safe to ship in the app; row-level security keeps each account's data to itself.
 */
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '').replace(/\/$/, '');
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || extra.supabaseKey || '';
export const ACCOUNTS_READY = /^https:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
/** Development builds without Supabase can be tried with a local, unsynced preview account. */
export const PREVIEW_ACCOUNT = __DEV__ && !ACCOUNTS_READY;

export const PRO_ENTITLEMENT = 'pro';
// Shown in the app's copy; keep them equal to FREE_TRIAL_SCANS and PRO_MONTHLY_SCANS in worker/wrangler.toml.
export const FREE_TRIAL_SCANS = 3;
export const PRO_MONTHLY_SCANS = 300;
