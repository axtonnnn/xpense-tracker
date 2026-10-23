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

/** Base URL of the Cloudflare Worker. "demo" returns sample AI answers in development builds. */
export const API_URL = (extra.apiUrl ?? '').replace(/\/$/, '');
export const DEMO_AI = __DEV__ && API_URL === 'demo';

export const REVENUECAT_KEY =
  Platform.select({ ios: extra.revenueCatIosKey, android: extra.revenueCatAndroidKey }) ?? '';

export const PRIVACY_URL = extra.privacyUrl ?? '';
export const TERMS_URL = extra.termsUrl ?? '';

export const PRO_ENTITLEMENT = 'pro';
export const FREE_TRIAL_SCANS = 3;
