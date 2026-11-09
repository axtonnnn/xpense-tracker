// Who is asking: every AI request carries the person's Supabase access token (a signed JWT). We check its
// signature and claims here, so trial and Pro limits follow the account, not the phone.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { Env } from './env';

export type Verify = (token: string, env: Env) => Promise<string | null>;

const jwksCache = new Map<string, JWTVerifyGetKey>();

/** The project URL, or null while wrangler.toml still has the placeholder. */
export const supabaseBase = (env: Env): string | null => {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  return url && /^https:\/\//.test(url) ? url : null;
};

/** Supabase signs access tokens with the project's signing keys (published as JWKS), or with a legacy shared secret. */
export const verifySupabaseToken: Verify = async (token, env) => {
  const base = supabaseBase(env);
  if (!base) return null;
  const options = { issuer: `${base}/auth/v1`, audience: 'authenticated' };
  try {
    if (env.SUPABASE_JWT_SECRET) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), { ...options, algorithms: ['HS256'] });
      return typeof payload.sub === 'string' ? payload.sub : null;
    }
    let jwks = jwksCache.get(base);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
      jwksCache.set(base, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, options);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
};

/** The account id behind a request, or null. DEV_USER_ID lets `wrangler dev` run without Supabase. */
export async function userFrom(request: Request, env: Env, verify: Verify): Promise<string | null> {
  const header = request.headers.get('Authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token) return env.DEV_USER_ID && !supabaseBase(env) ? env.DEV_USER_ID : null;
  return verify(token, env);
}

/**
 * Deletes the account's sign-in (and with it every synced record, which cascades) using the project's
 * secret key. New-format keys (sb_secret_…) go only in the apikey header; legacy JWT keys also as Bearer.
 */
export async function deleteSupabaseUser(env: Env, userId: string, fetchImpl: typeof fetch): Promise<boolean> {
  const base = supabaseBase(env);
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key) return false;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const res = await fetchImpl(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers });
  return res.ok || res.status === 404;
}

/** For /health?deep=1: does Supabase accept the secret key? Lists at most one user. */
export async function checkSupabaseKey(env: Env, fetchImpl: typeof fetch): Promise<'ok' | 'invalid' | 'unreachable' | 'missing'> {
  const base = supabaseBase(env);
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key) return 'missing';
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetchImpl(`${base}/auth/v1/admin/users?page=1&per_page=1`, { headers });
    return res.ok ? 'ok' : res.status === 401 || res.status === 403 ? 'invalid' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
