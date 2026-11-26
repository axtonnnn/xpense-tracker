// Pure scheduling logic for recurring income and bills.
import { addDays, addMonths, parseISODate } from './dates';

export type Cadence = 'weekly' | 'biweekly' | 'monthly';

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export type RecurringRule = {
  id: string;
  type: 'expense' | 'income';
  amount_cents: number;
  cadence: Cadence;
  anchor_on: string;
  next_on: string;
  active: number;
};

export function nextOccurrence(date: string, cadence: Cadence, anchorOn: string): string {
  switch (cadence) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonths(date, 1, parseISODate(anchorOn).getDate());
  }
}

/** Every occurrence date that is due on or before `today`, plus the rule's new next date. */
export function dueOccurrences(rule: RecurringRule, today: string, max = 120): { dates: string[]; nextOn: string } {
  const dates: string[] = [];
  let next = rule.next_on;
  while (rule.active && next <= today && dates.length < max) {
    dates.push(next);
    next = nextOccurrence(next, rule.cadence, rule.anchor_on);
  }
  return { dates, nextOn: next };
}

/** Occurrences strictly after `after` and on or before `until`, e.g. the bills still to come this month. */
export function upcomingOccurrences(rule: RecurringRule, after: string, until: string, max = 60): string[] {
  const out: string[] = [];
  let next = rule.next_on;
  let guard = 0;
  while (rule.active && next <= until && guard++ < max) {
    if (next > after) out.push(next);
    next = nextOccurrence(next, rule.cadence, rule.anchor_on);
  }
  return out;
}

/** Where a resumed rule picks up: its first date on or after `today`, so nothing missed while paused is booked. */
export function resumeOn(rule: Pick<RecurringRule, 'next_on' | 'cadence' | 'anchor_on'>, today: string): string {
  let next = rule.next_on;
  while (next < today) next = nextOccurrence(next, rule.cadence, rule.anchor_on);
  return next;
}

/** Rough monthly equivalent of a rule, used for expected income. */
export function monthlyEquivalent(rule: Pick<RecurringRule, 'amount_cents' | 'cadence'>): number {
  switch (rule.cadence) {
    case 'weekly':
      return Math.round((rule.amount_cents * 52) / 12);
    case 'biweekly':
      return Math.round((rule.amount_cents * 26) / 12);
    case 'monthly':
      return rule.amount_cents;
  }
}
