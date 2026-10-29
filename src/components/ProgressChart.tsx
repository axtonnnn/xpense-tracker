// The dashboard chart: needs (solid) under wants (hatched) in thin columns on one baseline, with pay as
// open rings at their height and pay still to come as dashed rings. Columns rise in, 40 ms apart.
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Hatch, Mark } from './marks';
import { Appear, Rise } from './motion';
import { Key } from './money-ui';
import { AppText, haptic, SectionHeader } from './ui';
import type { Bucket } from '@/lib/budget';
import { niceTicks } from '@/lib/chart';
import { formatAxis, formatFigure, formatMoney } from '@/lib/money';
import { colors, fonts, motion } from '@/theme/tokens';

const PLOT_H = 170;
const HEADROOM = 18;
const MIN_SEG = 2;

export type ChartBucket = Bucket & {
  /** Pay still expected in this stretch (from repeating income), drawn as a dashed ring. */
  planned?: number;
};

type Props = {
  index?: string;
  heading: string;
  buckets: ChartBucket[];
  currency: string;
  selected: number;
  onSelect: (index: number) => void;
  /** Axis label under each column (narrow for 12 months). */
  label?: (b: ChartBucket) => string;
  /** The sentence under the chart about the selected column. */
  readout: (b: ChartBucket) => React.ReactNode;
};

export function ProgressChart({ index, heading, buckets, currency, selected, onSelect, label = (b) => b.label, readout }: Props) {
  const [width, setWidth] = useState(0);
  const [table, setTable] = useState(false);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const maxValue = Math.max(0, ...buckets.map((b) => Math.max(b.need + b.want, b.income, b.planned ?? 0)));
  const ticks = niceTicks(maxValue, 2);
  const top = Math.max(1, ticks[ticks.length - 1] ?? 1);
  const scale = (v: number) => ((PLOT_H - HEADROOM) * v) / top;
  // One dashed guide line, at the middle tick, keeps the chart quiet.
  const guide = ticks.length > 2 ? ticks[Math.floor((ticks.length - 1) / 2)] : ticks[1];
  const columns = buckets.length;
  const barW = columns > 8 ? 12 : 14;
  const ring = columns > 8 ? 9 : 10;
  const sel = buckets[selected];

  return (
    <View>
      <SectionHeader index={index} title={heading} action={{ label: table ? 'Chart' : 'Table', onPress: () => setTable((v) => !v) }} />
      <View style={styles.keys}>
        <Key kind="need" label="Needs" />
        <Key kind="want" label="Wants" />
        <Key kind="income" label="Pay" />
      </View>

      {table ? (
        <ChartTable buckets={buckets} currency={currency} label={label} />
      ) : (
        <>
          <View
            onLayout={onLayout}
            style={styles.plot}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${heading}. ${buckets
              .map((b) => `${b.label}: needs ${formatMoney(b.need, currency)}, wants ${formatMoney(b.want, currency)}${b.income ? `, pay ${formatMoney(b.income, currency)}` : ''}`)
              .join('. ')}`}>
            {guide ? (
              <>
                <View style={[styles.guide, { bottom: scale(guide) }]} />
                <AppText variant="axis" muted style={[styles.guideLabel, { bottom: scale(guide) + 2, fontSize: 9 }]}>
                  {formatAxis(guide, currency).replace(/^[^\d]+/, '')}
                </AppText>
              </>
            ) : null}
            {width > 0 && (
              <View style={StyleSheet.absoluteFill}>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  {buckets.map((b, i) => {
                    const needH = b.need > 0 ? Math.max(MIN_SEG, scale(b.need)) : 0;
                    const wantH = b.want > 0 ? Math.max(MIN_SEG + 1, scale(b.want)) : 0;
                    return (
                      <Pressable
                        key={b.key}
                        onPress={() => {
                          if (i !== selected) haptic('select');
                          onSelect(i);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: i === selected }}
                        accessibilityLabel={`${b.label}: needs ${formatMoney(b.need, currency)}, wants ${formatMoney(b.want, currency)}, pay ${formatMoney(b.income, currency)}`}
                        style={styles.column}>
                        {i === selected && <View style={[styles.band, { left: columns > 8 ? 3 : 6, right: columns > 8 ? 3 : 6 }]} />}
                        {(needH > 0 || wantH > 0) && (
                          <Rise delay={i * motion.columnStagger} style={[styles.bar, { width: barW, height: needH + wantH, marginLeft: -barW / 2 }]}>
                            {wantH > 0 && (
                              <View style={{ height: wantH, borderWidth: 1, borderColor: colors.ink, overflow: 'hidden' }}>
                                <Hatch gap={2.5} />
                              </View>
                            )}
                            {needH > 0 && <View style={{ height: needH, backgroundColor: colors.ink }} />}
                          </Rise>
                        )}
                        {b.income > 0 && (
                          <Appear delay={i * motion.columnStagger + 300} distance={0} style={[styles.ringAt, { bottom: scale(b.income) - ring / 2, marginLeft: -ring / 2 }]}>
                            <Ring size={ring} />
                          </Appear>
                        )}
                        {!b.income && (b.planned ?? 0) > 0 && (
                          <Appear delay={i * motion.columnStagger + 300} distance={0} style={[styles.ringAt, { bottom: scale(b.planned ?? 0) - ring / 2, marginLeft: -ring / 2 }]}>
                            <Ring size={ring} dashed />
                          </Appear>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <View style={styles.baseline} />
          </View>
          <View style={styles.labels} aria-hidden>
            {buckets.map((b, i) => (
              <AppText
                key={b.key}
                variant="axis"
                center
                numberOfLines={1}
                style={{ flex: 1, lineHeight: 14, color: i === selected ? colors.ink : colors.grey, fontFamily: i === selected ? fonts.monoMedium : fonts.mono }}>
                {label(b)}
              </AppText>
            ))}
          </View>
          {sel && (
            <AppText variant="caption" muted style={{ marginTop: 14 }} accessibilityLiveRegion="polite">
              {readout(sel)}
            </AppText>
          )}
        </>
      )}
    </View>
  );
}

function Ring({ size, dashed }: { size: number; dashed?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: 1.25,
        borderColor: colors.ink,
        borderStyle: dashed ? 'dashed' : 'solid',
        backgroundColor: colors.paper,
      }}
    />
  );
}

function ChartTable({ buckets, currency, label }: { buckets: ChartBucket[]; currency: string; label: (b: ChartBucket) => string }) {
  const cell = { flex: 1, textAlign: 'right' as const };
  return (
    <View accessibilityRole="summary" style={{ marginTop: 16 }}>
      <View style={styles.tableRow}>
        <AppText variant="small" muted style={{ flex: 1 }}>
          {' '}
        </AppText>
        {[
          ['need', 'Needs'],
          ['want', 'Wants'],
          ['income', 'Pay'],
        ].map(([k, h]) => (
          <View key={k} style={[cell, { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }]}>
            <Mark kind={k as 'need'} size={8} />
            <AppText variant="small" muted>
              {h}
            </AppText>
          </View>
        ))}
      </View>
      {buckets.map((b) => (
        <View key={b.key} style={styles.tableRow}>
          <AppText variant="caption" style={{ flex: 1 }}>
            {b.label.length <= 2 ? label(b) : b.label}
          </AppText>
          {[b.need, b.want, b.income].map((v, i) => (
            <AppText key={i} variant="monoSmall" style={cell}>
              {formatFigure(v, currency)}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keys: { flexDirection: 'row', gap: 16, marginTop: 14 },
  plot: { height: PLOT_H, marginTop: 16 },
  guide: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderColor: colors.rule, borderStyle: 'dashed' },
  guideLabel: { position: 'absolute', left: 0 },
  column: { flex: 1, height: '100%' },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.band },
  bar: { position: 'absolute', bottom: 0, left: '50%' },
  ringAt: { position: 'absolute', left: '50%' },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.ink },
  labels: { flexDirection: 'row', marginTop: 8 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
});
