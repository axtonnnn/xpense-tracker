// The real pull against a stand-in for Supabase's query builder, paging through more than one page
// while another device keeps writing.
import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseRemote, type RemoteRecord } from '../sync';

jest.mock('@/lib/files', () => ({ deleteReceiptImage: jest.fn() }));

type Row = RemoteRecord & { user_id: string; synced_at: string };

/** Just the parts of PostgREST that sync uses, over an in-memory `records` table. */
function fakeClient(rows: Map<string, Row>, onQuery: (n: number) => void = () => {}) {
  let queries = 0;
  const from = () => {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: string[] = [];
    let offset = 0;
    let limit = Infinity;
    const run = () => {
      onQuery(++queries);
      const data = [...rows.values()]
        .filter((r) => filters.every((f) => f(r)))
        .sort((a, b) => {
          for (const col of orders) {
            const x = String(a[col as keyof Row]);
            const y = String(b[col as keyof Row]);
            if (x !== y) return x < y ? -1 : 1;
          }
          return 0;
        })
        .slice(offset, offset + limit)
        .map(({ user_id: _, ...r }) => ({ ...r }));
      return { data, error: null };
    };
    const q = {
      select: () => q,
      eq: (col: keyof Row, v: string) => (filters.push((r) => r[col] === v), q),
      gt: (col: keyof Row, v: string) => (filters.push((r) => String(r[col]) > v), q),
      gte: (col: keyof Row, v: string) => (filters.push((r) => String(r[col]) >= v), q),
      order: (col: string) => (orders.push(col), q),
      range: (a: number, b: number) => ((offset = a), (limit = b - a + 1), q),
      limit: (n: number) => ((limit = n), q),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

let clock = Date.parse('2026-10-01T00:00:00Z');
const stamp = () => new Date((clock += 1000)).toISOString();

function record(id: string, user = 'me'): Row {
  const at = stamp();
  return { user_id: user, kind: 'transaction', id, data: { id }, deleted: false, updated_at: at, synced_at: at };
}

describe('supabaseRemote.pull', () => {
  it('gets every record when another device changes one while the pages come in', async () => {
    const rows = new Map<string, Row>();
    for (let i = 0; i < 2500; i++) rows.set(`tx-${i}`, record(`tx-${i}`));
    rows.set('theirs', record('theirs', 'someone-else'));
    // Between the first and second page, the phone edits an entry the tablet has already pulled.
    const client = fakeClient(rows, (n) => {
      if (n === 2) rows.set('tx-5', { ...record('tx-5'), data: { id: 'tx-5', edited: true } });
    });

    const pulled = await supabaseRemote(client, 'me').pull(null);

    const ids = new Set(pulled.map((r) => r.id));
    expect(ids.size).toBe(2500);
    expect(ids.has('theirs')).toBe(false);
    expect(pulled.find((r) => r.id === 'tx-5' && (r.data as { edited?: boolean }).edited)).toBeTruthy();
  });

  it('only asks for what changed since the cursor, and stops on a short page', async () => {
    const rows = new Map<string, Row>();
    for (let i = 0; i < 10; i++) rows.set(`tx-${i}`, record(`tx-${i}`));
    const since = rows.get('tx-6')!.synced_at;
    let queries = 0;
    const pulled = await supabaseRemote(fakeClient(rows, (n) => (queries = n)), 'me').pull(since);
    expect(pulled.map((r) => r.id)).toEqual(['tx-7', 'tx-8', 'tx-9']);
    expect(queries).toBe(1);
  });

  it('does not lose records that share a timestamp across a page boundary', async () => {
    const rows = new Map<string, Row>();
    for (let i = 0; i < 998; i++) rows.set(`a-${i}`, record(`a-${i}`));
    const same = stamp();
    for (let i = 0; i < 5; i++) rows.set(`b-${i}`, { ...record(`b-${i}`), synced_at: same });
    const pulled = await supabaseRemote(fakeClient(rows), 'me').pull(null);
    expect(new Set(pulled.map((r) => r.id)).size).toBe(1003);
  });
});
