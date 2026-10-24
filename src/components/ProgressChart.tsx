import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Row } from './ui';
import type { Bucket } from '@/lib/budget';
import { niceTicks, roundedTopBar } from '@/lib/chart';
import { formatAxis, formatMoney } from '@/lib/money';
import { fonts, radius, space, useColors } from '@/theme/tokens';

const PLOT_H = 168;
const X_AXIS_H = 24;
const Y_AXIS_W = 44;
const TOP_PAD = 8;
const GAP = 2; // surface gap between stacked segments
const MIN_SEG = 2;
// SVG text doesn't inherit styles, so set the brand font explicitly (loaded in the root layout).
const SVG_FONT = fonts.semibold;

type Props = {
  buckets: Bucket[];
  currency: string;
  selected: number;
  onSelect: (index: number) => void;
  /** Connect income markers with a line (only meaningful for monthly buckets). */
  incomeLine: boolean;
};

export function ProgressChart({ buckets, currency, selected, onSelect, incomeLine }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [showTable, setShowTable] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const maxValue = Math.max(0, ...buckets.map((b) => Math.max(b.need + b.want, b.income)));
  const ticks = niceTicks(maxValue);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - Y_AXIS_W);
  const slot = buckets.length > 0 ? plotW / buckets.length : 0;
  const barW = Math.min(24, slot * 0.5);
  const y = (v: number) => TOP_PAD + (PLOT_H - TOP_PAD) * (1 - v / top);
  const base = y(0);
  const cx = (i: number) => Y_AXIS_W + slot * i + slot / 2;
  const empty = maxValue === 0;
  // Nothing to read out in an empty period: drop the readout and the highlight, keep the axis.
  const sel = empty ? undefined : buckets[selected];

  const incomePoints = buckets.map((b, i) => ({ x: cx(i), y: y(b.income), v: b.income }));

  return (
    <View style={{ gap: space.md }}>
      {sel && (
        <View style={[styles.readout, { backgroundColor: c.surfaceAlt }]} accessibilityLiveRegion="polite">
          <AppText variant="label" muted>
            {sel.label}
          </AppText>
          <Row style={{ gap: space.xl, flexWrap: 'wrap' }}>
            <Reading color={c.need} kind="rect" value={formatMoney(sel.need, currency)} label="Needs" />
            <Reading color={c.want} kind="rect" value={formatMoney(sel.want, currency)} label="Wants" />
            <Reading color={c.income} kind={incomeLine ? 'line' : 'dot'} value={formatMoney(sel.income, currency)} label="Income" />
          </Row>
        </View>
      )}

      {showTable ? (
        <ChartTable buckets={buckets} currency={currency} />
      ) : (
        <View onLayout={onLayout} style={{ height: PLOT_H + X_AXIS_H }}>
          {width > 0 && (
            <Svg width={width} height={PLOT_H + X_AXIS_H}>
              {sel && (
                <Rect
                  x={Y_AXIS_W + slot * selected + 2}
                  y={TOP_PAD - 4}
                  width={Math.max(0, slot - 4)}
                  height={PLOT_H - TOP_PAD + 4}
                  rx={8}
                  fill={c.surfaceAlt}
                />
              )}
              {ticks.map((t) => (
                <Line key={`g${t}`} x1={Y_AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke={c.gridline} strokeWidth={1} />
              ))}
              {ticks.map((t) => (
                <SvgText
                  key={`t${t}`}
                  x={Y_AXIS_W - 6}
                  y={y(t) + 4}
                  fontSize={11}
                  fontFamily={SVG_FONT}
                  fill={c.inkMuted}
                  textAnchor="end">
                  {formatAxis(t, currency)}
                </SvgText>
              ))}

              {buckets.map((b, i) => {
                const x = cx(i) - barW / 2;
                const needH = b.need > 0 ? Math.max(MIN_SEG, base - y(b.need)) : 0;
                const totalH = b.need + b.want > 0 ? Math.max(needH, base - y(b.need + b.want)) : 0;
                const wantH = b.want > 0 ? Math.max(MIN_SEG, totalH - needH - (needH > 0 ? GAP : 0)) : 0;
                return (
                  <G key={b.key}>
                    {needH > 0 &&
                      (wantH > 0 ? (
                        <Rect x={x} y={base - needH} width={barW} height={needH} fill={c.need} />
                      ) : (
                        <Path d={roundedTopBar(x, base - needH, barW, needH)} fill={c.need} />
                      ))}
                    {wantH > 0 && (
                      <Path
                        d={roundedTopBar(x, base - needH - (needH > 0 ? GAP : 0) - wantH, barW, wantH)}
                        fill={c.want}
                      />
                    )}
                  </G>
                );
              })}

              {incomeLine && incomePoints.some((p) => p.v > 0) && (
                <Polyline
                  points={incomePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={c.income}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {incomePoints.map((p, i) =>
                p.v > 0 ? (
                  <Circle key={`i${i}`} cx={p.x} cy={p.y} r={4.5} fill={c.income} stroke={c.surface} strokeWidth={2} />
                ) : null,
              )}

              {buckets.map((b, i) => (
                <SvgText
                  key={`x${b.key}`}
                  x={cx(i)}
                  y={PLOT_H + 17}
                  fontSize={11}
                  fontFamily={sel && i === selected ? fonts.extrabold : SVG_FONT}
                  fill={sel && i === selected ? c.ink : c.inkMuted}
                  textAnchor="middle">
                  {b.label}
                </SvgText>
              ))}
              {empty && (
                <SvgText x={Y_AXIS_W + plotW / 2} y={PLOT_H / 2} fontSize={13} fontFamily={SVG_FONT} fill={c.inkMuted} textAnchor="middle">
                  No activity in this period yet
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
                accessibilityLabel={`${b.label}: needs ${formatMoney(b.need, currency)}, wants ${formatMoney(
                  b.want,
                  currency,
                )}, income ${formatMoney(b.income, currency)}`}
              />
            ))}
          </View>
        </View>
      )}

      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Row style={{ gap: space.md }}>
          <LegendKey color={c.need} kind="rect" label="Needs" />
          <LegendKey color={c.want} kind="rect" label="Wants" />
          <LegendKey color={c.income} kind={incomeLine ? 'line' : 'dot'} label="Income" />
        </Row>
        <Pressable onPress={() => setShowTable((v) => !v)} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" weight="bold" color={c.primary}>
            {showTable ? 'Show chart' : 'Show table'}
          </AppText>
        </Pressable>
      </Row>
    </View>
  );
}

type KeyKind = 'rect' | 'line' | 'dot';

function Key({ color, kind }: { color: string; kind: KeyKind }) {
  if (kind === 'rect') return <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />;
  if (kind === 'dot') return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />;
  return <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: color }} />;
}

function LegendKey({ color, kind, label }: { color: string; kind: KeyKind; label: string }) {
  return (
    <Row style={{ gap: 6 }}>
      <Key color={color} kind={kind} />
      <AppText variant="caption" weight="semibold" muted>
        {label}
      </AppText>
    </Row>
  );
}

function Reading({ color, kind, value, label }: { color: string; kind: KeyKind; value: string; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText weight="extrabold" style={{ fontSize: 17 }}>
        {value}
      </AppText>
      <Row style={{ gap: 6 }}>
        <Key color={color} kind={kind} />
        <AppText variant="caption" muted>
          {label}
        </AppText>
      </Row>
    </View>
  );
}

function ChartTable({ buckets, currency }: { buckets: Bucket[]; currency: string }) {
  const c = useColors();
  const cell = { flex: 1, textAlign: 'right' as const, fontVariant: ['tabular-nums' as const] };
  return (
    <View accessibilityRole="summary">
      <Row style={[styles.tableRow, { borderColor: c.border }]}>
        <AppText variant="caption" muted style={{ flex: 1.1 }}>
          Period
        </AppText>
        {['Needs', 'Wants', 'Income'].map((h) => (
          <AppText key={h} variant="caption" muted style={cell}>
            {h}
          </AppText>
        ))}
      </Row>
      {buckets.map((b) => (
        <Row key={b.key} style={[styles.tableRow, { borderColor: c.border }]}>
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
  readout: { borderRadius: radius.md, padding: space.md, paddingHorizontal: space.lg, gap: 6 },
  tableRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
