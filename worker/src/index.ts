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
  keepaliveMs?: number;
};

const MAX_BODY_BYTES = 4_000_000;
const KEEPALIVE_MS = 10_000;
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

// no-transform stops Cloudflare from compressing (and so buffering) the keepalive bytes below.
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-transform', ...CORS };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const errorBody = (status: number, code: string, message: string) => ({ error: { code, message, status } });

function error(status: number, code: string, message: string): Response {
  return json(errorBody(status, code, message), status);
}

/**
 * At max effort Claude can think for a minute or more, but iPhones drop a request that receives no
 * bytes for 60 s. So AI answers start streaming at once: a space every 10 seconds (leading
 * whitespace is valid JSON), then the JSON. Errors from this point on arrive in the body as
 * { error: { code, message, status } } because the 200 status has already been sent.
 */
function slowJson(work: () => Promise<unknown>, keepaliveMs: number): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const timer = setInterval(() => {
    writer.write(encoder.encode(' ')).catch(() => undefined);
  }, keepaliveMs);
  void (async () => {
    let body: unknown;
    try {
      body = await work();
    } catch (e) {
      console.error('[ai]', e);
      body = errorBody(502, 'ai_error', 'The AI service had a problem. Please try again.');
    } finally {
      clearInterval(timer);
    }
    try {
      await writer.write(encoder.encode(JSON.stringify(body)));
      await writer.close();
    } catch {
      // The phone disconnected; nothing left to do.
    }
  })();
  return new Response(readable, { status: 200, headers: JSON_HEADERS });
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

    return slowJson(async () => {
      let result: unknown;
      try {
        result = await route.run(deps.ai(env), parsed.data as never);
      } catch (e) {
        if (e instanceof AIError) return errorBody(e.status, e.code, e.message);
        throw e;
      }
      // Only successful answers count against the trial or the monthly cap.
      const usage = await recordUsage(env, installId, route.feature, access, when);
      return route.feature === 'scan' ? { receipt: result, trial_remaining: usage.trialRemaining } : { result };
    }, deps.keepaliveMs ?? KEEPALIVE_MS);
  };
}

const handler = createHandler({ ai: (env) => createClaude(env.ANTHROPIC_API_KEY) });

export default {
  fetch: (request: Request, env: Env) => handler(request, env),
};
