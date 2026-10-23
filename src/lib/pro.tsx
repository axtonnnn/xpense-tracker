import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { PRO_ENTITLEMENT, REVENUECAT_KEY } from './config';
import { getInstallId } from './install-id';
import { useSettings } from '@/db/settings';

type ProState = {
  isPro: boolean;
  /** True when RevenueCat is configured, so purchases can actually happen. */
  storeReady: boolean;
  offering: PurchasesOffering | null;
  managementURL: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manage: () => Promise<void>;
};

const ProContext = createContext<ProState | null>(null);

const hasPro = (info: CustomerInfo) => PRO_ENTITLEMENT in info.entitlements.active;

export function ProProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [entitled, setEntitled] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);

  const apply = useCallback((info: CustomerInfo) => {
    setEntitled(hasPro(info));
    setManagementURL(info.managementURL);
  }, []);

  useEffect(() => {
    if (!REVENUECAT_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        Purchases.configure({ apiKey: REVENUECAT_KEY, appUserID: await getInstallId() });
        Purchases.addCustomerInfoUpdateListener(apply);
        const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
        if (cancelled) return;
        apply(info);
        setOffering(offerings.current);
        setStoreReady(true);
      } catch (e) {
        console.warn('[pro] RevenueCat unavailable', e);
      }
    })();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(apply);
    };
  }, [apply]);

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

  const isPro = entitled || (__DEV__ && !!settings?.devPro);

  const value = useMemo(
    () => ({ isPro, storeReady, offering, managementURL, purchase, restore, manage }),
    [isPro, storeReady, offering, managementURL, purchase, restore, manage],
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
