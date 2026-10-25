import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/brand';
import { NeedMark, PageFill, SketchFrame, Stamp } from '@/components/sketch';
import { AppText, Banner, Button, Row, TextLink } from '@/components/ui';
import { PRIVACY_URL, PRO_MONTHLY_SCANS, TERMS_URL } from '@/lib/config';
import { notify } from '@/lib/confirm';
import { PREVIEW_PLANS } from '@/lib/preview-plans';
import { usePro } from '@/lib/pro';
import { colors, space } from '@/theme/tokens';

const FEATURE_TITLE: Record<string, string> = {
  ai_scan: 'You’ve used your free scans',
  ai_check: '“Should I buy this?” is a Pro feature',
  ai_review: 'Monthly AI review is a Pro feature',
  long_range_charts: 'Long-range charts are a Pro feature',
  category_breakdown: 'Category breakdown is a Pro feature',
  unlimited_recurring: 'Free plan includes 3 repeating items',
  csv_export: 'CSV export is a Pro feature',
  custom_categories: 'Custom categories are a Pro feature',
};

function periodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return 'Yearly';
    case PACKAGE_TYPE.MONTHLY:
      return 'Monthly';
    case PACKAGE_TYPE.WEEKLY:
      return 'Weekly';
    case PACKAGE_TYPE.LIFETIME:
      return 'Lifetime';
    default:
      return pkg.product.title;
  }
}

function perLabel(pkg: PurchasesPackage): string {
  return { ANNUAL: '/ year', MONTHLY: '/ month', WEEKLY: '/ week', LIFETIME: 'once' }[pkg.packageType as string] ?? '';
}

function trialText(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price > 0) return null;
  const unit = intro.periodUnit.toLowerCase().replace(/s$/, '');
  return `${intro.periodNumberOfUnits}-${unit} free trial`;
}

/** How much cheaper the yearly plan is than paying monthly for a year, in whole percent. */
function yearlySaving(packages: PurchasesPackage[]): number | null {
  const monthly = packages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  const annual = packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
  if (!monthly || !annual || monthly.product.price <= 0) return null;
  const pct = Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100);
  return pct > 0 ? pct : null;
}

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const pro = usePro();
  // Development builds without a store (Expo Go, web) show stand-in plans so the screen can be tried.
  const preview = __DEV__ && !pro.storeReady;
  const packages = preview ? PREVIEW_PLANS : (pro.offering?.availablePackages ?? []);
  const trialFor = (p: PurchasesPackage) => (preview || pro.trialEligible(p.product.identifier) ? trialText(p) : null);
  const previewOnly = () =>
    notify('Preview only', 'Purchases work in TestFlight and App Store builds. To try Pro here, turn on Settings → Developer → Simulate Pro.');
  const [picked, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default to the yearly plan (best value) until the user picks one.
  const selected = picked ?? packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ?? packages[0] ?? null;
  const saving = yearlySaving(packages);

  // Opened from a link there may be nothing behind the paywall to go back to.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (pro.isPro) close();
  }, [pro.isPro]);

  const buy = async () => {
    if (!selected) return;
    if (preview) return previewOnly();
    setError(null);
    setBusy('buy');
    try {
      await pro.purchase(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The purchase didn’t go through. You have not been charged.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (preview) return previewOnly();
    setError(null);
    setBusy('restore');
    try {
      const ok = await pro.restore();
      if (!ok) setError('No active Pro subscription was found for this account.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const trial = selected ? trialFor(selected) : null;
  const BENEFITS = [
    `Up to ${PRO_MONTHLY_SCANS} AI receipt and bill scans a month`,
    '“Should I buy this?”, checked against your own budget',
    'A short monthly review with three tips',
    'Six-month and yearly trends, spending by category',
    'Unlimited repeating bills and paychecks',
    'CSV export and your own categories',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: 24, width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 }}
        showsVerticalScrollIndicator={false}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </Pressable>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <AppIcon size={84} />
          <AppText variant="display" center>
            Xpense Pro
          </AppText>
          <AppText muted center>
            {(feature && FEATURE_TITLE[feature]) || 'Spend on what matters. Let the AI do the busywork.'}
          </AppText>
        </View>

        <View style={{ gap: 12 }}>
          {BENEFITS.map((b) => (
            <Row key={b} style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={{ marginTop: 6 }}>
                <NeedMark size={9} />
              </View>
              <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{b}</AppText>
            </Row>
          ))}
        </View>

        {packages.length > 0 ? (
          <View style={{ gap: 12 }}>
            {packages.map((p) => {
              const active = selected?.identifier === p.identifier;
              const t = trialFor(p);
              const annual = p.packageType === PACKAGE_TYPE.ANNUAL;
              return (
                <Pressable
                  key={p.identifier}
                  onPress={() => setSelected(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={styles.plan}>
                  <PageFill />
                  <SketchFrame seed={annual ? 401 : 403} weight={active ? 2.2 : 1.2} opacity={active ? 1 : 0.5} twice={active} />
                  <View style={[styles.radio, active && { backgroundColor: colors.ink }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText weight="semibold">{periodLabel(p)}</AppText>
                    {t && (
                      <AppText variant="caption" muted>
                        {t}
                      </AppText>
                    )}
                    {annual && p.product.pricePerMonthString && (
                      <AppText variant="caption" muted>
                        Just {p.product.pricePerMonthString} a month
                      </AppText>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <AppText weight="semibold">
                      {p.product.priceString}
                      <AppText variant="caption" muted>
                        {' '}
                        {perLabel(p)}
                      </AppText>
                    </AppText>
                    {annual && saving !== null && <Stamp label={`save ${saving}%`} tilt={-4} style={{ paddingHorizontal: 8 }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Banner>
            {pro.storeReady
              ? 'Plans are loading. Check your connection and try again.'
              : 'Purchases aren’t available in this build. Install the App Store version to subscribe.'}
          </Banner>
        )}

        {error && <Banner tone="danger">{error}</Banner>}

        <Button title={trial ? `Start ${trial}` : 'Subscribe'} onPress={buy} loading={busy === 'buy'} disabled={!selected} />
        <Button title="Restore purchases" kind="ghost" onPress={restore} loading={busy === 'restore'} disabled={!pro.storeReady && !preview} />

        <AppText variant="caption" faint center>
          {selected
            ? `${trial ? `After the ${trial}, ` : ''}${selected.product.priceString} ${perLabel(selected)} is charged to your App Store or Google Play account. `
            : ''}
          The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in
          your account settings.
        </AppText>
        <Row style={{ justifyContent: 'center', gap: space.lg }}>
          {TERMS_URL ? <TextLink label="Terms of Use" onPress={() => Linking.openURL(TERMS_URL)} /> : null}
          {PRIVACY_URL ? <TextLink label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
        </Row>
        {__DEV__ && !PRIVACY_URL && (
          <Banner tone="warn">
            Developer note: the Terms and Privacy links appear once extra.apiUrl in app.json points at your AI server, which hosts both pages. App
            Review needs them on this screen.
          </Banner>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-end', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: -space.xl },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.4, borderColor: colors.ink },
});
