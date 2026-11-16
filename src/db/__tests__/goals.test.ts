// The new-month check-in ("Did October's $300 go into savings?"): answering it must add the money once.
import { describe, expect, it, jest } from '@jest/globals';

import { answerCheckin, createGoal, listDeposits } from '../goals';
import { migrate } from '../migrate';
import { getSettings, setSettings } from '../settings';
import { syncOnce, type Remote, type RemoteRecord } from '../sync';
import { savedTotal } from '@/lib/goal';
import { nodeDatabase } from '@/test/node-db';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('@/lib/files', () => ({ deleteReceiptImage: jest.fn() }));

async function device() {
  const db = nodeDatabase();
  await migrate(db);
  return db;
}

/** Last edit wins, like supabase/schema.sql. */
function fakeServer(): Remote {
  const rows = new Map<string, RemoteRecord & { synced_at: string }>();
  let clock = Date.parse('2026-11-01T09:00:00Z');
  return {
    async pull(since) {
      return [...rows.values()].filter((r) => !since || r.synced_at > since).sort((a, b) => (a.synced_at < b.synced_at ? -1 : 1));
    },
    async push(records) {
      for (const r of records) {
        const key = `${r.kind}:${r.id}`;
        const cur = rows.get(key);
        if (cur && r.updated_at < cur.updated_at) continue;
        clock += 1000;
        rows.set(key, { ...r, data: r.deleted ? null : r.data, synced_at: new Date(clock).toISOString() });
      }
    },
  };
}

const october = { month: '2026-10-01', amountCents: 30000, note: 'October’s set-aside' };

describe('answering the savings check-in', () => {
  it('adds last month’s set-aside, dated in that month, and marks the month answered', async () => {
    const db = await device();
    const goalId = await createGoal(db, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20' });
    expect(await answerCheckin(db, { goalId, ...october })).toBe(true);
    const deposits = await listDeposits(db, goalId);
    expect(deposits.map((d) => [d.kind, d.amount_cents, d.occurred_on, d.note])).toEqual([['deposit', 30000, '2026-10-31', 'October’s set-aside']]);
    expect((await getSettings(db)).goalCheckin).toBe('2026-10');
  });

  it('adds the money once when "Yes, add" is tapped twice', async () => {
    const db = await device();
    const goalId = await createGoal(db, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20' });
    // Two taps before the panel goes away: both calls start before either finishes.
    const results = await Promise.all([answerCheckin(db, { goalId, ...october }), answerCheckin(db, { goalId, ...october })]);
    expect(results.sort()).toEqual([false, true]);
    expect(savedTotal(await listDeposits(db, goalId))).toBe(30000);
  });

  it('adds nothing for a month already answered with "Not this month"', async () => {
    const db = await device();
    const goalId = await createGoal(db, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20' });
    await setSettings(db, { goal_checkin: '2026-10' });
    expect(await answerCheckin(db, { goalId, ...october })).toBe(false);
    expect(await listDeposits(db, goalId)).toEqual([]);
  });

  it('still asks again next month', async () => {
    const db = await device();
    const goalId = await createGoal(db, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20' });
    await answerCheckin(db, { goalId, ...october });
    expect(await answerCheckin(db, { goalId, month: '2026-11-01', amountCents: 30000, note: 'November’s set-aside' })).toBe(true);
    expect(savedTotal(await listDeposits(db, goalId))).toBe(60000);
    expect((await getSettings(db)).goalCheckin).toBe('2026-11');
  });

  it('counts the month once when the phone and the iPad both answer before syncing', async () => {
    const remote = fakeServer();
    const phone = await device();
    const ipad = await device();
    const goalId = await createGoal(phone, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20' });
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);

    expect(await answerCheckin(phone, { goalId, ...october })).toBe(true);
    expect(await answerCheckin(ipad, { goalId, ...october })).toBe(true);
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    await syncOnce(phone, remote);

    expect(savedTotal(await listDeposits(phone, goalId))).toBe(30000);
    expect(savedTotal(await listDeposits(ipad, goalId))).toBe(30000);
  });
});
