import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { verifySupabaseToken } from '../src/auth';
import type { Env } from '../src/env';

const SECRET = 'a-legacy-jwt-secret-that-is-long-enough';
const env = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_JWT_SECRET: SECRET } as Env;

const sign = (claims: Record<string, unknown>, opts: { exp?: string; secret?: string } = {}) =>
  new SignJWT({ role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));

describe('verifySupabaseToken', () => {
  it('returns the account id for a valid token', async () => {
    const token = await sign({ sub: 'user-1', iss: 'https://abc.supabase.co/auth/v1', aud: 'authenticated' });
    expect(await verifySupabaseToken(token, env)).toBe('user-1');
  });

  it('rejects tokens from another project, for another audience, expired or forged', async () => {
    const base = { sub: 'user-1', iss: 'https://abc.supabase.co/auth/v1', aud: 'authenticated' };
    expect(await verifySupabaseToken(await sign({ ...base, iss: 'https://evil.supabase.co/auth/v1' }), env)).toBeNull();
    expect(await verifySupabaseToken(await sign({ ...base, aud: 'anon' }), env)).toBeNull();
    expect(await verifySupabaseToken(await sign(base, { exp: '-1m' }), env)).toBeNull();
    expect(await verifySupabaseToken(await sign(base, { secret: 'someone-elses-secret-also-long-enough' }), env)).toBeNull();
    expect(await verifySupabaseToken('not-a-jwt', env)).toBeNull();
  });

  it('accepts nothing when Supabase is not configured', async () => {
    const token = await sign({ sub: 'user-1', iss: 'https://abc.supabase.co/auth/v1', aud: 'authenticated' });
    expect(await verifySupabaseToken(token, {} as Env)).toBeNull();
  });
});
