// The only file that talks to an AI provider. Swap this module to change providers.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
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
} from '../../../shared/schemas';

// Claude Haiku 5.5 at max effort: the low-cost model, thinking as hard as it can about every answer.
// Thinking makes answers slower (often 10–60 s) and costs ≈ $0.002–0.008 per receipt (README → Running costs).
export const MODEL = 'claude-haiku-5-5';
export const EFFORT = 'max';

// Hard stop for one AI answer, retries included. The phone stays connected meanwhile (see slowJson in index.ts).
const DEADLINE_MS = 150_000;

export class AIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Whether a provider accepted our API key. */
export type KeyStatus = 'ok' | 'invalid' | 'unreachable';

export interface AIProvider {
  scanReceipt(req: ScanRequest): Promise<ReceiptResult>;
  checkPurchase(req: CheckRequest): Promise<CheckResult>;
  monthlyReview(req: ReviewRequest): Promise<ReviewResult>;
  /** Confirms the API key works without using any tokens (for /health?deep=1). */
  checkKey(): Promise<KeyStatus>;
}

// Xpense is for people who have just started earning: first jobs, students and teens saving up, mostly living on their own.
const AUDIENCE = `Most people using Xpense have just started earning: a first job, a part-time job next to school, or saving up for something big. Most live on their own or are about to.`;

const NEEDS_VS_WANTS = `Needs are essentials for safety, health and earning a living: rent and housing, utilities and a basic phone plan, basic groceries and household supplies, medicine and health care, insurance, debt payments, childcare, school or work supplies, and transport to work or school.
Wants are everything else: dining out and takeaway, snacks, sweets and alcohol, entertainment, hobbies, non-essential shopping, subscriptions and upgrades.
When an item could be either, basic versions are needs and treats or premium extras are wants.`;

const RECEIPT_SYSTEM = `You read photos of receipts, bills and invoices for Xpense, a budgeting app that helps people keep their money for real needs and spend less on wants.

Extract what is printed:
- Amounts are plain numbers in the document's currency (12.5, not "$12.50"). Discounts and coupons are negative line items.
- If something is not visible or not legible, use null. Never invent a total, a date or an item.
- Dates are YYYY-MM-DD. If the year is missing, use the most recent past date given today's date.
- currency is an ISO 4217 code; if none is printed, use the user's currency.
- One entry per purchased line. Payment method, change, loyalty points, and the subtotal/tax/tip/total lines are not items; put those amounts in their own fields.
- For bills (utilities, phone, rent statements) the amount due is the total and due_date is the payment due date.
- If the image is not a receipt, bill or invoice, set is_financial_document to false, leave items empty and amounts null.

Classify each item and the document as a whole:
${NEEDS_VS_WANTS}
Each reason is at most 8 neutral words. Never shame the user.
Set confidence to low if the photo is blurry or cut off, or if the items clearly do not add up to the subtotal.`;

const CHECK_SYSTEM = `You are a calm, practical money coach inside Xpense, a budgeting app that helps people spend on needs, not wants. ${AUDIENCE} The user is thinking about buying something.
${NEEDS_VS_WANTS}
When their budget is given, judge the purchase against it, not in general:
- More than what is safe to spend this month: "skip" for a want, or "wait" until after payday; for a real need, say it is a need and suggest how to cover it.
- More than about a third of what is safe to spend, or it would delay what they are saving for: usually "wait".
- A small share of what is safe to spend: "go" is fine, even for a want.
Mention the trade-off in their terms when it helps (days of their budget, or how it affects what they are saving for), using only the numbers given.
Verdict: "go" when it is a reasonable purchase, "wait" when sleeping on it for a few days would help, "skip" when it is likely to be regretted.
Keep the reason to one or two kind, non-judgmental sentences, like a friend who is good with money. Suggest a realistic cheaper alternative when there is one (second-hand, a cheaper brand, borrowing, a free option), otherwise null. Ask up to 3 short questions the user can ask themselves before buying. Do not lecture.`;

const REVIEW_SYSTEM = `You write a short monthly money review inside Xpense, a budgeting app that helps people keep money safe for needs and spend less on wants. ${AUDIENCE} You receive this month's totals (and last month's needs and wants, when known, and what they are saving for, when given).
Use only the numbers given; do not invent figures. Be warm, specific and brief, like a supportive friend who is good with money.
safety_score (0-100) reflects: saving at least the savings goal (income minus spending), spending staying within income, and how much of spending went to needs rather than wants. Around 50 is an average month.
Tips must be specific to the categories that drove the wants, and practical this week.`;

/** The buy-check question, with the person's budget this month when the app sent it (numbers only). */
export function checkPrompt(req: CheckRequest): string {
  const lines = [`Item: ${req.item}`, `Price: ${req.price} ${req.currency}`];
  const b = req.budget;
  if (b) {
    lines.push('', `Their budget this month (${req.currency}):`);
    lines.push(`- Safe to spend for the rest of the month: ${b.safe_to_spend}, with ${b.days_left} ${b.days_left === 1 ? 'day' : 'days'} left`);
    lines.push(`- Already spent on wants this month: ${b.wants_so_far}`);
    if (b.monthly_income !== null) lines.push(`- Monthly take-home pay: ${b.monthly_income}`);
    if (b.hourly_pay !== null) lines.push(`- Pay per hour of work: ${b.hourly_pay}`);
    if (b.savings_goal !== null) lines.push(`- Saving each month: ${b.savings_goal}${b.saving_for ? ` (for ${b.saving_for})` : ''}`);
    else if (b.saving_for) lines.push(`- Saving up for: ${b.saving_for}`);
  }
  return lines.join('\n');
}

export function createClaude(apiKey: string, client?: Anthropic): AIProvider {
  // `timeout` bounds the wait for the response to start; DEADLINE_MS bounds the whole answer.
  const anthropic = client ?? new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

  async function ask<T>(
    schema: z.ZodType<T>,
    system: string,
    content: Anthropic.ContentBlockParam[],
    maxTokens: number,
  ): Promise<T> {
    const signal = AbortSignal.timeout(DEADLINE_MS);
    for (let attempt = 1; ; attempt++) {
      let message;
      try {
        // Streamed: at max effort the model may think for many thousands of tokens before answering.
        message = await anthropic.messages
          .stream(
            {
              model: MODEL,
              max_tokens: maxTokens,
              system,
              messages: [{ role: 'user', content }],
              output_config: { effort: EFFORT, format: zodOutputFormat(schema as z.ZodType<T> & z.ZodObject) },
            },
            { signal },
          )
          .finalMessage();
      } catch (e) {
        if (e instanceof Anthropic.APIUserAbortError || signal.aborted) {
          throw new AIError(504, 'ai_timeout', 'The AI took too long to answer. Please try again.');
        }
        if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) {
          throw new AIError(503, 'ai_busy', 'The AI is busy right now. Please try again in a moment.');
        }
        if (e instanceof Anthropic.APIConnectionError) {
          throw new AIError(503, 'ai_unreachable', 'Couldn’t reach the AI service. Please try again.');
        }
        if (e instanceof Anthropic.APIError) {
          console.error('[claude]', e.status, e.message);
          throw new AIError(502, 'ai_error', 'The AI service had a problem. Please try again.');
        }
        throw e;
      }
      if (message.stop_reason === 'refusal') {
        throw new AIError(422, 'ai_declined', 'The AI couldn’t help with this one. Please enter it manually.');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new AIError(422, 'too_long', 'This is too long to read in one go. Try photographing it in two parts.');
      }
      if (message.parsed_output) return message.parsed_output as T;
      // At the highest effort levels the model can occasionally end with its whole answer in thinking; ask once more.
      if (attempt >= 2) throw new AIError(502, 'ai_parse_failed', 'The AI answer was incomplete. Please try again.');
    }
  }

  return {
    scanReceipt: (req) =>
      ask(
        ReceiptSchema,
        RECEIPT_SYSTEM,
        [
          { type: 'image', source: { type: 'base64', media_type: req.media_type, data: req.image_base64 } },
          { type: 'text', text: `Today is ${req.today}. The user's currency is ${req.currency} and their locale is ${req.locale}.` },
        ],
        32_000,
      ),
    checkPurchase: (req) => ask(CheckSchema, CHECK_SYSTEM, [{ type: 'text', text: checkPrompt(req) }], 16_000),
    monthlyReview: (req) =>
      ask(ReviewSchema, REVIEW_SYSTEM, [{ type: 'text', text: JSON.stringify(req) }], 16_000),
    checkKey: async () => {
      try {
        await anthropic.models.list({ limit: 1 });
        return 'ok';
      } catch (e) {
        return e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError ? 'invalid' : 'unreachable';
      }
    },
  };
}
