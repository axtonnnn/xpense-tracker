// Small on-brand illustrations for empty states and hero cards. Leaves use the need/want colours.
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { MARK_COLORS } from './brand';
import { useColors, useIsDark } from '@/theme/tokens';

const SMALL_LEAF = 'M0 0 C8 -9 26 -10 40 0 C26 10 8 9 0 0 Z';
const SPARKLE = 'M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z';

/** Coins with a two-leaf sprout: savings growing. */
export function CoinSprout({ width = 180 }: { width?: number }) {
  const c = useColors();
  const leaves = MARK_COLORS[useIsDark() ? 'dark' : 'light'];
  const gold = '#F0BE5C';
  const edge = '#C98A2A';
  const coin = (y: number) => (
    <G key={y}>
      <Ellipse cx={100} cy={y + 12} rx={38} ry={10} fill={edge} />
      <Rect x={62} y={y} width={76} height={12} fill={edge} />
      <Ellipse cx={100} cy={y} rx={38} ry={10} fill={gold} />
      <Ellipse cx={100} cy={y} rx={27} ry={6.5} stroke={edge} strokeWidth={2} fill="none" opacity={0.7} />
    </G>
  );
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 200 150">
      <Ellipse cx={100} cy={132} rx={72} ry={9} fill={c.surfaceAlt} />
      {[114, 100, 86].map(coin)}
      <Path d="M100 78 C100 68 101 58 100 46" stroke={leaves.need} strokeWidth={5} strokeLinecap="round" fill="none" />
      <G transform="translate(100 56) rotate(-152)">
        <Path d={SMALL_LEAF} fill={leaves.need} />
      </G>
      <G transform="translate(100 48) rotate(-32)">
        <Path d={SMALL_LEAF} fill={leaves.want} />
      </G>
      <G transform="translate(152 34)">
        <Path d={SPARKLE} fill={gold} />
      </G>
      <G transform="translate(50 50) scale(0.7)">
        <Path d={SPARKLE} fill={gold} />
      </G>
    </Svg>
  );
}

/** A receipt inside scan corners, its lines tagged need/want. For the AI hero card. */
export function ReceiptScan({ width = 150, onHero = false }: { width?: number; onHero?: boolean }) {
  const c = useColors();
  const dark = useIsDark();
  const leaves = onHero || dark ? MARK_COLORS.dark : MARK_COLORS.light;
  const paper = onHero ? '#F6F4EE' : c.surface;
  const line = onHero ? '#D9E4DF' : c.surfaceAlt;
  const ink = onHero ? '#1A5A4D' : c.inkMuted;
  const corner = onHero ? '#8FD3B6' : c.primary;
  const rows = [34, 50, 66, 82];
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 200 160">
      <Path d="M60 18 H140 V130 L132 136 L124 130 L116 136 L108 130 L100 136 L92 130 L84 136 L76 130 L68 136 L60 130 Z" fill={paper} />
      {rows.map((y, i) => (
        <G key={y}>
          <Circle cx={70} cy={y + 3} r={3.5} fill={i % 3 === 2 ? leaves.want : leaves.need} />
          <Rect x={78} y={y} width={i % 2 ? 30 : 38} height={6} rx={3} fill={line} />
          <Rect x={118} y={y} width={14} height={6} rx={3} fill={line} />
        </G>
      ))}
      <Rect x={70} y={104} width={60} height={8} rx={4} fill={ink} opacity={0.85} />
      {[
        'M46 26 V12 H60',
        'M140 12 H154 V26',
        'M154 126 V140 H140',
        'M60 140 H46 V126',
      ].map((d) => (
        <Path key={d} d={d} stroke={corner} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      <G transform="translate(166 30)">
        <Path d={SPARKLE} fill="#F0BE5C" />
      </G>
    </Svg>
  );
}

/** A magnifier with the leaf X inside: "nothing here yet". */
export function LeafSearch({ width = 150 }: { width?: number }) {
  const c = useColors();
  const leaves = MARK_COLORS[useIsDark() ? 'dark' : 'light'];
  const leaf = (angle: number, fill: string) => (
    <G key={angle} transform={`translate(92 66) rotate(${angle})`}>
      <Path d="M3 0 C8 -7 20 -8 28 0 C20 8 8 7 3 0 Z" fill={fill} />
    </G>
  );
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 200 150">
      <Ellipse cx={104} cy={136} rx={60} ry={7} fill={c.surfaceAlt} />
      <Path d="M121 95 L146 120" stroke={c.primary} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={92} cy={66} r={40} fill={c.primarySoft} stroke={c.primary} strokeWidth={8} />
      {[-45, 135].map((a) => leaf(a, leaves.need))}
      {[-135, 45].map((a) => leaf(a, leaves.want))}
    </Svg>
  );
}
