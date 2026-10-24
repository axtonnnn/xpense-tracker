import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  apiUrl?: string;
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
  privacyUrl?: string;
  termsUrl?: string;
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

export const PRIVACY_URL = extra.privacyUrl ?? '';
export const TERMS_URL = extra.termsUrl || (Platform.OS === 'ios' ? APPLE_STANDARD_EULA : '');

export const PRO_ENTITLEMENT = 'pro';
export const FREE_TRIAL_SCANS = 3;
