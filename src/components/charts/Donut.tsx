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
  const gap = 2; // px of visual gap between slices

  // Defensive against real (not mock) data: a non-finite `percent` (NaN,
  // undefined slipping past the type) turns into "NaN NaN" for
  // `strokeDasharray` below, which crashed the whole screen rather than
  // just drawing a wrong-looking arc (reported 15 Sep, on the real
  // Performance page's allocation donut) — `react-native-svg`'s native
  // renderer is far less forgiving of a malformed prop string than a
  // browser's own SVG engine is. A missing/falsy `color` (e.g. a cap-band
  // string this app's `CapBandColor` map doesn't have an entry for) is
  // guarded the same way, with a neutral fallback rather than `undefined`.
  const clean = slices.filter((s) => Number.isFinite(s.percent) && s.percent > 0);
  const total = clean.reduce((a, s) => a + s.percent, 0) || 1;

  // A real, nonzero allocation — even a small one — genuinely disappeared:
  // a 0.3% slice's own proportional arc length (~1px on a typical donut
  // this size) is SMALLER than the fixed 2px `gap` subtracted from every
  // slice, so `Math.max(length - gap, 0)` floored it straight to a literal
  // 0-length arc (reported 16 Sep, on a real account's QGF allocation) —
  // mathematically consistent with the true proportion, but indistinguishable
  // from that strategy not being held at all. `MIN_ARC` floors any nonzero
  // slice to a small but real, visible sliver instead — the same pattern
  // most charting libraries use for exactly this reason. The few pixels of
  // visual overlap this can cost a neighboring slice is imperceptible at
  // this scale and a better trade than an allocation reading as absent.
  const MIN_ARC = 3;
  // Cumulative offsets built as a plain array up front, not a `let`
  // mutated across `.map()` iterations — the React Compiler this project
  // runs under (see app.json's `reactCompiler` experiment) flags
  // reassigning a variable closed over inside a component's render body,
  // whether or not it's actually unsafe in this specific case. `clean` is
  // always a handful of slices, so the O(n²) of a slice+reduce cumulative
  // sum here costs nothing real.
  const rawLengths = clean.map((s) => (s.percent / total) * circumference);
  const arcs = clean.map((s, i) => {
    const length = Math.max(rawLengths[i]! - gap, MIN_ARC);
    const color = s.color || QodeColor.textMuted;
    const offset = rawLengths.slice(0, i).reduce((a, b) => a + b, 0);
    return { ...s, color, length, offset };
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
          {/* Kept inside the hole: a long amount shrinks to fit instead of
              running over the ring on a small donut. */}
          <View style={[styles.center, { width: size - 2 * strokeWidth - 8 }]}>
            {centerLabel ? (
              <Text style={styles.centerLabel} numberOfLines={1}>
                {centerLabel}
              </Text>
            ) : null}
            <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {centerValue}
            </Text>
          </View>
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
