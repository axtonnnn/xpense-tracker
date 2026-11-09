// Gallery icons: a 24 grid, thin square-ended lines. Tab and sidebar icons are drawn at 1.5 and fill in
// when selected; everything else is 1.25. Shapes match the System board on the design canvas.
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type IconName =
  | 'dashboard'
  | 'ai'
  | 'tracker'
  | 'history'
  | 'goal'
  | 'settings'
  | 'camera'
  | 'photos'
  | 'search'
  | 'date'
  | 'repeats'
  | 'lock'
  | 'sync'
  | 'export'
  | 'delete'
  | 'add'
  | 'done'
  | 'close'
  | 'back'
  | 'chevron'
  | 'chevronDown'
  | 'info'
  | 'alert'
  | 'external'
  | 'arrow'
  | 'faceid'
  | 'apple'
  | 'scanAdd'
  | 'sparkle';

/** The four tabs plus the sidebar's savings goal and settings: thicker lines, filled when selected. */
export const NAV_ICONS = ['dashboard', 'ai', 'tracker', 'history', 'goal', 'settings'] as const;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Selected state for nav icons: the shape fills in with ink. */
  filled?: boolean;
  /** Fill colour behind a filled icon's inner lines (e.g. the paper under the Tracker plus). */
  ground?: string;
  strokeWidth?: number;
};

/** Decorative: always hidden from screen readers. Give the button around it a label. */
export function Icon({ name, size = 24, color = colors.ink, filled, ground = colors.paper, strokeWidth }: Props) {
  const nav = (NAV_ICONS as readonly string[]).includes(name);
  const sw = strokeWidth ?? (nav ? 1.5 : 1.25);
  const fill = filled ? color : 'none';
  return (
    <View aria-hidden style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="square">
        {shape(name, fill, ground, color)}
      </Svg>
    </View>
  );
}

function shape(name: IconName, fill: string, ground: string, color: string) {
  switch (name) {
    case 'dashboard':
      return (
        <G strokeLinecap="butt">
          <Path d="M3 20.25h18" />
          <Rect x={5} y={13.25} width={3} height={7} fill={fill} />
          <Rect x={10.5} y={7.75} width={3} height={12.5} fill={fill} />
          <Rect x={16} y={11.25} width={3} height={9} fill={fill} />
          <Circle cx={17.5} cy={6} r={1.75} />
        </G>
      );
    case 'ai':
      return (
        <>
          <Path d="M3 8.5V3h5.5M15.5 3H21v5.5M21 15.5V21h-5.5M8.5 21H3v-5.5" />
          <Path d="M12 7Q12.9 11.1 17 12Q12.9 12.9 12 17Q11.1 12.9 7 12Q11.1 11.1 12 7Z" fill={fill} strokeLinejoin="round" />
        </>
      );
    case 'tracker':
      return (
        <>
          <Path d="M4 4h16v16H4z" fill={fill} />
          <Path d="M12 8.5v7M8.5 12h7" stroke={fill === 'none' ? color : ground} />
        </>
      );
    case 'history':
      return (
        <G strokeLinecap="butt">
          <Rect x={3.75} y={5} width={3.5} height={3.5} fill={fill} />
          <Rect x={3.75} y={10.25} width={3.5} height={3.5} fill={fill} />
          <Rect x={3.75} y={15.5} width={3.5} height={3.5} fill={fill} />
          <Path d="M10.5 6.75h9.75M10.5 12h9.75M10.5 17.25h6.5" />
        </G>
      );
    case 'goal':
      return (
        <G strokeLinecap="butt">
          <Path d="M8.5 3.5h7v3h-7z" />
          <Path d="M6.5 6.5h11v14h-11z" />
          {fill !== 'none' && <Path d="M6.5 14h11v6.5h-11z" fill={fill} />}
          <Path d="M6.5 14h11" />
        </G>
      );
    case 'settings':
      return (
        <G strokeLinecap="butt">
          <Path d="M3.5 8h10M18.5 8h2M3.5 16h3M11.5 16h9" />
          <Circle cx={16} cy={8} r={2.25} fill={fill} />
          <Circle cx={9} cy={16} r={2.25} fill={fill} />
        </G>
      );
    case 'camera':
      return (
        <>
          <Path d="M3 7.5h4.5l2-3h5l2 3H21V20H3z" />
          <Circle cx={12} cy={13} r={3.75} />
        </>
      );
    case 'photos':
      return (
        <>
          <Path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6" />
          <Circle cx={15.5} cy={8.5} r={1.5} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={10.5} cy={10.5} r={6.5} />
          <Path d="M15.5 15.5L21 21" />
        </>
      );
    case 'date':
      return <Path d="M3.5 5h17v15.5h-17zM3.5 9.5h17M8 3v4M16 3v4" />;
    case 'repeats':
      return <Path d="M4 11V8h14l-3-3M20 13v3H6l3 3" />;
    case 'lock':
      return <Path d="M5 10.5h14V21H5zM8 10.5V7.5a4 4 0 0 1 8 0v3" />;
    case 'sync':
      return <Path d="M20 8A8 8 0 0 0 5 7M4 4v4h4M4 16a8 8 0 0 0 15 1M20 20v-4h-4" />;
    case 'export':
      return <Path d="M12 3v12M7 8l5-5 5 5M5 13v8h14v-8" />;
    case 'delete':
      return <Path d="M4 6.5h16M9 6.5V4h6v2.5M6.5 6.5L7.5 21h9l1-14.5" />;
    case 'add':
      return <Path d="M12 4v16M4 12h16" />;
    case 'done':
      return <Path d="M4 12.5l5 5L20 6.5" />;
    case 'close':
      return <Path d="M5 5l14 14M19 5L5 19" />;
    case 'back':
      return <Path d="M15 4l-8 8 8 8" />;
    case 'chevron':
      return <Path d="M9 4l8 8-8 8" />;
    case 'chevronDown':
      return <Path d="M4 9l8 8 8-8" />;
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 11v6M12 7.5v.5" />
        </>
      );
    case 'alert':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v6M12 16.5v.5" />
        </>
      );
    case 'external':
      return <Path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />;
    case 'arrow':
      return <Path d="M4 12h15M13 6l6 6-6 6" />;
    case 'faceid':
      return <Path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M9 9v1.5M15 9v1.5M12 9v4.5h-1M9 16c1.6 1.3 4.4 1.3 6 0" />;
    case 'scanAdd':
      return <Path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M12 8.5v7M8.5 12h7" />;
    case 'sparkle':
      return <Path d="M12 4Q13.2 10.8 20 12Q13.2 13.2 12 20Q10.8 13.2 4 12Q10.8 10.8 12 4Z" fill={fill} strokeLinejoin="round" />;
    case 'apple':
      return (
        <G transform="translate(-1.125 -1.125) scale(1.05)" stroke="none" fill={color}>
          <Path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
        </G>
      );
  }
}
