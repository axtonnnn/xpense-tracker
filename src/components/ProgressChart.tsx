import { useId, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { IncomeMark, NeedMark, pen, WantMark } from './sketch';
import { AppText, Label, Row, tabular, TextLink } from './ui';
import type { Bucket } from '@/lib/budget';
import { niceTicks } from '@/lib/chart';
import { formatAxis, formatMoney } from '@/lib/money';
import { colors, fonts } from '@/theme/tokens';

const PLOT_H = 160;
const X_AXIS_H = 24;
const Y_AXIS_W = 40;
const TOP_PAD = 8;
const MIN_SEG = 2;

type Props = {
  buckets: Bucket[];
  currency: string;
  selected: number;
  onSelect: (index: number) => void;
  /** Connect income markers with a dotted line (only meaningful for monthly buckets). */
  incomeLine: boolean;
  /** Heading for the selected bucket, e.g. "Week of 22–28". */
  title: (b: Bucket) => string;
};

/** Needs (solid ink) under wants (hatched), with income as open rings, all on one scale. */
export function ProgressChart({ buckets, currency, selected, onSelect, incomeLine, title }: Props) {
  const hatchId = `ch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [width, setWidth] = useState(0);
  const [showTable, setShowTable] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const maxValue = Math.max(0, ...buckets.map((b) => Math.max(b.need + b.want, b.income)));
  const ticks = niceTicks(maxValue);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - Y_AXIS_W);
  const slot = buckets.length > 0 ? plotW / buckets.length : 0;
  const barW = Math.min(26, slot * 0.46);
  const y = (v: number) => TOP_PAD + (PLOT_H - TOP_PAD) * (1 - v / top);
  const base = y(0);
  const cx = (i: number) => Y_AXIS_W + slot * i + slot / 2;
  const empty = maxValue === 0;
  // Nothing to read out in an empty period: drop the readout and the highlight, keep the axis.
  const sel = empty ? undefined : buckets[selected];
  const p = pen(71);
  const incomePoints = buckets.map((b, i) => ({ x: cx(i), y: y(b.income), v: b.income }));

  return (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>{sel ? title(sel) : 'Nothing yet'}</Label>
        <TextLink label={showTable ? 'Show chart' : 'Show table'} onPress={() => setShowTable((v) => !v)} muted />
      </Row>
      {sel && (
        <Row style={{ gap: 18, flexWrap: 'wrap' }} accessibilityLiveRegion="polite">
          <Reading mark={<NeedMark size={9} />} value={formatMoney(sel.need, currency)} label="needs" />
          <Reading mark={<WantMark size={9} />} value={formatMoney(sel.want, currency)} label="wants" />
          <Reading mark={<IncomeMark size={9} />} value={formatMoney(sel.income, currency, { compact: sel.income >= 100000 })} label="in" />
        </Row>
      )}

      {showTable ? (
        <ChartTable buckets={buckets} currency={currency} />
      ) : (
        <View onLayout={onLayout} style={{ height: PLOT_H + X_AXIS_H }}>
          {width > 0 && (
            <Svg width={width} height={PLOT_H + X_AXIS_H}>
              <Defs>
                <Pattern id={hatchId} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
                  <Line x1={2} y1={0} x2={2} y2={4} stroke={colors.ink} strokeWidth={1} />
                </Pattern>
              </Defs>
              {sel && (
                <Rect x={Y_AXIS_W + slot * selected + 3} y={TOP_PAD - 4} width={Math.max(0, slot - 6)} height={PLOT_H - TOP_PAD + 6} fill={colors.paper} />
              )}
              {ticks.slice(1).map((t) => (
                <Path key={`g${t}`} d={p.seg(Y_AXIS_W, y(t), width, y(t), 0.6, 0.5)} stroke={colors.ink} strokeWidth={0.8} opacity={0.18} fill="none" />
              ))}
              {ticks.map((t) => (
                <SvgText key={`t${t}`} x={Y_AXIS_W - 8} y={y(t) + 4} fontSize={11} fontFamily={fonts.regular} fill={colors.pencil} textAnchor="end">
                  {formatAxis(t, currency)}
                </SvgText>
              ))}

              {buckets.map((b, i) => {
                const x = cx(i) - barW / 2;
                const needH = b.need > 0 ? Math.max(MIN_SEG, base - y(b.need)) : 0;
                const totalH = b.need + b.want > 0 ? Math.max(needH, base - y(b.need + b.want)) : 0;
                const wantH = b.want > 0 ? Math.max(MIN_SEG, totalH - needH) : 0;
                return (
                  <G key={`f${b.key}`}>
                    {needH > 0 && <Rect x={x} y={base - needH} width={barW} height={needH} fill={colors.ink} />}
                    {wantH > 0 && <Rect x={x} y={base - needH - wantH} width={barW} height={wantH} fill={`url(#${hatchId})`} />}
                  </G>
                );
              })}
              {buckets.map((b, i) => {
                const x = cx(i) - barW / 2;
                const needH = b.need > 0 ? Math.max(MIN_SEG, base - y(b.need)) : 0;
                const totalH = b.need + b.want > 0 ? Math.max(needH, base - y(b.need + b.want)) : 0;
                const wantH = b.want > 0 ? Math.max(MIN_SEG, totalH - needH) : 0;
                const bar = pen(100 + i);
                return (
                  <Path
                    key={b.key}
                    d={[
                      needH > 0 ? bar.rect(x, base - needH, barW, needH, 0.8, 0.4) : '',
                      wantH > 0 ? bar.rect(x, base - needH - wantH, barW, wantH, 0.8, 0.3) : '',
                    ].join('')}
                    stroke={colors.ink}
                    strokeWidth={1.1}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
              <Path d={p.seg(Y_AXIS_W, base, width, base, 1, 0.4)} stroke={colors.ink} strokeWidth={1.3} fill="none" strokeLinecap="round" />

              {incomeLine && incomePoints.some((pt) => pt.v > 0) && (
                <Polyline
                  points={incomePoints.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                  fill="none"
                  stroke={colors.ink}
                  strokeWidth={1.4}
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                />
              )}
              {incomePoints.map((pt, i) =>
                pt.v > 0 ? <Circle key={`i${i}`} cx={pt.x} cy={pt.y} r={4.4} fill={colors.page} stroke={colors.ink} strokeWidth={1.3} /> : null,
              )}

              {buckets.map((b, i) => (
                <SvgText
                  key={`x${b.key}`}
                  x={cx(i)}
                  y={PLOT_H + 17}
                  fontSize={11}
                  fontFamily={sel && i === selected ? fonts.semibold : fonts.regular}
                  fill={sel && i === selected ? colors.ink : colors.pencil}
                  textAnchor="middle">
                  {b.label}
                </SvgText>
              ))}
              {empty && (
                <SvgText x={Y_AXIS_W + plotW / 2} y={PLOT_H / 2} fontSize={13} fontFamily={fonts.regular} fill={colors.pencil} textAnchor="middle">
                  Nothing written down for this period yet
                </SvgText>
              )}
            </Svg>
          )}
          {/* Hit targets: the whole slot, not just the painted bar. */}
          <View style={[StyleSheet.absoluteFill, { left: Y_AXIS_W, flexDirection: 'row' }]}>
            {buckets.map((b, i) => (
              <Pressable
                key={`h${b.key}`}
                style={{ flex: 1 }}
                onPress={() => onSelect(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: i === selected }}
                accessibilityLabel={`${b.label}: needs ${formatMoney(b.need, currency)}, wants ${formatMoney(b.want, currency)}, income ${formatMoney(
                  b.income,
                  currency,
                )}`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Reading({ mark, value, label }: { mark: ReactNode; value: string; label: string }) {
  return (
    <Row style={{ gap: 6 }}>
      {mark}
      <AppText variant="caption" muted>
        <AppText variant="caption" weight="semibold" style={tabular}>
          {value}
        </AppText>{' '}
        {label}
      </AppText>
    </Row>
  );
}

function ChartTable({ buckets, currency }: { buckets: Bucket[]; currency: string }) {
  const cell = { flex: 1, textAlign: 'right' as const, ...tabular };
  return (
    <View accessibilityRole="summary">
      <Row style={styles.tableRow}>
        <AppText variant="caption" faint style={{ flex: 1.1 }}>
          Period
        </AppText>
        {['Needs', 'Wants', 'Income'].map((h) => (
          <AppText key={h} variant="caption" faint style={cell}>
            {h}
          </AppText>
        ))}
      </Row>
      {buckets.map((b) => (
        <Row key={b.key} style={styles.tableRow}>
          <AppText variant="caption" style={{ flex: 1.1 }}>
            {b.label}
          </AppText>
          {[b.need, b.want, b.income].map((v, i) => (
            <AppText key={i} variant="caption" style={cell}>
              {formatMoney(v, currency, { compact: true })}
            </AppText>
          ))}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});

