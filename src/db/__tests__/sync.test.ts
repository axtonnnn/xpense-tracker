// Two devices on one account, syncing through a fake server that behaves like supabase/schema.sql
// (last edit wins, deletions are tombstones, every write gets a server timestamp).
import { describe, expect, it, jest } from '@jest/globals';

import { addDeposit, createGoal, deleteGoal, getActiveGoal, listDeposits } from '../goals';
import { migrate } from '../migrate';
import { applyDueRecurring, addRecurring } from '../recurring';
import { getSettings, setSettings } from '../settings';
import { syncOnce, pendingChanges, type Remote, type RemoteRecord } from '../sync';
import { deleteTransaction, getTransaction, insertTransaction, listBetween, saveScannedReceipt, updateTransaction } from '../transactions';
import { nodeDatabase } from '@/test/node-db';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('@/lib/files', () => ({ deleteReceiptImage: jest.fn() }));

function fakeServer({ kinds }: { kinds?: string[] } = {}) {
  const rows = new Map<string, RemoteRecord & { synced_at: string }>();
  let clock = Date.parse('2026-10-25T09:00:00Z');
  const remote: Remote = {
    async pull(since) {
      return [...rows.values()].filter((r) => !since || r.synced_at > since).sort((a, b) => (a.synced_at < b.synced_at ? -1 : 1));
    },
    async push(records) {
      // An older schema.sql: the kind check rejects the whole batch.
      if (kinds && records.some((r) => !kinds.includes(r.kind))) throw new Error('violates check constraint "records_kind_check"');
      for (const r of records) {
        const key = `${r.kind}:${r.id}`;
        const cur = rows.get(key);
        // The schema's trigger: an older edit that arrives late is ignored.
        if (cur && r.updated_at < cur.updated_at) continue;
        clock += 1000;
        rows.set(key, { ...r, data: r.deleted ? null : r.data, synced_at: new Date(clock).toISOString() });
      }
    },
  };
  return { remote, rows };
}

async function device() {
  const db = nodeDatabase();
  await migrate(db);
  return db;
}

const tick = () => new Promise((r) => setTimeout(r, 5));
const expense = (merchant: string, amountCents: number) => ({
  type: 'expense' as const,
  amountCents,
  necessity: 'need' as const,
  currency: 'USD',
  merchant,
  category: 'groceries',
  occurredOn: '2026-10-24',
});

describe('sync between two devices', () => {
  it('carries new entries and settings to the other device', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    await insertTransaction(phone, expense('Green Valley Market', 5000));
    await setSettings(phone, { name: 'Sam', onboarded: true, savings_goal_cents: 80000 });
    await syncOnce(phone, remote);
    expect(await pendingChanges(phone)).toBe(0);

    await syncOnce(ipad, remote);
    const txs = await listBetween(ipad, '2026-10-01', '2026-10-31');
    expect(txs.map((t) => [t.merchant, t.amount_cents])).toEqual([['Green Valley Market', 5000]]);
    const s = await getSettings(ipad);
    expect(s).toMatchObject({ name: 'Sam', onboarded: true, savingsGoalCents: 80000 });
  });

  it('keeps settings that belong to one device on that device', async () => {
    const { remote, rows } = fakeServer();
    const phone = await device();
    await setSettings(phone, { ai_consent: true, app_lock: true, currency: 'EUR' });
    await syncOnce(phone, remote);
    expect([...rows.keys()]).toEqual(['setting:currency']);
  });

  it('passes edits and deletions both ways', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    const id = await insertTransaction(phone, expense('Corner Café', 1480));
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);

    await tick();
    await updateTransaction(ipad, id, { amountCents: 1600 });
    await syncOnce(ipad, remote);
    await syncOnce(phone, remote);
    expect((await listBetween(phone, '2026-10-01', '2026-10-31'))[0].amount_cents).toBe(1600);

    await deleteTransaction(phone, id);
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    expect(await listBetween(ipad, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('lets the later edit win when both devices changed the same entry offline', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    const id = await insertTransaction(phone, expense('Cinema', 3200));
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);

    await tick();
    await updateTransaction(phone, id, { amountCents: 1000 });
    await tick();
    await updateTransaction(ipad, id, { amountCents: 2000 });
    // The newer edit (iPad) reaches the server first; the phone's older one must not overwrite it.
    await syncOnce(ipad, remote);
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    for (const db of [phone, ipad]) expect((await listBetween(db, '2026-10-01', '2026-10-31'))[0].amount_cents).toBe(2000);
  });

  it('books a repeating paycheck once, even when both devices book it', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    await addRecurring(phone, { type: 'income', label: 'Paycheck', amountCents: 115000, category: 'salary', necessity: null, cadence: 'weekly', startOn: '2026-10-02' });
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    // Both open the app on the 25th before syncing again.
    await applyDueRecurring(phone, '2026-10-25', 'USD');
    await applyDueRecurring(ipad, '2026-10-25', 'USD');
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    await syncOnce(phone, remote);
    for (const db of [phone, ipad]) {
      const paychecks = (await listBetween(db, '2026-10-01', '2026-10-31')).filter((t) => t.type === 'income');
      expect(paychecks.map((t) => t.occurred_on).sort()).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23']);
    }
  });

  it('does not bring back an entry deleted here but not yet uploaded', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    const id = await insertTransaction(phone, expense('Book', 2208));
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    await deleteTransaction(ipad, id);
    // The pull half of this sync sees the old row again; the pending deletion must win.
    await syncOnce(ipad, remote);
    expect(await listBetween(ipad, '2026-10-01', '2026-10-31')).toEqual([]);
    await syncOnce(phone, remote);
    expect(await listBetween(phone, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('syncs a scanned receipt and its lines, but not the photo', async () => {
    const { remote, rows } = fakeServer();
    const phone = await device();
    const ipad = await device();
    const id = await saveScannedReceipt(
      phone,
      {
        isFinancialDocument: true,
        docType: 'receipt',
        merchant: 'Green Valley Market',
        date: '2026-10-25',
        dueDate: null,
        currency: 'USD',
        receiptCurrency: 'USD',
        subtotalCents: 1228,
        taxCents: 0,
        tipCents: null,
        totalCents: 1228,
        category: 'groceries',
        necessity: 'need',
        items: [
          { key: 'a', name: 'Whole milk', qty: 1, totalCents: 429, category: 'groceries', necessity: 'need', reason: 'Basic food staple' },
          { key: 'b', name: 'Chocolate bar', qty: 1, totalCents: 799, category: 'groceries', necessity: 'want', reason: 'Snack treat' },
        ],
        confidence: 'high',
        notes: null,
      },
      'file:///phone/receipts/1.jpg',
      '{}',
    );
    await syncOnce(phone, remote);
    expect(JSON.stringify([...rows.values()])).not.toContain('file:///');
    await syncOnce(ipad, remote);
    const got = await getTransaction(ipad, id);
    expect(got?.items.map((i) => [i.name, i.necessity])).toEqual([
      ['Whole milk', 'need'],
      ['Chocolate bar', 'want'],
    ]);
    expect(got?.receipt?.image_uri).toBeNull();
    expect([got?.tx.need_cents, got?.tx.want_cents]).toEqual([429, 799]);
  });
  it('carries the savings goal and its deposits, and deletes them everywhere', async () => {
    const { remote } = fakeServer();
    const phone = await device();
    const ipad = await device();
    const goalId = await createGoal(phone, { name: 'A laptop', targetCents: 120000, startedOn: '2026-09-20', alreadySavedCents: 12000 });
    await addDeposit(phone, { goalId, amountCents: 30000, occurredOn: '2026-10-01', note: 'October' });
    await syncOnce(phone, remote);
    await syncOnce(ipad, remote);
    expect((await getActiveGoal(ipad))?.name).toBe('A laptop');
    expect((await listDeposits(ipad, goalId)).map((d) => [d.kind, d.amount_cents])).toEqual([
      ['deposit', 30000],
      ['starting', 12000],
    ]);

    await deleteGoal(ipad, goalId);
    await syncOnce(ipad, remote);
    await syncOnce(phone, remote);
    expect(await getActiveGoal(phone)).toBeNull();
    expect(await listDeposits(phone, goalId)).toEqual([]);
  });

  it('keeps syncing everything else when the server does not take goals yet', async () => {
    const { remote, rows } = fakeServer({ kinds: ['setting', 'recurring', 'receipt', 'receipt_item', 'transaction'] });
    const phone = await device();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await createGoal(phone, { name: 'A bike', targetCents: 40000, startedOn: '2026-10-01' });
    await insertTransaction(phone, expense('Green Valley Market', 5000));
    await syncOnce(phone, remote);
    expect([...rows.values()].map((r) => r.kind)).toEqual(['transaction']);
    // The goal waits on the device for a server that takes it.
    expect(await pendingChanges(phone)).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
