import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';

import { AppIcon } from '@/components/brand';
import { Mark } from '@/components/marks';
import { Appear, timing, useMotion } from '@/components/motion';
import { useToast } from '@/components/Toast';
import { AppText, Button, haptic, IconButton, Notice, Screen, TextLink } from '@/components/ui';
import { PRIVACY_URL, PRO_MONTHLY_SCANS, TERMS_URL } from '@/lib/config';
import { PREVIEW_PLANS } from '@/lib/preview-plans';
import { usePro } from '@/lib/pro';
import { colors, motion } from '@/theme/tokens';

const FEATURE_TITLE: Record<string, string> = {
  ai_scan: 'You’ve used your free scans. Pro keeps the AI reading your receipts.',
  ai_check: '“Should I buy this?” is part of Xpense Pro.',
  ai_review: 'The monthly review is part of Xpense Pro.',
  long_range_charts: 'Six-month and yearly trends are part of Xpense Pro.',
  category_breakdown: 'Spending by category is part of Xpense Pro.',
  unlimited_recurring: 'The free plan includes 3 repeating items. Pro has no limit.',
  csv_export: 'CSV export is part of Xpense Pro.',
  custom_categories: 'Your own categories are part of Xpense Pro.',
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

const BENEFITS = [
  `Up to ${PRO_MONTHLY_SCANS} receipt and bill scans a month`,
  '“Should I buy this?”, checked against your own budget',
  'A short monthly review with three tips',
  'Six-month and yearly trends, spending by category',
  'Unlimited repeating bills and paychecks',
  'CSV export and your own categories',
];

export default function Paywall() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const pro = usePro();
  const toast = useToast();
  // Development builds without a store (Expo Go, web) show stand-in plans so the screen can be tried.
  const preview = __DEV__ && !pro.storeReady;
  const packages = preview ? PREVIEW_PLANS : (pro.offering?.availablePackages ?? []);
  const trialFor = (p: PurchasesPackage) => (preview || pro.trialEligible(p.product.identifier) ? trialText(p) : null);
  const previewOnly = () => toast({ message: 'Purchases work in TestFlight and App Store builds. Settings → Developer → Simulate Pro tries it here.', quiet: true });
  const [picked, setPicked] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The yearly plan (best value) until the person picks one.
  const selected = picked ?? packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ?? packages[0] ?? null;
  const saving = yearlySaving(packages);

  // Opened from a link there may be nothing behind the paywall to go back to.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (pro.isPro) {
      haptic('success');
      close();
    }
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

  return (
    <Screen contentStyle={{ maxWidth: 520, paddingBottom: 40 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <IconButton icon="close" label="Close" onPress={close} style={{ marginRight: -10 }} />
      </View>
      <Appear>
        <AppIcon size={72} style={{ marginTop: 8 }} />
        <AppText weight="light" accessibilityRole="header" style={styles.title}>
          Xpense Pro
        </AppText>
        <AppText muted style={{ marginTop: 10 }}>
          {(feature && FEATURE_TITLE[feature]) || 'Spend on what matters. Let the AI do the busywork.'}
        </AppText>
      </Appear>

      <View style={{ marginTop: 28, gap: 12 }}>
        {BENEFITS.map((b, i) => (
          <Appear key={b} delay={60 + i * motion.rowStagger}>
            <View style={{ flexDirection: 'row' }}>
              <Mark kind="need" size={6} style={{ width: 20, paddingTop: 8 }} />
              <AppText style={{ flex: 1 }}>{b}</AppText>
            </View>
          </Appear>
        ))}
      </View>

      {packages.length > 0 ? (
        <View style={{ marginTop: 32, gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Plans">
          {packages.map((p) => {
            const t = trialFor(p);
            const annual = p.packageType === PACKAGE_TYPE.ANNUAL;
            const sub = [t, annual && p.product.pricePerMonthString ? `${p.product.pricePerMonthString} a month` : null].filter(Boolean).join(' · ');
            return (
              <Plan
                key={p.identifier}
                active={selected?.identifier === p.identifier}
                onPress={() => {
                  haptic('select');
                  setPicked(p);
                }}
                title={periodLabel(p)}
                sub={sub || (p.packageType === PACKAGE_TYPE.MONTHLY ? 'Cancel any time' : '')}
                price={p.product.priceString}
                per={perLabel(p)}
                tag={annual && saving !== null ? `SAVE ${saving}%` : null}
              />
            );
          })}
        </View>
      ) : (
        <Notice style={{ marginTop: 32 }}>
          {pro.storeReady ? 'Plans are loading. Check your connection and try again.' : 'Purchases aren’t available in this build. Install the App Store version to subscribe.'}
        </Notice>
      )}

      {error && (
        <Appear distance={4}>
          <Notice tone="alert" style={{ marginTop: 20 }}>
            {error}
          </Notice>
        </Appear>
      )}

      <Button title={trial ? `Start ${trial}` : 'Subscribe'} onPress={buy} loading={busy === 'buy'} disabled={!selected} style={{ marginTop: 24 }} />
      <TextLink label="Restore purchases" onPress={restore} style={{ alignSelf: 'center', marginTop: 8 }} />

      <AppText variant="small" muted center style={{ marginTop: 16, lineHeight: 17 }}>
        {selected ? `${trial ? `After the ${trial}, ` : ''}${selected.product.priceString} ${perLabel(selected)} is charged to your App Store or Google Play account. ` : ''}
        It renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your account
        settings.
      </AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 4 }}>
        {TERMS_URL ? <TextLink label="Terms of Use" small onPress={() => Linking.openURL(TERMS_URL)} style={{ minHeight: 40, justifyContent: 'center' }} /> : null}
        {PRIVACY_URL ? <TextLink label="Privacy Policy" small onPress={() => Linking.openURL(PRIVACY_URL)} style={{ minHeight: 40, justifyContent: 'center' }} /> : null}
      </View>
      {__DEV__ && !PRIVACY_URL && (
        <Notice style={{ marginTop: 16 }}>
          Developer note: the Terms and Privacy links appear once extra.apiUrl in app.json points at your AI server, which hosts both pages. App Review needs
          them on this screen.
        </Notice>
      )}
    </Screen>
  );
}

/** A plan to pick: the chosen one gets a heavier ink edge and a filled radio dot. */
function Plan({
  active,
  onPress,
  title,
  sub,
  price,
  per,
  tag,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  sub: string;
  price: string;
  per: string;
  tag: string | null;
}) {
  const moving = useMotion();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.set(moving ? withTiming(active ? 1 : 0, timing(motion.small)) : active ? 1 : 0);
  }, [active, moving, p]);
  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [colors.rule, colors.ink]),
    backgroundColor: interpolateColor(p.value, [0, 1], ['rgba(255,255,255,0)', colors.page]),
  }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`${title}, ${price} ${per}${sub ? `, ${sub}` : ''}`}>
      <Animated.View style={[styles.plan, { borderWidth: active ? 2 : 1, padding: active ? 15 : 16 }, edge]}>
        <View style={styles.radio}>
          <Animated.View style={[styles.radioDot, dot]} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="medium" style={{ lineHeight: 20 }}>
            {title}
          </AppText>
          {sub ? (
            <AppText variant="caption" muted>
              {sub}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <AppText weight="medium" style={{ lineHeight: 20 }}>
            {price}
            <AppText variant="caption" muted>
              {' '}
              {per}
            </AppText>
          </AppText>
          {tag && (
            <View style={styles.tag}>
              <AppText variant="axis" style={{ lineHeight: 14, letterSpacing: 0.6 }}>
                {tag}
              </AppText>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 48, lineHeight: 50, letterSpacing: -1.92, marginTop: 20 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  tag: { borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 6, paddingVertical: 2 },
});
