// Xpense AI Worker: keeps the Anthropic key off the phone, checks Pro/trial access, and returns
// schema-validated JSON. It stores no images or results — only small usage counters in KV.
import type { z } from 'zod';

import { CheckRequestSchema, ReviewRequestSchema, ScanRequestSchema } from '../../shared/schemas';
import { AIError, createClaude, type AIProvider } from './ai/claude';
import { checkAccess, recordUsage, type Feature } from './entitlement';
import type { Env } from './env';

export type Deps = {
  ai: (env: Env) => AIProvider;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const MAX_BODY_BYTES = 4_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Install-Id',
};

type Route = {
  feature: Feature;
  schema: z.ZodType;
  run: (ai: AIProvider, body: never) => Promise<unknown>;
};

const ROUTES: Record<string, Route> = {
  '/v1/scan': { feature: 'scan', schema: ScanRequestSchema, run: (ai, body) => ai.scanReceipt(body) },
  '/v1/check': { feature: 'check', schema: CheckRequestSchema, run: (ai, body) => ai.checkPurchase(body) },
  '/v1/review': { feature: 'review', schema: ReviewRequestSchema, run: (ai, body) => ai.monthlyReview(body) },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function createHandler(deps: Deps) {
  const fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis);
  const now = deps.now ?? (() => new Date());

  return async function handle(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/health') return json({ ok: true });

    const route = ROUTES[pathname];
    if (!route) return error(404, 'not_found', 'Not found.');
    if (request.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST.');

    const installId = request.headers.get('X-Install-Id') ?? '';
    if (!UUID.test(installId)) return error(400, 'bad_install_id', 'Missing or invalid install ID.');

    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
      return error(413, 'too_large', 'That photo is too large. Please try again.');
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return error(413, 'too_large', 'That photo is too large. Please try again.');

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return error(400, 'bad_json', 'The request could not be read.');
    }
    const parsed = route.schema.safeParse(body);
    if (!parsed.success) return error(400, 'bad_request', 'The request was incomplete.');

    if (env.BURST_LIMITER) {
      const { success } = await env.BURST_LIMITER.limit({ key: installId });
      if (!success) return error(429, 'slow_down', 'Too many requests. Please wait a minute and try again.');
    }

    const when = now();
    const access = await checkAccess(env, installId, route.feature, { fetchImpl, now: when });
    if (!access.ok) return error(access.status, access.code, access.message);

    let result: unknown;
    try {
      result = await route.run(deps.ai(env), parsed.data as never);
    } catch (e) {
      if (e instanceof AIError) return error(e.status, e.code, e.message);
      console.error('[ai]', e);
      return error(502, 'ai_error', 'The AI service had a problem. Please try again.');
    }

    const usage = await recordUsage(env, installId, route.feature, access, when);
    if (route.feature === 'scan') return json({ receipt: result, trial_remaining: usage.trialRemaining });
    return json({ result });
  };
}

const handler = createHandler({ ai: (env) => createClaude(env.ANTHROPIC_API_KEY) });

export default {
  fetch: (request: Request, env: Env) => handler(request, env),
};
