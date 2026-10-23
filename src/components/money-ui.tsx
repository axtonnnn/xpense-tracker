// Money-specific building blocks: stat tiles, the safe-to-spend shield, transaction rows, toggles.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, Row, type IconName } from './ui';
import type { Necessity } from '../../shared/schemas';
import type { Tx } from '@/db/transactions';
import type { SafeToSpend } from '@/lib/budget';
import { categoryInfo, type CustomCategory } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import { radius, space, useColors } from '@/theme/tokens';

export function StatTile({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {delta}
    </View>
  );
}

const STATUS: Record<SafeToSpend['status'], { icon: IconName; label: string }> = {
  safe: { icon: 'shield-checkmark', label: 'On track' },
  tight: { icon: 'shield-half', label: 'Getting tight' },
  over: { icon: 'warning', label: 'Over budget' },
  unset: { icon: 'shield-outline', label: 'Add your income' },
};

export function ShieldCard({ safe, currency, onSetup }: { safe: SafeToSpend; currency: string; onSetup?: () => void }) {
  const c = useColors();
  const tone = { safe: c.need, tight: c.want, over: c.danger, unset: c.inkMuted }[safe.status];
  const s = STATUS[safe.status];
  return (
    <Card style={{ borderColor: tone, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" muted>
          Safe to spend this month
        </AppText>
        <Row style={{ gap: 4 }}>
          <Ionicons name={s.icon} size={16} color={tone} />
          <AppText variant="caption" style={{ fontWeight: '700' }}>
            {s.label}
          </AppText>
        </Row>
      </Row>
      {safe.status === 'unset' ? (
        <Pressable onPress={onSetup} accessibilityRole="button">
          <AppText muted>
            Set your monthly income in Settings to see how much you can safely spend each day.
          </AppText>
        </Pressable>
      ) : (
        <>
          <AppText variant="hero" color={safe.amount < 0 ? c.danger : c.ink}>
            {formatMoney(safe.amount, currency)}
          </AppText>
          <AppText muted>
            {safe.amount > 0
              ? `≈ ${formatMoney(safe.perDay, currency)} a day for the next ${safe.daysLeft} ${safe.daysLeft === 1 ? 'day' : 'days'}`
              : 'Pause wants until next month and cover needs first.'}
          </AppText>
          {safe.upcomingBills > 0 && (
            <AppText variant="caption" muted>
              Already set aside {formatMoney(safe.upcomingBills, currency)} for bills still due this month.
            </AppText>
          )}
        </>
      )}
    </Card>
  );
}

/** A tiny need/want bar shown under expense amounts. */
export function SplitBar({ need, want, width = 48 }: { need: number; want: number; width?: number }) {
  const c = useColors();
  const total = need + want;
  if (total <= 0) return null;
  const needW = Math.round((need / total) * width);
  return (
    <View style={{ flexDirection: 'row', width, height: 4, gap: needW > 0 && needW < width ? 2 : 0 }}>
      {needW > 0 && <View style={{ flex: need, backgroundColor: c.need, borderRadius: 2 }} />}
      {needW < width && <View style={{ flex: want, backgroundColor: c.want, borderRadius: 2 }} />}
    </View>
  );
}

export function TxRow({ tx, custom, onPress }: { tx: Tx; custom?: CustomCategory[]; onPress?: () => void }) {
  const c = useColors();
  const info = categoryInfo(tx.category, custom);
  const isIncome = tx.type === 'income';
  const tag =
    tx.source === 'scan' ? 'Scanned' : tx.source === 'recurring' ? 'Recurring' : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.txRow, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.txIcon, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name={info.icon} size={18} color={isIncome ? c.income : c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1}>{tx.merchant || info.label}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {[info.label, tag].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <AppText style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {isIncome ? '+' : '−'}
          {formatMoney(tx.amount_cents, tx.currency)}
        </AppText>
        {!isIncome && <SplitBar need={tx.need_cents} want={tx.want_cents} />}
      </View>
    </Pressable>
  );
}

export function NeedWantToggle({ value, onChange }: { value: Necessity; onChange: (v: Necessity) => void }) {
  const c = useColors();
  return (
    <Row style={{ gap: space.sm }}>
      <Chip
        label="Need"
        icon="shield-checkmark-outline"
        selected={value === 'need'}
        color={c.need}
        onPress={() => onChange('need')}
      />
      <Chip label="Want" icon="star-outline" selected={value === 'want'} color={c.want} onPress={() => onChange('want')} />
    </Row>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 4,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
