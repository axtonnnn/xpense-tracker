// Schemas shared by the app and the Cloudflare Worker.
// The Worker hands these to Claude as structured-output formats; the app re-validates every response.
import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'housing',
  'utilities',
  'groceries',
  'health',
  'transport',
  'insurance',
  'debt',
  'education',
  'childcare',
  'dining',
  'entertainment',
  'shopping',
  'subscriptions',
  'travel',
  'personal_care',
  'gifts',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const NECESSITIES = ['need', 'want'] as const;
export type Necessity = (typeof NECESSITIES)[number];

export const ReceiptItemSchema = z.object({
  name: z.string().describe('Item name as printed, cleaned up for readability'),
  quantity: z.number().nullable().describe('Quantity if printed, otherwise null'),
  total_price: z
    .number()
    .describe('Line total in the document currency as a plain number; negative for discounts'),
  category: z.enum(EXPENSE_CATEGORIES),
  necessity: z.enum(NECESSITIES),
  reason: z.string().describe('At most 8 neutral words explaining the need/want call'),
});
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

export const ReceiptSchema = z.object({
  is_financial_document: z
    .boolean()
    .describe('False if the image is not a receipt, bill or invoice'),
  doc_type: z.enum(['receipt', 'bill', 'invoice', 'other']),
  merchant: z.string().nullable(),
  date: z.string().nullable().describe('Purchase or statement date as YYYY-MM-DD'),
  due_date: z.string().nullable().describe('Payment due date for bills as YYYY-MM-DD'),
  currency: z.string().nullable().describe('ISO 4217 code, e.g. USD'),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  total: z.number().nullable().describe('Grand total actually paid or due'),
  category: z.enum(EXPENSE_CATEGORIES).describe('Best category for the document as a whole'),
  necessity: z.enum(NECESSITIES).describe('Need/want for the document as a whole'),
  items: z.array(ReceiptItemSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable().describe('Anything the user should double-check'),
});
export type ReceiptResult = z.infer<typeof ReceiptSchema>;

export const ScanRequestSchema = z.object({
  image_base64: z.string().min(100),
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  currency: z.string().length(3),
  locale: z.string().max(35),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/** The person's budget this month, as plain numbers, so the buy check can answer for their situation. */
export const BudgetContextSchema = z.object({
  safe_to_spend: z.number().describe('What is left to spend this month after the savings goal and bills still due'),
  days_left: z.number().int().min(1).max(31),
  monthly_income: z.number().nullable(),
  hourly_pay: z.number().nullable(),
  savings_goal: z.number().nullable(),
  saving_for: z.string().max(60).nullable().describe('What they are saving up for, in their own words'),
  wants_so_far: z.number().describe('Spent on wants so far this month'),
});
export type BudgetContext = z.infer<typeof BudgetContextSchema>;

export const CheckRequestSchema = z.object({
  item: z.string().min(1).max(200),
  price: z.number().positive(),
  currency: z.string().length(3),
  budget: BudgetContextSchema.nullable().optional(),
});
export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export const CheckSchema = z.object({
  necessity: z.enum(NECESSITIES),
  verdict: z
    .enum(['go', 'wait', 'skip'])
    .describe('go = reasonable now, wait = sleep on it, skip = likely regret'),
  reason: z.string().describe('One or two calm, non-judgmental sentences'),
  cheaper_alternative: z.string().nullable(),
  questions: z.array(z.string()).describe('Up to 3 short questions to ask yourself before buying'),
});
export type CheckResult = z.infer<typeof CheckSchema>;

const CategoryTotalSchema = z.object({
  category: z.string().max(40),
  need: z.number(),
  want: z.number(),
});

export const ReviewRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  currency: z.string().length(3),
  income: z.number(),
  spent: z.number(),
  need: z.number(),
  want: z.number(),
  savings_goal: z.number(),
  saving_for: z.string().max(60).nullable().optional(),
  previous: z.object({ need: z.number(), want: z.number() }).nullable(),
  categories: z.array(CategoryTotalSchema).max(40),
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const ReviewSchema = z.object({
  headline: z.string().describe('Under 60 characters, encouraging'),
  summary: z.string().describe('Two or three plain-language sentences about needs vs wants'),
  tips: z.array(z.string()).describe('Exactly 3 specific, practical tips'),
  safety_score: z
    .number()
    .describe('0-100: how safely this month was managed (savings, needs share, staying in budget)'),
});
export type ReviewResult = z.infer<typeof ReviewSchema>;

export type ApiErrorBody = { error: { code: string; message: string } };
export type ScanResponse = { receipt: ReceiptResult; trial_remaining: number | null };
