// Who may use which AI feature: Pro subscribers (checked with RevenueCat on the server, so a
// modified app can't unlock it), plus a small free trial of receipt scans for everyone else.
import type { KeyStatus } from './ai/claude';
import type { Env } from './env';

export type Feature = 'scan' | 'check' | 'review';

export type Access =
  | { ok: true; plan: 'pro' | 'trial'; trialUsed: number }
  | { ok: false; status: 402 | 429 | 503; code: string; message: string };

export const ENTITLEMENT = 'pro';
const PRO_CACHE_TTL = 600; // seconds; only "is Pro" is cached so a new purchase works immediately
const MONTH_TTL = 60 * 60 * 24 * 40;

/** Fair-use caps per Pro install per calendar month (override with the PRO_MONTHLY_* vars). */
const DEFAULT_CAPS: Record<Feature, number> = { scan: 300, check: 300, review: 30 };

export function monthlyCap(env: Env, feature: Feature): number {
  const raw = { scan: env.PRO_MONTHLY_SCANS, check: env.PRO_MONTHLY_CHECKS, review: env.PRO_MONTHLY_REVIEWS }[feature];
  const n = Number(raw ?? DEFAULT_CAPS[feature]);
  return Number.isFinite(n) ? n : DEFAULT_CAPS[feature];
}

export const trialLimit = (env: Env) => Number(env.FREE_TRIAL_SCANS ?? 3);
const trialKey = (id: string) => `trial:${id}`;
const usageKey = (id: string, feature: Feature, now: Date) => `usage:${id}:${now.toISOString().slice(0, 7)}:${feature}`;

async function readCount(env: Env, key: string): Promise<number> {
  const n = Number(await env.USAGE.get(key));
  return Number.isFinite(n) ? n : 0;
}

export async function isPro(env: Env, installId: string, fetchImpl: typeof fetch, now: Date): Promise<boolean> {
  if (env.ALLOW_ALL_PRO === 'true') return true;
  const cacheKey = `pro:${installId}`;
  if ((await env.USAGE.get(cacheKey)) === '1') return true;
  if (!env.REVENUECAT_SECRET_KEY) return false;

  const res = await fetchSubscriber(env, fetchImpl, installId);
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`RevenueCat responded ${res.status}`);
  const data = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null } | undefined> };
  };
  const ent = data.subscriber?.entitlements?.[ENTITLEMENT];
  const active = !!ent && (ent.expires_date === null || Date.parse(ent.expires_date) > now.getTime());
  if (active) await env.USAGE.put(cacheKey, '1', { expirationTtl: PRO_CACHE_TTL });
  return active;
}

const fetchSubscriber = (env: Env, fetchImpl: typeof fetch, appUserId: string) =>
  fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}`, Accept: 'application/json' },
  });

/** Confirms RevenueCat accepts our secret key (for /health?deep=1). It only looks up a test customer. */
export async function checkRevenueCatKey(env: Env, fetchImpl: typeof fetch): Promise<KeyStatus | 'missing'> {
  if (!env.REVENUECAT_SECRET_KEY) return 'missing';
  try {
    const res = await fetchSubscriber(env, fetchImpl, 'xpense-key-check');
    return res.ok ? 'ok' : res.status === 401 || res.status === 403 ? 'invalid' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export async function checkAccess(
  env: Env,
  installId: string,
  feature: Feature,
  deps: { fetchImpl: typeof fetch; now: Date },
): Promise<Access> {
  let pro = false;
  let storeDown = false;
  try {
    pro = await isPro(env, installId, deps.fetchImpl, deps.now);
  } catch (e) {
    console.error('[entitlement]', e);
    storeDown = true;
  }

  if (pro) {
    const used = await readCount(env, usageKey(installId, feature, deps.now));
    if (used >= monthlyCap(env, feature)) {
      return {
        ok: false,
        status: 429,
        code: 'monthly_limit',
        message: 'You’ve reached this month’s fair-use limit for this AI feature. It resets on the 1st.',
      };
    }
    return { ok: true, plan: 'pro', trialUsed: 0 };
  }

  // Free trial scans don't depend on RevenueCat, so they keep working through a RevenueCat outage.
  // Anything that needs Pro waits until the subscription can be confirmed.
  const unavailable: Access = { ok: false, status: 503, code: 'store_unavailable', message: 'Couldn’t confirm your subscription. Please try again shortly.' };
  if (feature !== 'scan') {
    return storeDown ? unavailable : { ok: false, status: 402, code: 'needs_pro', message: 'This AI feature is part of Xpense Pro.' };
  }
  const trialUsed = await readCount(env, trialKey(installId));
  if (trialUsed >= trialLimit(env)) {
    return storeDown
      ? unavailable
      : {
          ok: false,
          status: 402,
          code: 'trial_used',
          message: `You’ve used your free AI scans. Xpense Pro includes up to ${monthlyCap(env, 'scan')} a month.`,
        };
  }
  return { ok: true, plan: 'trial', trialUsed };
}

/** Counts a successful AI call. Returns free scans left for trial users. */
export async function recordUsage(
  env: Env,
  installId: string,
  feature: Feature,
  access: Extract<Access, { ok: true }>,
  now: Date,
): Promise<{ trialRemaining: number | null }> {
  if (access.plan === 'trial') {
    const used = access.trialUsed + 1;
    await env.USAGE.put(trialKey(installId), String(used));
    return { trialRemaining: Math.max(0, trialLimit(env) - used) };
  }
  const key = usageKey(installId, feature, now);
  await env.USAGE.put(key, String((await readCount(env, key)) + 1), { expirationTtl: MONTH_TTL });
  return { trialRemaining: null };
}
