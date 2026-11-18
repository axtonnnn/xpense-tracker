// Repeating bills booked on the device: the day of the month a repeat is pinned to.
import { describe, expect, it, jest } from '@jest/globals';

import { migrate } from '../migrate';
import { addRecurring, applyDueRecurring } from '../recurring';
import { nodeDatabase } from '@/test/node-db';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

async function bookedDates(anchorOn?: string) {
  const db = nodeDatabase();
  await migrate(db);
  const bill = { type: 'expense' as const, label: 'Rent', amountCents: 120000, category: 'housing', necessity: 'need' as const, cadence: 'monthly' as const };
  // A bill due Jan 31, already saved, set to repeat from next month (as the scan review does).
  await addRecurring(db, { ...bill, startOn: '2026-02-28', anchorOn });
  await applyDueRecurring(db, '2026-05-31', 'USD');
  const rows = await db.getAllAsync<{ occurred_on: string }>('SELECT occurred_on FROM transactions ORDER BY occurred_on');
  return rows.map((r) => r.occurred_on);
}

describe('addRecurring', () => {
  it('keeps a bill due on the 31st on the last day of each month', async () => {
    expect(await bookedDates('2026-01-31')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('pins the repeat to its first date when no other day is given', async () => {
    expect(await bookedDates()).toEqual(['2026-02-28', '2026-03-28', '2026-04-28', '2026-05-28']);
  });
});
