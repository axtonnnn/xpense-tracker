import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  apiUrl?: string;
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

export const PRO_ENTITLEMENT = 'pro';
// Shown in the app's copy; keep them equal to FREE_TRIAL_SCANS and PRO_MONTHLY_SCANS in worker/wrangler.toml.
export const FREE_TRIAL_SCANS = 3;
export const PRO_MONTHLY_SCANS = 300;
