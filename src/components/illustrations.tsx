// Ink drawings for sign-in, empty states and AI mode, drawn with the same seeded pen as the frames.
// Each sits in a View so that, on web, it paints above a card's white page (a bare <svg> would go under it).
import { View } from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Text as SvgText,
} from "react-native-svg";

import {
  blankPageDrawing,
  pencilDrawing,
  receiptDrawing,
  viewfinderDrawing,
} from "../../shared/sketch";
import { colors, fonts } from "@/theme/tokens";

const INK = {
  stroke: colors.ink,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

const RECEIPT = receiptDrawing();
const PENCIL = pencilDrawing([154, 214], -21);

/** A receipt with need/want marks, a pencil lying on it, and two margin notes. For sign-in and onboarding. */
export function ReceiptSketch({
  width = 326,
  notes = true,
}: {
  width?: number;
  notes?: boolean;
}) {
  return (
    <View>
      <Svg width={width} height={(width * 222) / 326} viewBox="0 0 326 222">
        <Defs>
          <Pattern
            id="rhx"
            patternUnits="userSpaceOnUse"
            width={4}
            height={4}
            patternTransform="rotate(45)"
          >
            <Line
              x1={2}
              y1={0}
              x2={2}
              y2={4}
              stroke={colors.ink}
              strokeWidth={1}
            />
          </Pattern>
        </Defs>
        <G transform="rotate(-4 138 104)">
          <Path d={RECEIPT.fill} fill={colors.page} />
          <Path d={RECEIPT.edge} {...INK} strokeWidth={1.4} />
          <Path d={RECEIPT.edge2} {...INK} strokeWidth={0.8} opacity={0.4} />
          <SvgText
            x={138}
            y={31}
            textAnchor="middle"
            fontFamily={fonts.semibold}
            fontSize={8.5}
            letterSpacing={2.4}
            fill={colors.ink}
          >
            GREEN VALLEY
          </SvgText>
          <Path d={RECEIPT.needs} fill={colors.ink} />
          <Path
            d={RECEIPT.wants}
            fill="url(#rhx)"
            stroke={colors.ink}
            strokeWidth={1}
          />
          <Path d={RECEIPT.rows} {...INK} strokeWidth={1.1} />
          <Path
            d={RECEIPT.dash}
            {...INK}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <SvgText
            x={82}
            y={179}
            fontFamily={fonts.semibold}
            fontSize={8.5}
            letterSpacing={1.6}
            fill={colors.ink}
          >
            TOTAL
          </SvgText>
          <SvgText
            x={194}
            y={179}
            textAnchor="end"
            fontFamily={fonts.semibold}
            fontSize={9.5}
            fill={colors.ink}
          >
            50.00
          </SvgText>
        </G>
        <Path d={PENCIL.body} fill={colors.paper} />
        <Path d={PENCIL.lines} {...INK} strokeWidth={1.4} />
        <Path d={PENCIL.lines2} {...INK} strokeWidth={0.8} opacity={0.4} />
        <Path d={PENCIL.lead} fill={colors.ink} />
        {notes && (
          <>
            <Path d={RECEIPT.arrows} {...INK} strokeWidth={1.2} />
            <SvgText
              x={226}
              y={22}
              fontFamily={fonts.hand}
              fontSize={21}
              fill={colors.graphite}
              transform="rotate(-3 226 22)"
            >
              milk: a need
            </SvgText>
            <SvgText
              x={228}
              y={84}
              fontFamily={fonts.hand}
              fontSize={21}
              fill={colors.graphite}
              transform="rotate(2 228 84)"
            >
              chocolate:
            </SvgText>
            <SvgText
              x={228}
              y={104}
              fontFamily={fonts.hand}
              fontSize={21}
              fill={colors.graphite}
              transform="rotate(2 228 104)"
            >
              a want, fine
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const VIEWFINDER = viewfinderDrawing();

/** Four hand-drawn corner brackets around a blank receipt: "put it here". */
export function ViewfinderSketch({ width = 326 }: { width?: number }) {
  return (
    <View>
      <Svg width={width} height={(width * 214) / 326} viewBox="0 0 326 214">
        <Path d={VIEWFINDER.corners} {...INK} strokeWidth={1.8} />
        <G transform="rotate(3 163 104)">
          <Path d={VIEWFINDER.fill} fill={colors.paper} />
          <Path d={VIEWFINDER.edge} {...INK} strokeWidth={1.3} />
          <Path d={VIEWFINDER.edge2} {...INK} strokeWidth={0.7} opacity={0.4} />
          <Path d={VIEWFINDER.rows} {...INK} strokeWidth={1} />
        </G>
      </Svg>
    </View>
  );
}

const BLANK = blankPageDrawing();

/** A blank page with a pencil: "nothing written down yet". */
export function BlankPageSketch({ width = 200 }: { width?: number }) {
  return (
    <View>
      <Svg width={width} height={(width * 190) / 220} viewBox="0 0 220 190">
        <Path d="M40 14h120v150H40z" fill={colors.page} />
        <Path d={BLANK.page} {...INK} strokeWidth={1.4} />
        <Path d={BLANK.page2} {...INK} strokeWidth={0.8} opacity={0.4} />
        <Path d={BLANK.lines} {...INK} strokeWidth={1} opacity={0.35} />
        <Path d={BLANK.pencil.body} fill={colors.paper} />
        <Path d={BLANK.pencil.lines} {...INK} strokeWidth={1.4} />
        <Path
          d={BLANK.pencil.lines2}
          {...INK}
          strokeWidth={0.8}
          opacity={0.4}
        />
        <Path d={BLANK.pencil.lead} fill={colors.ink} />
      </Svg>
    </View>
  );
}
