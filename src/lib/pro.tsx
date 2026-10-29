import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { PRO_ENTITLEMENT, REVENUECAT_KEY } from './config';
import { useSettings } from '@/db/settings';

type ProState = {
  isPro: boolean;
  /** True when RevenueCat is configured, so purchases can actually happen. */
  storeReady: boolean;
  offering: PurchasesOffering | null;
  managementURL: string | null;
  /** Whether a product's free trial can be shown to this user (see the eligibility check below). */
  trialEligible: (productId: string) => boolean;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manage: () => Promise<void>;
};

const ProContext = createContext<ProState | null>(null);

const hasPro = (info: CustomerInfo) => PRO_ENTITLEMENT in info.entitlements.active;

// RevenueCat is configured once per app run; later accounts switch with logIn.
let configuredFor: string | null | undefined;

/**
 * Pro status for the signed-in account. RevenueCat knows each customer by their Xpense account id, so a
 * subscription follows the person to every device they sign in on (the AI server checks the same id).
 */
export function ProProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const settings = useSettings();
  const [entitled, setEntitled] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);

  const apply = useCallback((info: CustomerInfo) => {
    setEntitled(hasPro(info));
    setManagementURL(info.managementURL);
  }, []);

  useEffect(() => {
    if (!REVENUECAT_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const appUserID = userId === 'preview' ? null : userId;
        if (configuredFor === undefined) {
          Purchases.configure({ apiKey: REVENUECAT_KEY, appUserID });
        } else if (appUserID && configuredFor !== appUserID) {
          await Purchases.logIn(appUserID);
        }
        configuredFor = appUserID;
        Purchases.addCustomerInfoUpdateListener(apply);
        const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
        if (cancelled) return;
        apply(info);
        setOffering(offerings.current);
        setStoreReady(true);
        // iOS: only advertise a free trial the App Store will actually give (someone who already had one
        // pays from day one). An unknown answer shows the regular price. Google Play only includes the
        // trial in a product when the user is eligible, so Android needs no check.
        const ids = offerings.current?.availablePackages.map((p) => p.product.identifier) ?? [];
        if (Platform.OS === 'ios' && ids.length > 0) {
          const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids).catch(() => ({}) as Record<string, undefined>);
          const ELIGIBLE = Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
          if (!cancelled) setEligibleIds(ids.filter((id) => result[id]?.status === ELIGIBLE));
        }
      } catch (e) {
        console.warn('[pro] RevenueCat unavailable', e);
      }
    })();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(apply);
    };
  }, [apply, userId]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        apply(customerInfo);
        return hasPro(customerInfo);
      } catch (e) {
        if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
        throw e;
      }
    },
    [apply],
  );

  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    apply(info);
    return hasPro(info);
  }, [apply]);

  const manage = useCallback(async () => {
    if (managementURL) await Linking.openURL(managementURL);
    else if (storeReady) await Purchases.showManageSubscriptions();
  }, [managementURL, storeReady]);

  const trialEligible = useCallback((productId: string) => Platform.OS !== 'ios' || eligibleIds.includes(productId), [eligibleIds]);

  const isPro = entitled || (__DEV__ && !!settings?.devPro);

  const value = useMemo(
    () => ({ isPro, storeReady, offering, managementURL, trialEligible, purchase, restore, manage }),
    [isPro, storeReady, offering, managementURL, trialEligible, purchase, restore, manage],
  );
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProState {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside <ProProvider>');
  return ctx;
}

/** Returns a guard: call it before a Pro feature; it opens the paywall and returns false for free users. */
export function useRequirePro(): (feature: string) => boolean {
  const { isPro } = usePro();
  return useCallback(
    (feature: string) => {
      if (isPro) return true;
      router.push({ pathname: '/paywall', params: { feature } });
      return false;
    },
    [isPro],
  );
}
