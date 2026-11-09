import type { PurchasesPackage } from 'react-native-purchases';

// Stand-in plans for development builds that can't reach a store (Expo Go, web), so the paywall can be
// seen and screenshotted as it will look. The prices match the ones LAUNCH.md sets in App Store Connect.
// Only the fields the paywall reads are filled in.
const plan = (
  packageType: 'MONTHLY' | 'ANNUAL',
  identifier: string,
  price: number,
  priceString: string,
  extra: Record<string, unknown> = {},
) =>
  ({
    identifier: `$rc_${packageType === 'ANNUAL' ? 'annual' : 'monthly'}`,
    packageType,
    product: { identifier, title: `Xpense Pro ${packageType === 'ANNUAL' ? 'Yearly' : 'Monthly'}`, price, priceString, introPrice: null, ...extra },
  }) as unknown as PurchasesPackage;

export const PREVIEW_PLANS: PurchasesPackage[] = [
  plan('ANNUAL', 'xpense_pro_yearly', 19.99, '$19.99', {
    pricePerMonthString: '$1.67',
    introPrice: { price: 0, priceString: '$0.00', cycles: 1, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1 },
  }),
  plan('MONTHLY', 'xpense_pro_monthly', 2.99, '$2.99'),
];
