// Accounts: Sign in with Apple (iPhone, iPad and Mac) and a 6-digit email code (every device).
// Signing in is required; each account gets its own database on the device, synced through Supabase.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { PREVIEW_ACCOUNT } from './config';
import { supabase } from './supabase';

export type AuthUser = {
  id: string;
  email: string | null;
  /** First name from Apple on first sign-in, or what the person typed during onboarding. */
  name: string | null;
  provider: 'apple' | 'email' | 'preview';
};

type AuthState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: AuthUser | null;
  appleAvailable: boolean;
  signInWithApple: () => Promise<boolean>;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Development builds without Supabase only: a local, unsynced account to try the app with. */
  signInPreview: (() => void) | null;
  signOut: () => Promise<void>;
};

export class AuthError extends Error {}

const PREVIEW_KEY = 'xpense.preview_account';
const PREVIEW_USER: AuthUser = { id: 'preview', email: null, name: null, provider: 'preview' };

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { given_name?: string; full_name?: string };
  const name = meta.given_name || meta.full_name?.split(' ')[0] || null;
  return { id: u.id, email: u.email ?? null, name, provider: u.app_metadata?.provider === 'apple' ? 'apple' : 'email' };
}

/** The current access token for calls to the Xpense AI server, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const AuthContext = createContext<AuthState | null>(null);

/** Supabase answers with technical messages; these are the ones people actually run into. */
function friendly(message: string, step: 'email' | 'code' | 'apple'): string {
  const m = message.toLowerCase();
  if (m.includes('rate') || m.includes('seconds')) return 'Too many tries. Please wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Couldn’t connect. Check your internet and try again.';
  if (step === 'code' && (m.includes('expired') || m.includes('invalid') || m.includes('token'))) return 'That code didn’t work. Check it, or ask for a new one.';
  if (step === 'email' && (m.includes('invalid') || m.includes('format'))) return 'Check the email address and try again.';
  if (step === 'apple') return 'Sign in with Apple didn’t work. Please try again.';
  return message;
}

/** Without Supabase (development only), whether the preview account was opened before. */
function previewRemembered(): boolean {
  try {
    return PREVIEW_ACCOUNT && globalThis.localStorage?.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>(() => (supabase ? 'loading' : previewRemembered() ? 'signed-in' : 'signed-out'));
  const [user, setUser] = useState<AuthUser | null>(() => (!supabase && previewRemembered() ? PREVIEW_USER : null));
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const apply = (session: Session | null) => {
      const next = toUser(session);
      // Keep the same object while the account doesn't change, so token refreshes don't re-render the app.
      setUser((cur) => (cur && next && cur.id === next.id && cur.name === next.name && cur.email === next.email ? cur : next));
      setStatus(next ? 'signed-in' : 'signed-out');
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session), () => apply(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!supabase) throw new AuthError('Sign-in isn’t set up in this build yet.');
    // Apple signs a hash of this random value into the identity token; Supabase checks it against the original.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
      throw new AuthError('Sign in with Apple didn’t work. Please try again.');
    }
    if (!credential.identityToken) throw new AuthError('Apple didn’t return a sign-in token. Please try again.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) throw new AuthError(friendly(error.message, 'apple'));
    // Apple shares the name only on the very first sign-in, so keep it on the account.
    const given = credential.fullName?.givenName;
    if (given) {
      const full = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
      await supabase.auth.updateUser({ data: { given_name: given, full_name: full } }).catch(() => undefined);
    }
    return true;
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    if (!supabase) throw new AuthError('Sign-in isn’t set up in this build yet.');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    if (error) throw new AuthError(friendly(error.message, 'email'));
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    if (!supabase) throw new AuthError('Sign-in isn’t set up in this build yet.');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error) throw new AuthError(friendly(error.message, 'code'));
  }, []);

  const signInPreview = useMemo(
    () =>
      PREVIEW_ACCOUNT
        ? () => {
            try {
              globalThis.localStorage?.setItem(PREVIEW_KEY, '1');
            } catch {
              // Private browsing: the preview just won't be remembered.
            }
            setUser(PREVIEW_USER);
            setStatus('signed-in');
          }
        : null,
    [],
  );

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    try {
      globalThis.localStorage?.removeItem(PREVIEW_KEY);
    } catch {
      // Nothing stored.
    }
    setUser(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ status, user, appleAvailable, signInWithApple, sendEmailCode, verifyEmailCode, signInPreview, signOut }),
    [status, user, appleAvailable, signInWithApple, sendEmailCode, verifyEmailCode, signInPreview, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in account. Only call this below the signed-in part of the app. */
export function useUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useUser needs a signed-in account');
  return user;
}

/** Each account keeps its own database file, so two people on one device never see each other's money. */
export function databaseNameFor(userId: string): string {
  return `xpense-${userId.replace(/[^a-zA-Z0-9-]/g, '')}.db`;
}
