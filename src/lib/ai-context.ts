// What the AI is told about this month: plain numbers only (no entries, shops or notes).
import type { BudgetContext, ReviewRequest } from '../../shared/schemas';
import { categoryBreakdown, hourlyRateCents, totals, type MoneyTx, type SafeToSpend } from './budget';
import { addMonths, endOfMonth, monthKey, startOfMonth } from './dates';
import { fromCents } from './money';

type SettingsLike = { monthlyIncomeCents: number; savingsGoalCents: number; hoursPerWeek: number; savingFor: string; currency: string };
type GoalLike = { name: string; target_cents: number; saved: number } | null;

/** The buy check's view of this month, or null until there's an income to measure against. */
export function budgetContext(input: { safe: SafeToSpend; txs: MoneyTx[]; today: string; settings: SettingsLike; goal: GoalLike }): BudgetContext | null {
  const { safe, settings, goal } = input;
  if (safe.status === 'unset') return null;
  const month = totals(input.txs, startOfMonth(input.today), endOfMonth(input.today));
  const hourly = hourlyRateCents(settings.monthlyIncomeCents, settings.hoursPerWeek);
  return {
    safe_to_spend: fromCents(Math.max(0, safe.amount)),
    days_left: safe.daysLeft,
    monthly_income: safe.income > 0 ? fromCents(safe.income) : null,
    hourly_pay: hourly ? fromCents(hourly) : null,
    savings_goal: settings.savingsGoalCents > 0 ? fromCents(settings.savingsGoalCents) : null,
    saving_for: (goal?.name ?? settings.savingFor).trim().slice(0, 60) || null,
    wants_so_far: fromCents(month.want),
    goal_saved: goal ? fromCents(goal.saved) : null,
    goal_target: goal ? fromCents(goal.target_cents) : null,
  };
}

/** The monthly review's request: this month's totals by category, and last month's needs and wants. */
export function reviewRequest(input: { txs: MoneyTx[]; today: string; settings: SettingsLike; goal: GoalLike }): ReviewRequest {
  const { txs, today, settings } = input;
  const start = startOfMonth(today);
  const prevStart = addMonths(start, -1, 1);
  const cur = totals(txs, start, endOfMonth(today));
  const prev = totals(txs, prevStart, endOfMonth(prevStart));
  return {
    month: monthKey(today),
    currency: settings.currency,
    income: fromCents(Math.max(cur.income, settings.monthlyIncomeCents)),
    spent: fromCents(cur.spent),
    need: fromCents(cur.need),
    want: fromCents(cur.want),
    savings_goal: fromCents(settings.savingsGoalCents),
    saving_for: (input.goal?.name ?? settings.savingFor).trim().slice(0, 60) || null,
    previous: prev.spent > 0 ? { need: fromCents(prev.need), want: fromCents(prev.want) } : null,
    categories: categoryBreakdown(txs, start, endOfMonth(today)).map((b) => ({
      category: b.category.replace(/^custom:/, ''),
      need: fromCents(b.need),
      want: fromCents(b.want),
    })),
  };
}
