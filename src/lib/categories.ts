import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import { EXPENSE_CATEGORIES, type ExpenseCategory, type Necessity } from '../../shared/schemas';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const INCOME_CATEGORIES = ['salary', 'side_income', 'gift_received', 'refund', 'other_income'] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export type CategoryInfo = { label: string; icon: IconName; necessity?: Necessity };

export const CATEGORY_INFO: Record<ExpenseCategory | IncomeCategory, CategoryInfo> = {
  housing: { label: 'Housing', icon: 'home-outline', necessity: 'need' },
  utilities: { label: 'Utilities', icon: 'flash-outline', necessity: 'need' },
  groceries: { label: 'Groceries', icon: 'basket-outline', necessity: 'need' },
  health: { label: 'Health', icon: 'medkit-outline', necessity: 'need' },
  transport: { label: 'Transport', icon: 'bus-outline', necessity: 'need' },
  insurance: { label: 'Insurance', icon: 'shield-checkmark-outline', necessity: 'need' },
  debt: { label: 'Debt', icon: 'card-outline', necessity: 'need' },
  education: { label: 'Education', icon: 'school-outline', necessity: 'need' },
  childcare: { label: 'Childcare', icon: 'happy-outline', necessity: 'need' },
  dining: { label: 'Dining out', icon: 'restaurant-outline', necessity: 'want' },
  entertainment: { label: 'Fun', icon: 'game-controller-outline', necessity: 'want' },
  shopping: { label: 'Shopping', icon: 'bag-handle-outline', necessity: 'want' },
  subscriptions: { label: 'Subscriptions', icon: 'repeat-outline', necessity: 'want' },
  travel: { label: 'Travel', icon: 'airplane-outline', necessity: 'want' },
  personal_care: { label: 'Personal care', icon: 'sparkles-outline', necessity: 'want' },
  gifts: { label: 'Gifts', icon: 'gift-outline', necessity: 'want' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-circle-outline', necessity: 'want' },
  salary: { label: 'Salary', icon: 'briefcase-outline' },
  side_income: { label: 'Side income', icon: 'trending-up-outline' },
  gift_received: { label: 'Gift', icon: 'gift-outline' },
  refund: { label: 'Refund', icon: 'return-down-back-outline' },
  other_income: { label: 'Other', icon: 'cash-outline' },
};

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
  if (c) return { label: c.label, icon: 'pricetag-outline', necessity: c.necessity };
  return { label: id.replace(/^custom:/, '').replace(/_/g, ' '), icon: 'pricetag-outline' };
}

export function defaultNecessity(category: string, custom: CustomCategory[] = []): Necessity {
  return categoryInfo(category, custom).necessity ?? 'want';
}

export { EXPENSE_CATEGORIES };
