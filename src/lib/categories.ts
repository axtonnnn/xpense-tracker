import { EXPENSE_CATEGORIES, type ExpenseCategory, type Necessity } from '../../shared/schemas';

export const INCOME_CATEGORIES = ['salary', 'side_income', 'allowance', 'gift_received', 'refund', 'other_income'] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export type CategoryInfo = { label: string; necessity?: Necessity };

// Worded for people on their first paychecks: rent and bills rather than mortgages and utilities.
export const CATEGORY_INFO: Record<ExpenseCategory | IncomeCategory, CategoryInfo> = {
  housing: { label: 'Rent & home', necessity: 'need' },
  utilities: { label: 'Bills & phone', necessity: 'need' },
  groceries: { label: 'Groceries', necessity: 'need' },
  health: { label: 'Health', necessity: 'need' },
  transport: { label: 'Transport', necessity: 'need' },
  insurance: { label: 'Insurance', necessity: 'need' },
  debt: { label: 'Loans & debt', necessity: 'need' },
  education: { label: 'School & work', necessity: 'need' },
  childcare: { label: 'Childcare', necessity: 'need' },
  dining: { label: 'Eating out', necessity: 'want' },
  entertainment: { label: 'Fun', necessity: 'want' },
  shopping: { label: 'Shopping', necessity: 'want' },
  subscriptions: { label: 'Subscriptions', necessity: 'want' },
  travel: { label: 'Travel', necessity: 'want' },
  personal_care: { label: 'Self-care', necessity: 'want' },
  gifts: { label: 'Gifts', necessity: 'want' },
  other: { label: 'Other', necessity: 'want' },
  salary: { label: 'Paycheck' },
  side_income: { label: 'Side gigs' },
  allowance: { label: 'Allowance' },
  gift_received: { label: 'Gift' },
  refund: { label: 'Refund' },
  other_income: { label: 'Other' },
};

/** The order categories are offered in when adding an entry: the everyday ones first. */
export const EXPENSE_PICKER_ORDER: ExpenseCategory[] = [
  'groceries', 'dining', 'transport', 'housing', 'utilities', 'subscriptions', 'shopping', 'entertainment',
  'health', 'education', 'personal_care', 'gifts', 'travel', 'debt', 'insurance', 'childcare', 'other',
];

/** Custom categories (Pro) live in settings as JSON; their ids start with "custom:". */
export type CustomCategory = { id: string; label: string; necessity: Necessity };

export function parseCustomCategories(json: string | undefined): CustomCategory[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c.id === 'string') : [];
  } catch {
    return [];
  }
}

export function categoryInfo(id: string, custom: CustomCategory[] = []): CategoryInfo {
  if (id in CATEGORY_INFO) return CATEGORY_INFO[id as ExpenseCategory];
  const c = custom.find((x) => x.id === id);
  if (c) return { label: c.label, necessity: c.necessity };
  return { label: id.replace(/^custom:/, '').replace(/_/g, ' ') };
}

export function defaultNecessity(category: string, custom: CustomCategory[] = []): Necessity {
  return categoryInfo(category, custom).necessity ?? 'want';
}

export { EXPENSE_CATEGORIES };
