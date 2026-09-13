import { useMemo, useRef, useState } from 'react';
import { Line, Polyline, Svg } from 'react-native-svg';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont } from '@/constants/qode-theme';
import { axisTick, dayLabel, monthLabel, niceTicks } from '@/lib/format';
import type { Series } from '@/lib/mock-data';

const ROLE_COLOR = {
  client: QodeColor.seriesClient,
  strategy: QodeColor.seriesStrategy,
  benchmark: QodeColor.seriesBenchmark,
} as const;

const W = 1000; // viewBox units; the SVG scales to its measured container width
const ML = 56; // left gutter for y-axis labels
const MR = 8;
const MT = 12;
const MB = 24; // bottom gutter for x-axis month labels

/**
 * The rebased NAV comparison chart — "The Journey" on qode-oneview's
 * Performance screen. Ported from components/review/charts.tsx's NavChart:
 * same y-axis "nice tick" gridlines, same month x-axis labels, same
 * ranked-by-value tooltip on touch. Axis text and the tooltip are RN
 * `<Text>`/`<View>` overlays rather than SVG text, for the same reason
 * the web version uses HTML for them — the SVG viewBox scales
 * non-uniformly with the container, which would stretch/skew SVG glyphs;
 * percentage-positioned overlay elements don't inherit that.
 *
 * Touch tracking uses PanResponder (already available via core React
 * Native, no new dependency) rather than a gesture library — a single
 * press-and-drag is all this needs.
 */
export function NavChart({ series, height = 220 }: { series: Series[]; height?: number }) {
  const [at, setAt] = useState<number | null>(null);
  const widthRef = useRef(0);

  const pointCount = Math.max(...series.map((s) => s.points.length), 2);

  const { yMin, yMax, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.points.map((p) => p.value));
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.08;
    const floor = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
    const t = niceTicks(floor, hi + pad);
    const top = Math.max(t[t.length - 1], hi + pad);
    const bottom = Math.min(t[0], floor);
    return { yMin: bottom, yMax: top, ticks: t };
  }, [series]);

  const x = (i: number) => ML + (i / (pointCount - 1)) * (W - ML - MR);
  const y = (v: number) => MT + (1 - (v - yMin) / (yMax - yMin)) * (height - MT - MB);

  const dateSource = series.reduce((a, s) => (s.points.length >= a.points.length ? s : a), series[0]);

  const monthTicks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let seen = '';
    dateSource?.points.forEach((p, i) => {
      const key = p.date.slice(0, 7);
      if (key !== seen) {
        seen = key;
        out.push({ i, label: monthLabel(p.date) });
      }
    });
    return out.filter((_, k) => k % 2 === 0);
  }, [dateSource]);

  function updateAtFromLocalX(localX: number) {
    if (widthRef.current <= 0) return;
    const frac = localX / widthRef.current;
    const sx = frac * W;
    const i = Math.round(((sx - ML) / (W - ML - MR)) * (pointCount - 1));
    setAt(i >= 0 && i < pointCount ? i : null);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => updateAtFromLocalX(evt.nativeEvent.locationX),
      onPanResponderGrant: (evt) => updateAtFromLocalX(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setAt(null),
      onPanResponderTerminate: () => setAt(null),
    }),
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
  }

  const tipLeftPct = at === null ? 0 : (x(at) / W) * 100;

  return (
    <View>
      <View style={{ height }} onLayout={onLayout} {...panResponder.panHandlers}>
        {/* Always rendered — the viewBox math (x/y below) works entirely in
            fixed viewBox units, independent of the container's actual
            measured pixel width. Gating this on `containerWidth > 0` (set
            only by onLayout) meant the whole chart was missing from static
            /server-rendered output, since onLayout never fires there.
            `containerWidth`/`widthRef` are only needed by the touch handler
            below, which converts a real touch's local pixel X into a
            fraction of the container — nothing else depends on it. */}
        <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
          {ticks.map((t) => (
            <Line key={t} x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={QodeColor.divider} strokeWidth={1} />
          ))}
          {series.map((s) => (
            <Polyline
              key={s.label}
              points={s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color ?? ROLE_COLOR[s.role]}
              strokeWidth={s.role === 'benchmark' ? 1.5 : 2}
            />
          ))}
          {at !== null ? (
            <Line x1={x(at)} x2={x(at)} y1={MT} y2={height - MB} stroke={QodeColor.controlBorder} strokeWidth={1} />
          ) : null}
        </Svg>

        {/* Axis labels and hover dots — RN Text/View overlays, percentage
            positioned, not SVG text (see the component doc comment). */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ticks.map((t) => (
            <Text
              key={t}
              style={[styles.axisLabel, styles.axisLabelY, { left: 0, width: ML - 6, top: `${(y(t) / height) * 100}%` }]}>
              {axisTick(t)}
            </Text>
          ))}
          {monthTicks.map((m) => (
            <Text key={m.i} style={[styles.axisLabel, styles.axisLabelX, { left: `${(x(m.i) / W) * 100}%` }]}>
              {m.label}
            </Text>
          ))}
          {at !== null
            ? series
                .filter((s) => s.points[at] !== undefined)
                .map((s) => (
                  <View
                    key={s.label}
                    style={[
                      styles.hoverDot,
                      {
                        left: `${(x(at) / W) * 100}%`,
                        top: `${(y(s.points[at]!.value) / height) * 100}%`,
                        backgroundColor: s.color ?? ROLE_COLOR[s.role],
                      },
                    ]}
                  />
                ))
            : null}
        </View>

        {at !== null && dateSource ? (
          <View
            style={[
              styles.tooltip,
              tipLeftPct > 60
                ? { right: `${100 - tipLeftPct}%`, marginRight: 8 }
                : { left: `${tipLeftPct}%`, marginLeft: 8 },
            ]}
            pointerEvents="none">
            <Text style={styles.tooltipDate}>{dayLabel(dateSource.points[at]?.date ?? '')}</Text>
            {series
              .filter((s) => s.points[at] !== undefined)
              .slice()
              .sort((a, b) => b.points[at]!.value - a.points[at]!.value)
              .map((s) => (
                <View key={s.label} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: s.color ?? ROLE_COLOR[s.role] }]} />
                  <Text style={styles.tooltipLabel}>{s.label}</Text>
                  <Text style={styles.tooltipValue}>{s.points[at]!.value.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color ?? ROLE_COLOR[s.role] }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: {
    position: 'absolute',
    fontFamily: QodeFont.uiRegular,
    fontSize: 10,
    color: QodeColor.textMuted,
  },
  axisLabelY: {
    textAlign: 'right',
    transform: [{ translateY: -6 }],
  },
  axisLabelX: {
    bottom: 2,
    transform: [{ translateX: -14 }],
  },
  hoverDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: QodeColor.greenDeep,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    backgroundColor: QodeColor.greenDeep,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 140,
  },
  tooltipDate: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    color: QodeColor.cream,
    marginBottom: 4,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
  },
  tooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tooltipLabel: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textSecondary,
  },
  tooltipValue: {
    fontFamily: QodeFont.ui,
    fontSize: 10.5,
    color: QodeColor.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textSecondary,
  },
});
