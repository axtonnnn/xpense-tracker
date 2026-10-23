// Client for the Xpense AI Worker. The Anthropic key lives only on the Worker, never in the app.
import type { z } from 'zod';

import {
  CheckSchema,
  ReceiptSchema,
  ReviewSchema,
  type CheckRequest,
  type CheckResult,
  type ReceiptResult,
  type ReviewRequest,
  type ReviewResult,
  type ScanRequest,
} from '../../shared/schemas';
import { API_URL, DEMO_AI } from './config';
import { demoCheck, demoReceipt, demoReview } from './demo';
import { getInstallId } from './install-id';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

/** The free trial is used up (or the feature is Pro-only). The UI responds by opening the paywall. */
export class NeedsProError extends ApiError {}

const TIMEOUT_MS = 60_000;

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  if (!API_URL) {
    throw new ApiError('not_configured', 'The AI service is not set up yet. Add your Worker URL to app.json → extra.apiUrl.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': await getInstallId() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new ApiError(
      aborted ? 'timeout' : 'network',
      aborted ? 'The AI took too long to answer. Please try again.' : "Couldn't reach the AI service. Check your connection.",
    );
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    const err = (json?.error ?? {}) as { code?: string; message?: string };
    const code = err.code ?? `http_${res.status}`;
    const message = err.message ?? 'Something went wrong. Please try again.';
    if (res.status === 402) throw new NeedsProError(code, message, res.status);
    throw new ApiError(code, message, res.status);
  }
  return json;
}

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('bad_response', 'The AI answer was incomplete. Please try again.');
  return parsed.data;
}

export type ScanResult = { receipt: ReceiptResult; trialRemaining: number | null; raw: string };

export async function scanReceipt(req: ScanRequest): Promise<ScanResult> {
  if (DEMO_AI) return { receipt: await demoReceipt(), trialRemaining: null, raw: '{}' };
  const json = await post('/v1/scan', req);
  const receipt = validate(ReceiptSchema, json.receipt);
  const trial = typeof json.trial_remaining === 'number' ? json.trial_remaining : null;
  return { receipt, trialRemaining: trial, raw: JSON.stringify(receipt) };
}

export async function checkPurchase(req: CheckRequest): Promise<CheckResult> {
  if (DEMO_AI) return demoCheck(req);
  return validate(CheckSchema, (await post('/v1/check', req)).result);
}

export async function monthlyReview(req: ReviewRequest): Promise<ReviewResult> {
  if (DEMO_AI) return demoReview();
  return validate(ReviewSchema, (await post('/v1/review', req)).result);
}
