import { Circle, Svg } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont } from '@/constants/qode-theme';

/**
 * The allocation donut — a stroke-based ring rather than a hand-computed
 * arc path (react-native-svg has no arc-to-path helper as convenient as
 * the web version's manual <path> math in charts.tsx). Same visual idea:
 * a hole in the middle, one color per cap band, small gaps between slices.
 */
export function Donut({
  slices,
  size = 200,
  centerLabel,
  centerValue,
}: {
  slices: { label: string; percent: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const strokeWidth = size * 0.16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((a, s) => a + s.percent, 0) || 1;
  const gap = 2; // px of visual gap between slices

  let offset = 0;
  const arcs = slices.map((s) => {
    const length = Math.max((s.percent / total) * circumference - gap, 0);
    const arc = { ...s, length, offset };
    offset += (s.percent / total) * circumference;
    return arc;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={QodeColor.surfaceBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((a) => (
          <Circle
            key={a.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={a.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${a.length} ${circumference - a.length}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
            fill="none"
            // Start at 12 o'clock, like qode-oneview's Donut (-Math.PI/2 start).
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ))}
      </Svg>
      {centerValue ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
          <Text style={styles.centerValue}>{centerValue}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10,
    color: QodeColor.textMuted,
  },
  centerValue: {
    fontFamily: QodeFont.ui,
    fontSize: 16,
    color: QodeColor.textPrimary,
    marginTop: 2,
  },
});
