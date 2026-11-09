// Sample AI answers for trying the app before the Worker is deployed (apiUrl: "demo", dev builds only).
import type { CheckRequest, CheckResult, ReceiptResult, ReviewResult } from '../../shared/schemas';
import { today } from './dates';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoReceipt(): Promise<ReceiptResult> {
  await wait(1200);
  return {
    is_financial_document: true,
    doc_type: 'receipt',
    merchant: 'Green Valley Market',
    date: today(),
    due_date: null,
    currency: 'USD',
    subtotal: 47.85,
    tax: 2.15,
    tip: null,
    total: 50.0,
    category: 'groceries',
    necessity: 'need',
    items: [
      { name: 'Whole milk 1 gal', quantity: 1, total_price: 4.29, category: 'groceries', necessity: 'need', reason: 'Basic food staple' },
      { name: 'Eggs, dozen', quantity: 1, total_price: 3.99, category: 'groceries', necessity: 'need', reason: 'Basic food staple' },
      { name: 'Chicken breast', quantity: 2, total_price: 12.58, category: 'groceries', necessity: 'need', reason: 'Protein for meals' },
      { name: 'Brown rice 2 lb', quantity: 1, total_price: 3.49, category: 'groceries', necessity: 'need', reason: 'Pantry staple' },
      { name: 'Craft soda 4-pack', quantity: 1, total_price: 7.99, category: 'groceries', necessity: 'want', reason: 'Treat, not essential' },
      { name: 'Chocolate bar', quantity: 3, total_price: 8.97, category: 'groceries', necessity: 'want', reason: 'Snack treat' },
      { name: 'Paper towels', quantity: 1, total_price: 6.54, category: 'groceries', necessity: 'need', reason: 'Household essential' },
    ],
    confidence: 'high',
    notes: null,
  };
}

export async function demoCheck(req: CheckRequest): Promise<CheckResult> {
  await wait(800);
  return {
    necessity: 'want',
    verdict: req.price > 100 ? 'wait' : 'go',
    reason: "This looks like a nice-to-have rather than an essential. If it still feels important in a few days, it's probably worth it.",
    cheaper_alternative: 'Look for a refurbished or second-hand option.',
    questions: ['Will I use it every week?', 'Do I already own something that does this?', 'Would I buy it at full price next month?'],
  };
}

export async function demoReview(): Promise<ReviewResult> {
  await wait(1000);
  return {
    headline: 'A steady month with room to save more',
    summary: 'Most of your spending went to needs, which is a strong base. Dining out was your biggest want this month.',
    tips: [
      'Plan two home-cooked dinners you can batch on Sunday.',
      'Move your savings on payday, before spending starts.',
      'Pause one subscription you used less than twice this month.',
    ],
    safety_score: 72,
  };
}
