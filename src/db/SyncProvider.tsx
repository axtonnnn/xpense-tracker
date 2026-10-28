import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { onChange } from './live';
import { pendingChanges, supabaseRemote, syncOnce } from './sync';
import { supabase } from '@/lib/supabase';

type SyncState = {
  /** 'local' = the preview account, which never syncs. */
  status: 'local' | 'syncing' | 'synced' | 'offline';
  lastSyncedAt: Date | null;
  /** True once the first sync after sign-in has finished (or failed), so a returning account's settings are in. */
  ready: boolean;
  syncNow: () => Promise<boolean>;
  pending: () => Promise<number>;
};

const SyncContext = createContext<SyncState | null>(null);

const AFTER_CHANGE_MS = 2500;
const EVERY_MS = 60_000;
/** How long the first sync may hold the app back before it opens with what's on the device. */
const FIRST_SYNC_WAIT_MS = 8000;

export function SyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const db = useSQLiteContext();
  const local = !supabase || userId === 'preview';
  const [status, setStatus] = useState<SyncState['status']>(local ? 'local' : 'syncing');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [ready, setReady] = useState(local);
  const running = useRef<Promise<boolean> | null>(null);
  const again = useRef(false);

  const syncNow = useCallback((): Promise<boolean> => {
    if (local || !supabase) return Promise.resolve(true);
    if (running.current) {
      // A change landed mid-sync: go round once more when this run ends.
      again.current = true;
      return running.current;
    }
    const remote = supabaseRemote(supabase, userId);
    const run = (async () => {
      let ok = true;
      try {
        do {
          again.current = false;
          setStatus('syncing');
          await syncOnce(db, remote);
          setLastSyncedAt(new Date());
          setStatus('synced');
        } while (again.current);
      } catch (e) {
        console.warn('[sync]', e);
        setStatus('offline');
        ok = false;
      } finally {
        setReady(true);
        running.current = null;
      }
      return ok;
    })();
    running.current = run;
    return run;
  }, [db, local, userId]);

  useEffect(() => {
    if (local) return;
    void syncNow();
    const giveUp = setTimeout(() => setReady(true), FIRST_SYNC_WAIT_MS);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), AFTER_CHANGE_MS);
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => {
      clearTimeout(giveUp);
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      sub.remove();
    };
  }, [local, syncNow]);

  const pending = useCallback(() => (local ? Promise.resolve(0) : pendingChanges(db)), [db, local]);

  const value = useMemo(() => ({ status, lastSyncedAt, ready, syncNow, pending }), [status, lastSyncedAt, ready, syncNow, pending]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}

export type PullToSync = { refreshing: boolean; onRefresh: () => void };

/** Pull down to sync now, for a screen's scroll view. Nothing for the preview account, which never syncs. */
export function usePullToSync(): PullToSync | undefined {
  const { status, syncNow } = useSync();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void syncNow().finally(() => setRefreshing(false));
  }, [syncNow]);
  return status === 'local' ? undefined : { refreshing, onRefresh };
}
