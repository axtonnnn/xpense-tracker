import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Banner, Button, Row, Screen, type IconName } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { usePro } from '@/lib/pro';
import { radius, space, useColors } from '@/theme/tokens';

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'scan-outline', text: 'Unlimited AI receipt & bill scanning' },
  { icon: 'help-circle-outline', text: '“Should I buy this?” checks before you spend' },
  { icon: 'sparkles-outline', text: 'Monthly AI review with a safety score' },
  { icon: 'stats-chart-outline', text: '6-month & yearly progress, spending by category' },
  { icon: 'repeat-outline', text: 'Unlimited repeating bills & income' },
  { icon: 'download-outline', text: 'CSV export & your own categories' },
];

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

export default function Paywall() {
  const c = useColors();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const pro = usePro();
  const packages = pro.offering?.availablePackages ?? [];
  const [picked, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default to the yearly plan (best value) until the user picks one.
  const selected = picked ?? packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ?? packages[0] ?? null;

  useEffect(() => {
    if (pro.isPro) router.back();
  }, [pro.isPro]);

  const buy = async () => {
    if (!selected) return;
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

  const trial = selected ? trialText(selected) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={12}>
          <Ionicons name="close" size={28} color={c.inkMuted} />
        </Pressable>
      </Row>
      <Screen contentStyle={{ paddingTop: 0 }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <View style={[styles.badge, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="shield-checkmark" size={34} color={c.primary} />
            <Ionicons name="sparkles" size={16} color={c.pro} style={{ position: 'absolute', top: 10, right: 10 }} />
          </View>
          <AppText variant="display">Xpense Pro</AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            {(feature && FEATURE_TITLE[feature]) || 'Spend on what matters. Let AI do the busywork.'}
          </AppText>
        </View>

        <View style={{ gap: space.md }}>
          {BENEFITS.map((b) => (
            <Row key={b.text} style={{ gap: space.md }}>
              <Ionicons name={b.icon} size={20} color={c.primary} />
              <AppText style={{ flex: 1 }}>{b.text}</AppText>
            </Row>
          ))}
        </View>

        {packages.length > 0 ? (
          <View style={{ gap: space.sm }}>
            {packages.map((p) => {
              const active = selected?.identifier === p.identifier;
              const t = trialText(p);
              return (
                <Pressable
                  key={p.identifier}
                  onPress={() => setSelected(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.plan,
                    { borderColor: active ? c.primary : c.border, backgroundColor: c.surface, borderWidth: active ? 2 : 1 },
                  ]}>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? c.primary : c.inkMuted} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '700' }}>{periodLabel(p)}</AppText>
                    {t && (
                      <AppText variant="caption" muted>
                        {t}
                      </AppText>
                    )}
                    {p.packageType === PACKAGE_TYPE.ANNUAL && p.product.pricePerMonthString && (
                      <AppText variant="caption" muted>
                        Just {p.product.pricePerMonthString} a month
                      </AppText>
                    )}
                  </View>
                  <AppText style={{ fontWeight: '700' }}>
                    {p.product.priceString} {perLabel(p)}
                  </AppText>
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

        <Button
          title={trial ? `Start ${trial}` : 'Subscribe'}
          icon="sparkles"
          onPress={buy}
          loading={busy === 'buy'}
          disabled={!selected}
        />
        <Button title="Restore purchases" kind="ghost" onPress={restore} loading={busy === 'restore'} disabled={!pro.storeReady} />

        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          {selected
            ? `${trial ? `After the ${trial}, ` : ''}${selected.product.priceString} ${perLabel(selected)} is charged to your App Store or Google Play account. `
            : ''}
          The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage
          or cancel any time in your account settings.
        </AppText>
        <Row style={{ justifyContent: 'center', gap: space.lg }}>
          {TERMS_URL ? (
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
              <AppText variant="caption" color={c.primary} style={{ fontWeight: '700' }}>
                Terms of Use
              </AppText>
            </Pressable>
          ) : null}
          {PRIVACY_URL ? (
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
              <AppText variant="caption" color={c.primary} style={{ fontWeight: '700' }}>
                Privacy Policy
              </AppText>
            </Pressable>
          ) : null}
        </Row>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.lg },
});
