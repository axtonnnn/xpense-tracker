// Money-specific building blocks: category icons, stat tiles, the safe-to-spend hero, rows, toggles.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, HeroCard, IconCircle, Pill, Row, type IconName } from './ui';
import type { Necessity } from '../../shared/schemas';
import type { Tx } from '@/db/transactions';
import type { SafeToSpend } from '@/lib/budget';
import { categoryInfo, type CustomCategory } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import { elevation, radius, space, useColors, useIsDark } from '@/theme/tokens';

/** Category icon in a circle tinted by meaning: green for needs, amber for wants, blue for income. */
export function CategoryIcon({
  category,
  custom,
  type = 'expense',
  necessity,
  size = 40,
}: {
  category: string;
  custom?: CustomCategory[];
  type?: 'expense' | 'income';
  necessity?: Necessity;
  size?: number;
}) {
  const c = useColors();
  const info = categoryInfo(category, custom);
  const kind = type === 'income' ? 'income' : (necessity ?? info.necessity ?? 'want');
  const tone = { income: [c.incomeSoft, c.income], need: [c.needSoft, c.needInk], want: [c.wantSoft, c.wantInk] }[kind];
  return <IconCircle icon={info.icon} size={size} bg={tone[0]} color={tone[1]} />;
}

export type Delta = { pct: number | null; goodWhenUp: boolean; vs: string; suffix?: string };

export function StatTile({ label, value, icon, delta }: { label: string; value: string; icon: IconName; delta?: Delta }) {
  const c = useColors();
  const dark = useIsDark();
  let deltaView = null;
  if (delta && delta.pct !== null) {
    const flat = delta.pct === 0;
    const good = delta.pct > 0 === delta.goodWhenUp;
    const color = flat ? c.inkMuted : good ? c.positive : c.danger;
    deltaView = (
      <Row style={{ gap: 3 }}>
        <Ionicons name={flat ? 'remove' : delta.pct > 0 ? 'arrow-up' : 'arrow-down'} size={13} color={color} />
        <AppText variant="caption" weight="bold" color={color} numberOfLines={1} style={{ flexShrink: 1 }}>
          {flat ? `Same as ${delta.vs}` : `${Math.abs(delta.pct)}${delta.suffix ?? '%'} vs ${delta.vs}`}
        </AppText>
      </Row>
    );
  }
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: c.surface },
        dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : elevation(false),
      ]}>
      <Row style={{ gap: 6 }}>
        <Ionicons name={icon} size={15} color={c.inkMuted} />
        <AppText variant="caption" weight="semibold" muted numberOfLines={1}>
          {label}
        </AppText>
      </Row>
      <AppText variant="title" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 21 }}>
        {value}
      </AppText>
      {deltaView}
    </View>
  );
}

const STATUS = {
  safe: { icon: 'shield-checkmark', label: 'On track' },
  tight: { icon: 'shield-half', label: 'Getting tight' },
  over: { icon: 'warning', label: 'Over budget' },
  unset: { icon: 'shield-outline', label: 'Not set up' },
} as const;

/** The hero of the dashboard: how much is safe to spend, with a meter of what's left of the budget. */
export function SafeToSpendCard({ safe, currency, onSetup }: { safe: SafeToSpend; currency: string; onSetup?: () => void }) {
  const c = useColors();
  const tone = { safe: c.mint, tight: c.gold, over: '#FFB4A8', unset: c.onHeroMuted }[safe.status];
  const s = STATUS[safe.status];
  const left = safe.budget > 0 ? Math.max(0, Math.min(1, safe.amount / safe.budget)) : 0;
  return (
    <HeroCard>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" weight="semibold" color={c.onHeroMuted}>
          Safe to spend this month
        </AppText>
        <Pill icon={s.icon} label={s.label} color={tone} bg="rgba(246,244,238,0.12)" />
      </Row>
      {safe.status === 'unset' ? (
        <>
          <AppText variant="title" color={c.onHero}>
            Add your monthly income to see what&apos;s safe to spend each day.
          </AppText>
          <Button title="Add my income" kind="hero" icon="add" onPress={() => onSetup?.()} />
        </>
      ) : (
        <>
          <AppText variant="hero" color={safe.amount < 0 ? '#FFB4A8' : c.onHero}>
            {formatMoney(safe.amount, currency)}
          </AppText>
          <AppText color={c.onHeroMuted} weight="semibold">
            {safe.amount > 0
              ? `≈ ${formatMoney(safe.perDay, currency)} a day for the next ${safe.daysLeft} ${safe.daysLeft === 1 ? 'day' : 'days'}`
              : 'Pause wants until next month and cover needs first.'}
          </AppText>
          <View
            style={styles.meterTrack}
            accessibilityRole="progressbar"
            accessibilityLabel={`${Math.round(left * 100)}% of this month's budget left`}>
            <View style={[styles.meterFill, { width: `${left * 100}%`, backgroundColor: tone }]} />
          </View>
          <AppText variant="caption" color={c.onHeroMuted}>
            {Math.round(left * 100)}% of {formatMoney(safe.budget, currency, { compact: true })} left
            {safe.upcomingBills > 0 ? ` · ${formatMoney(safe.upcomingBills, currency)} set aside for bills` : ''}
          </AppText>
        </>
      )}
    </HeroCard>
  );
}

/** A tiny need/want bar shown under expense amounts. */
export function SplitBar({ need, want, width = 48 }: { need: number; want: number; width?: number }) {
  const c = useColors();
  const total = need + want;
  if (total <= 0) return null;
  return (
    <View style={{ flexDirection: 'row', width, height: 5, gap: need > 0 && want > 0 ? 2 : 0 }}>
      {need > 0 && <View style={{ flex: need, backgroundColor: c.need, borderRadius: 3 }} />}
      {want > 0 && <View style={{ flex: want, backgroundColor: c.want, borderRadius: 3 }} />}
    </View>
  );
}

export function TxRow({ tx, custom, onPress }: { tx: Tx; custom?: CustomCategory[]; onPress?: () => void }) {
  const c = useColors();
  const info = categoryInfo(tx.category, custom);
  const isIncome = tx.type === 'income';
  const tag = tx.source === 'scan' ? 'Scanned' : tx.source === 'recurring' ? 'Repeats' : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tx.merchant || info.label}, ${isIncome ? 'income' : 'expense'} ${formatMoney(tx.amount_cents, tx.currency)}`}
      style={({ pressed }) => [styles.txRow, { opacity: pressed ? 0.6 : 1 }]}>
      <CategoryIcon
        category={tx.category}
        custom={custom}
        type={tx.type}
        necessity={tx.need_cents >= tx.want_cents ? 'need' : 'want'}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="semibold" numberOfLines={1}>
          {tx.merchant || info.label}
        </AppText>
        <Row style={{ gap: 6 }}>
          <AppText variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {info.label}
          </AppText>
          {tag && (
            <View style={[styles.tag, { backgroundColor: tx.source === 'scan' ? c.primarySoft : c.surfaceAlt }]}>
              <Ionicons name={tx.source === 'scan' ? 'scan' : 'repeat'} size={10} color={tx.source === 'scan' ? c.primary : c.inkMuted} />
              <AppText variant="caption" weight="bold" color={tx.source === 'scan' ? c.primary : c.inkMuted} style={{ fontSize: 10, lineHeight: 13 }}>
                {tag}
              </AppText>
            </View>
          )}
        </Row>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <AppText weight="bold" color={isIncome ? c.positive : c.ink} style={{ fontVariant: ['tabular-nums'] }}>
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
      <Chip label="Need" icon="shield-checkmark-outline" selected={value === 'need'} color={c.needInk} onPress={() => onChange('need')} />
      <Chip label="Want" icon="star-outline" selected={value === 'want'} color={c.wantInk} onPress={() => onChange('want')} />
    </Row>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.md, padding: 14, gap: 5 },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(246,244,238,0.16)', overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, borderRadius: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
