import { describe, expect, it, vi } from 'vitest';

import type { ReceiptResult } from '../../shared/schemas';
import { AIError, type AIProvider } from '../src/ai/claude';
import type { Env, KV } from '../src/env';
import { createHandler } from '../src/index';

const INSTALL = '3f2b8c1e-4d5a-4b6c-8e7f-0123456789ab';
const NOW = new Date('2026-10-23T12:00:00Z');

const receipt: ReceiptResult = {
  is_financial_document: true,
  doc_type: 'receipt',
  merchant: 'Corner Market',
  date: '2026-10-22',
  due_date: null,
  currency: 'USD',
  subtotal: 10,
  tax: 1,
  tip: null,
  total: 11,
  category: 'groceries',
  necessity: 'need',
  items: [{ name: 'Bread', quantity: 1, total_price: 10, category: 'groceries', necessity: 'need', reason: 'Staple' }],
  confidence: 'high',
  notes: null,
};

class MemoryKV implements KV {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

function setup(opts: { pro?: boolean; rcStatus?: number; ai?: Partial<AIProvider>; env?: Partial<Env> } = {}) {
  const kv = new MemoryKV();
  const env: Env = { ANTHROPIC_API_KEY: 'test', REVENUECAT_SECRET_KEY: 'rc_secret', USAGE: kv, ...opts.env };
  const ai: AIProvider = {
    scanReceipt: vi.fn(async () => receipt),
    checkPurchase: vi.fn(async () => ({ necessity: 'want' as const, verdict: 'wait' as const, reason: 'Nice to have.', cheaper_alternative: null, questions: [] })),
    monthlyReview: vi.fn(async () => ({ headline: 'Good month', summary: 'Fine.', tips: ['a', 'b', 'c'], safety_score: 70 })),
    ...opts.ai,
  };
  const fetchImpl = vi.fn(async () => {
    if (opts.rcStatus && opts.rcStatus !== 200) return new Response('{}', { status: opts.rcStatus });
    const entitlements = opts.pro ? { pro: { expires_date: '2027-01-01T00:00:00Z' } } : {};
    return Response.json({ subscriber: { entitlements } });
  }) as unknown as typeof fetch;
  const handle = createHandler({ ai: () => ai, fetchImpl, now: () => NOW });
  return { handle, env, kv, ai, fetchImpl };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://xpense.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = async (res: Response): Promise<any> => res.json();

const scanBody = { image_base64: 'a'.repeat(200), media_type: 'image/jpeg', currency: 'USD', locale: 'en-US', today: '2026-10-23' };
const checkBody = { item: 'Headphones', price: 199, currency: 'USD' };

describe('request validation', () => {
  it('rejects a missing install id', async () => {
    const { handle, env } = setup();
    const res = await handle(post('/v1/scan', scanBody, { 'X-Install-Id': 'nope' }), env);
    expect(res.status).toBe(400);
    expect((await read(res)).error.code).toBe('bad_install_id');
  });

  it('rejects malformed and incomplete bodies', async () => {
    const { handle, env } = setup();
    expect((await handle(post('/v1/scan', '{not json'), env)).status).toBe(400);
    expect((await handle(post('/v1/scan', { ...scanBody, media_type: 'image/gif' }), env)).status).toBe(400);
  });

  it('rejects oversized photos with 413', async () => {
    const { handle, env, ai } = setup();
    const res = await handle(post('/v1/scan', { ...scanBody, image_base64: 'a'.repeat(4_100_000) }), env);
    expect(res.status).toBe(413);
    expect(ai.scanReceipt).not.toHaveBeenCalled();
  });

  it('404s unknown routes and answers health checks', async () => {
    const { handle, env } = setup();
    expect((await handle(post('/v1/nope', {}), env)).status).toBe(404);
    expect((await handle(new Request('https://xpense.example/health'), env)).status).toBe(200);
  });
});

describe('free trial', () => {
  it('allows 3 scans, counts down, then returns 402', async () => {
    const { handle, env, ai } = setup();
    for (const left of [2, 1, 0]) {
      const res = await handle(post('/v1/scan', scanBody), env);
      expect(res.status).toBe(200);
      const json = await read(res);
      expect(json.trial_remaining).toBe(left);
      expect(json.receipt.merchant).toBe('Corner Market');
    }
    const blocked = await handle(post('/v1/scan', scanBody), env);
    expect(blocked.status).toBe(402);
    expect((await read(blocked)).error.code).toBe('trial_used');
    expect(ai.scanReceipt).toHaveBeenCalledTimes(3);
  });

  it('does not use up the trial when the AI fails', async () => {
    const { handle, env, kv } = setup({
      ai: { scanReceipt: vi.fn(async () => Promise.reject(new AIError(422, 'ai_declined', 'Nope'))) },
    });
    const res = await handle(post('/v1/scan', scanBody), env);
    expect(res.status).toBe(422);
    expect(kv.store.get(`trial:${INSTALL}`)).toBeUndefined();
  });

  it('keeps buy checks and reviews Pro-only', async () => {
    const { handle, env, ai } = setup();
    const res = await handle(post('/v1/check', checkBody), env);
    expect(res.status).toBe(402);
    expect(ai.checkPurchase).not.toHaveBeenCalled();
  });
});

describe('Pro', () => {
  it('confirms the entitlement with RevenueCat and caches it', async () => {
    const { handle, env, fetchImpl, kv } = setup({ pro: true });
    const first = await handle(post('/v1/check', checkBody), env);
    expect(first.status).toBe(200);
    expect((await read(first)).result.verdict).toBe('wait');
    await handle(post('/v1/check', checkBody), env);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(kv.store.get(`pro:${INSTALL}`)).toBe('1');
  });

  it('does not touch the trial counter for Pro scans', async () => {
    const { handle, env, kv } = setup({ pro: true });
    const res = await handle(post('/v1/scan', scanBody), env);
    expect((await read(res)).trial_remaining).toBeNull();
    expect(kv.store.get(`trial:${INSTALL}`)).toBeUndefined();
    expect(kv.store.get(`usage:${INSTALL}:2026-10:scan`)).toBe('1');
  });

  it('treats an expired subscription as free', async () => {
    const { handle, env } = setup({ pro: false });
    expect((await handle(post('/v1/review', {}), env)).status).toBe(400);
    const res = await handle(
      post('/v1/review', { month: '2026-10', currency: 'USD', income: 1, spent: 1, need: 1, want: 0, savings_goal: 0, previous: null, categories: [] }),
      env,
    );
    expect(res.status).toBe(402);
  });

  it('enforces the monthly fair-use cap with 429', async () => {
    const { handle, env, kv } = setup({ pro: true, env: { PRO_MONTHLY_SCANS: '2' } });
    kv.store.set(`usage:${INSTALL}:2026-10:scan`, '2');
    const res = await handle(post('/v1/scan', scanBody), env);
    expect(res.status).toBe(429);
    expect((await read(res)).error.code).toBe('monthly_limit');
  });

  it('fails closed with 503 when RevenueCat is down', async () => {
    const { handle, env, ai } = setup({ rcStatus: 500 });
    const res = await handle(post('/v1/check', checkBody), env);
    expect(res.status).toBe(503);
    expect(ai.checkPurchase).not.toHaveBeenCalled();
  });
});

describe('burst limiter', () => {
  it('returns 429 when the binding says so', async () => {
    const { handle, env } = setup({ env: { BURST_LIMITER: { limit: async () => ({ success: false }) } } });
    const res = await handle(post('/v1/scan', scanBody), env);
    expect(res.status).toBe(429);
  });
});
