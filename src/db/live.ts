import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// A tiny change feed: every write in src/db calls notifyChange(), and live queries re-run.
// Simpler and more portable (web included) than SQLite update hooks.
type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyChange(): void {
  listeners.forEach((l) => l());
}

/**
 * Runs `query` now and again after every write. `deps` are the values the query closes over
 * (e.g. a date range); the query re-runs when they change.
 */
export function useLiveQuery<T>(
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[],
): { data: T | undefined; error: Error | null } {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const queryRef = useRef(query);
  useLayoutEffect(() => {
    queryRef.current = query;
  });
  const key = JSON.stringify(deps);

  useEffect(() => {
    let latest = 0;
    let active = true;
    const run = () => {
      const id = ++latest;
      queryRef
        .current(db)
        .then((result) => {
          if (active && id === latest) {
            setData(result);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (active && id === latest) setError(e instanceof Error ? e : new Error(String(e)));
        });
    };
    run();
    listeners.add(run);
    return () => {
      active = false;
      listeners.delete(run);
    };
  }, [db, key]);

  return { data, error };
}
