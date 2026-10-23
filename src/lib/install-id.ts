import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// A random, anonymous ID for this install. It doubles as the RevenueCat app user ID and the key
// the AI server uses for trial and fair-use counters. No name, email or account is ever collected.
const KEY = 'xpense.install_id';
let cached: string | null = null;

export async function getInstallId(): Promise<string> {
  if (cached) return cached;
  let id: string | null = null;
  if (Platform.OS === 'web') {
    try {
      id = globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      id = null;
    }
  } else {
    id = await SecureStore.getItemAsync(KEY);
  }
  if (!id) {
    id = Crypto.randomUUID();
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(KEY, id);
      } catch {
        // Private browsing: the ID just won't persist.
      }
    } else {
      await SecureStore.setItemAsync(KEY, id);
    }
  }
  cached = id;
  return id;
}
