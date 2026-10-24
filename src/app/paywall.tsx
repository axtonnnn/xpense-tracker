import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/brand';
import { AppText, Banner, Button, Card, IconCircle, Row, type IconName } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { usePro } from '@/lib/pro';
import { radius, space, useColors } from '@/theme/tokens';

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
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const pro = usePro();
  const packages = pro.offering?.availablePackages ?? [];
  const [picked, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default to the yearly plan (best value) until the user picks one.
  const selected = picked ?? packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ?? packages[0] ?? null;
  const saving = yearlySaving(packages);

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
  const BENEFITS: { icon: IconName; text: string; tint: [string, string] }[] = [
    { icon: 'scan', text: 'Unlimited AI receipt & bill scanning', tint: [c.primarySoft, c.primary] },
    { icon: 'bag-handle', text: '“Should I buy this?” before you spend', tint: [c.wantSoft, c.wantInk] },
    { icon: 'sparkles', text: 'Monthly AI review with a safety score', tint: [c.primarySoft, c.primary] },
    { icon: 'stats-chart', text: '6-month & yearly trends, spending by category', tint: [c.incomeSoft, c.income] },
    { icon: 'repeat', text: 'Unlimited repeating bills & income', tint: [c.needSoft, c.needInk] },
    { icon: 'download', text: 'CSV export & your own categories', tint: [c.surfaceAlt, c.inkMuted] },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[c.heroTop, c.heroBottom]} style={[styles.header, { paddingTop: insets.top + space.lg }]}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={12} style={[styles.close, { top: insets.top + space.md }]}>
            <Ionicons name="close" size={22} color={c.onHero} />
          </Pressable>
          <AppIcon size={84} />
          <AppText variant="display" color={c.onHero} center>
            Xpense Pro
          </AppText>
          <AppText color={c.onHeroMuted} center>
            {(feature && FEATURE_TITLE[feature]) || 'Spend on what matters. Let AI do the busywork.'}
          </AppText>
        </LinearGradient>

        <View style={{ padding: space.lg, gap: space.lg, marginTop: -space.xl }}>
          <Card style={{ gap: space.md }}>
            {BENEFITS.map((b) => (
              <Row key={b.text} style={{ gap: space.md }}>
                <IconCircle icon={b.icon} size={34} bg={b.tint[0]} color={b.tint[1]} />
                <AppText weight="semibold" style={{ flex: 1 }}>
                  {b.text}
                </AppText>
              </Row>
            ))}
          </Card>

          {packages.length > 0 ? (
            <View style={{ gap: space.sm }}>
              {packages.map((p) => {
                const active = selected?.identifier === p.identifier;
                const t = trialText(p);
                const annual = p.packageType === PACKAGE_TYPE.ANNUAL;
                return (
                  <Pressable
                    key={p.identifier}
                    onPress={() => setSelected(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.plan,
                      { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface, borderWidth: active ? 2 : 1 },
                    ]}>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? c.primary : c.inkMuted} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Row style={{ gap: 6 }}>
                        <AppText weight="bold">{periodLabel(p)}</AppText>
                        {annual && saving !== null && (
                          <View style={[styles.saveBadge, { backgroundColor: c.gold }]}>
                            <AppText variant="caption" weight="extrabold" color={c.heroBottom} style={{ fontSize: 11, lineHeight: 14 }}>
                              BEST VALUE · SAVE {saving}%
                            </AppText>
                          </View>
                        )}
                      </Row>
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
                    <AppText weight="extrabold">
                      {p.product.priceString}
                      <AppText variant="caption" muted>
                        {' '}
                        {perLabel(p)}
                      </AppText>
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

          <Button title={trial ? `Start ${trial}` : 'Subscribe'} icon="sparkles" onPress={buy} loading={busy === 'buy'} disabled={!selected} />
          <Button title="Restore purchases" kind="ghost" onPress={restore} loading={busy === 'restore'} disabled={!pro.storeReady} />

          <AppText variant="caption" muted center>
            {selected
              ? `${trial ? `After the ${trial}, ` : ''}${selected.product.priceString} ${perLabel(selected)} is charged to your App Store or Google Play account. `
              : ''}
            The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time
            in your account settings.
          </AppText>
          <Row style={{ justifyContent: 'center', gap: space.lg }}>
            {TERMS_URL ? (
              <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
                <AppText variant="caption" weight="bold" color={c.primary}>
                  Terms of Use
                </AppText>
              </Pressable>
            ) : null}
            {PRIVACY_URL ? (
              <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                <AppText variant="caption" weight="bold" color={c.primary}>
                  Privacy Policy
                </AppText>
              </Pressable>
            ) : null}
          </Row>
          {__DEV__ && !PRIVACY_URL && (
            <Banner tone="warn" icon="construct-outline">
              Developer note: set extra.privacyUrl (and termsUrl) in app.json. App Review needs both links on this screen.
            </Banner>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl + space.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  close: {
    position: 'absolute',
    right: space.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,244,238,0.14)',
  },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.lg },
  saveBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
