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
import { getAccessToken } from './auth';
import { API_URL, DEMO_AI } from './config';
import { demoCheck, demoReceipt, demoReview } from './demo';

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

// The AI thinks at max effort, so answers can take a minute or more. The Worker keeps the
// connection alive while it works; this is the most we wait for the whole answer.
const TIMEOUT_MS = 180_000;

async function post(path: string, body: unknown, timeoutMs = TIMEOUT_MS): Promise<Record<string, unknown>> {
  if (!API_URL) {
    throw new ApiError('not_configured', 'The AI service is not set up yet. Add your Worker URL to app.json → extra.apiUrl.');
  }
  // The server knows who's asking from the account's sign-in token (and checks Pro for that account).
  const token = await getAccessToken();
  if (!token) throw new ApiError('signed_out', 'Please sign in again to use the AI.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    text = await res.text();
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new ApiError(
      aborted ? 'timeout' : 'network',
      aborted ? 'The AI took too long to answer. Please try again.' : "Couldn't reach the AI service. Check your connection.",
    );
  } finally {
    clearTimeout(timer);
  }
  let json: Record<string, unknown> | null = null;
  try {
    // AI answers may start with keepalive spaces; JSON.parse ignores leading whitespace.
    json = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  // Errors can arrive as an HTTP status, or (after the answer started streaming) inside a 200 body.
  const err = json?.error as { code?: string; message?: string; status?: number } | undefined;
  if (!res.ok || !json || err) {
    const status = err?.status ?? res.status;
    const code = err?.code ?? `http_${status}`;
    const message = err?.message ?? 'Something went wrong. Please try again.';
    if (status === 402) throw new NeedsProError(code, message, status);
    throw new ApiError(code, message, status);
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

/**
 * Deletes the account on the server: the synced data, the sign-in, usage counters and the RevenueCat
 * customer. An App Store subscription itself has to be cancelled in the person's Apple account.
 */
export async function deleteAccountOnServer(): Promise<void> {
  await post('/v1/account/delete', {}, 30_000);
}
