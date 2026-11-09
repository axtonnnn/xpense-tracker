// The Supabase client: accounts (Sign in with Apple, email codes) and the synced copy of each account's data.
// The session lives in a small SQLite key-value store on the device (expo-sqlite's localStorage).
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ACCOUNTS_READY, SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase: SupabaseClient | null = ACCOUNTS_READY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: globalThis.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Native apps refresh the session only while in the foreground (browsers handle this themselves).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
