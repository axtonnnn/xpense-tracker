// How money is drawn, without colour: needs are solid ink, wants are hatched, bills still due are dotted,
// savings are stone, income is an open ring, and dashed means planned. White is what's left.
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Pattern, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

function usePatternId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Fills its parent with diagonal hatching: wants. */
export function Hatch({ color = colors.ink, ground = colors.page, gap = 3.5 }: { color?: string; ground?: string; gap?: number }) {
  const id = usePatternId('h');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%">
        <Pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform="rotate(45)">
          <Rect width={gap} height={gap} fill={ground} />
          <Line x1={gap / 2} y1={0} x2={gap / 2} y2={gap} stroke={color} strokeWidth={1} />
        </Pattern>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Fills its parent with a fine dot screen: bills still due. */
export function Dots({ color = colors.ink, ground = colors.page }: { color?: string; ground?: string }) {
  const id = usePatternId('d');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%">
        <Pattern id={id} patternUnits="userSpaceOnUse" width={3} height={3}>
          <Rect width={3} height={3} fill={ground} />
          <Circle cx={1.5} cy={1.5} r={0.8} fill={color} />
        </Pattern>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export type MarkKind = 'need' | 'want' | 'split' | 'income' | 'bills' | 'savings' | 'planned' | 'left';

/**
 * A small key mark: in rows, legends and toggles. `color` and `ground` swap for marks drawn on ink
 * (the selected half of the need/want switch).
 */
export function Mark({
  kind,
  size = 8,
  color = colors.ink,
  ground = colors.page,
  style,
}: {
  kind: MarkKind;
  size?: number;
  color?: string;
  ground?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const box = { width: size, height: size };
  const outlined = { ...box, borderWidth: 1, borderColor: color, overflow: 'hidden' as const };
  let body;
  switch (kind) {
    case 'need':
      body = <View style={[box, { backgroundColor: color }]} />;
      break;
    case 'want':
      body = (
        <View style={outlined}>
          <Hatch color={color} ground={ground} gap={size >= 12 ? 3.5 : 2.5} />
        </View>
      );
      break;
    case 'split':
      body = (
        <View style={[outlined, { flexDirection: 'row' }]}>
          <View style={{ flex: 1, backgroundColor: color }} />
          <View style={{ flex: 1 }}>
            <Hatch color={color} ground={ground} gap={2.5} />
          </View>
        </View>
      );
      break;
    case 'bills':
      body = (
        <View style={outlined}>
          <Dots color={color} ground={ground} />
        </View>
      );
      break;
    case 'savings':
      body = <View style={[outlined, { backgroundColor: colors.stone }]} />;
      break;
    case 'left':
      body = <View style={[outlined, { backgroundColor: ground }]} />;
      break;
    case 'income':
      body = <View style={[box, { borderRadius: size, borderWidth: 1.25, borderColor: color }]} />;
      break;
    case 'planned':
      body = <View style={[box, { borderRadius: size, borderWidth: 1.25, borderColor: color, borderStyle: 'dashed' }]} />;
      break;
  }
  return (
    <View aria-hidden style={style} pointerEvents="none">
      {body}
    </View>
  );
}
