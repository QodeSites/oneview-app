import { useMemo, useRef, useState } from 'react';
import { Line, Polyline, Rect, Svg } from 'react-native-svg';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont } from '@/constants/qode-theme';
import { dayLabel, monthLabel } from '@/lib/format';

export interface VsiChartSegment {
  key: string;
  /** Short, tooltip-ready name ("Large Cap") — `key` is the raw qode360
   *  segment id ("Top 100"), not something a reader should see. */
  label: string;
  color: string;
  points: { date: string; value: number | null }[];
}

const W = 1000; // viewBox units; the SVG scales to its measured container width
// Left gutter for the "0%"-"100%" labels, in real pixels rather than
// viewBox units: a fixed 3% of the viewBox was ~10px on a phone, so
// "100%" spilled out onto the card's own border. Converted to viewBox
// units per render once the chart's width is measured (`ML` below).
const Y_GUTTER_PX = 34;
const MR = 8;
const MT = 10;
const MB = 20; // bottom gutter for year labels
const Y_TICKS = [0, 20, 40, 60, 80, 100];
/**
 * Risk zones behind the line, in the exact shades of qode360's own VSI
 * chart (/dashboard/research/indicator; sampled from its rendered pixels,
 * 19 Sep, since that source isn't in this repo): pink above 50 = expensive
 * ("Risk OFF"), green below = cheap ("Risk ON").
 */
const BANDS = [
  { from: 70, to: 100, color: '#F5BFC9' },
  { from: 50, to: 70, color: '#FEE5E9' },
  { from: 30, to: 50, color: '#E5F3EF' },
  { from: 0, to: 30, color: '#BDEAD2' },
];
/** qode360's own series color — the app's segment colors (gold, pastels) wash out on these light bands. */
const LINE_COLOR = '#003F28';
// Darker than qode360's own label reds/greens (#D8494A / #4FA96F), which
// read at ~2.7:1 on the bands; these clear ~4:1 at phone font sizes.
const RISK_OFF_TEXT = '#B42318';
const RISK_ON_TEXT = '#1E7B45';
/**
 * Points per line above this are downsampled — a smooth 10-year daily
 * series (2,500+ points × 5 segments) reads identically at this density on
 * a phone screen, and unlike web's Highcharts, react-native-svg has no
 * built-in decimation.
 */
const MAX_POINTS = 400;
/**
 * Year labels are capped at this many regardless of the data's real span —
 * qode360's own "10 Years" lookback parameter turned out not to actually
 * bound the response (a live pull returned data back to 2000, a 26-year
 * range, not 10 — checked directly, 18 Sep), and one label per calendar
 * year over that many years collided into unreadable overlapping text on
 * a phone-width chart (reported same day). A handful of evenly-spaced
 * years reads the same way NavChart's own month ticks already thin a
 * dense axis down for a narrow screen.
 */
const MAX_YEAR_TICKS = 6;

function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}

/** The point in `pts` closest to `targetT` by time — segments can carry
 *  different dates, so this is a nearest-match, not an exact one. */
function nearestPoint<T extends { t: number }>(pts: T[], targetT: number): T | null {
  if (!pts.length) return null;
  let best = pts[0]!;
  let bestDist = Math.abs(best.t - targetT);
  for (const p of pts) {
    const d = Math.abs(p.t - targetT);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Market Breadth chart — mobile port of web's `Vsi.tsx` (Highcharts). No RN
 * equivalent of Highcharts exists in this app (the only chart web ever used
 * it for), so this is hand-rolled SVG matching `NavChart`'s own pattern
 * instead of adding a new native charting dependency for one screen —
 * including its touch-and-drag tooltip (added 18 Sep; the first version of
 * this chart shipped without one at all).
 *
 * Time-based x-axis, not index-based like `NavChart` — VSI's five segments
 * can carry different point counts/date ranges from qode360, unlike
 * NavChart's series, which are always aligned by day-index from the same
 * engine run. Y-axis is a fixed 0-100%, since every segment is itself a
 * percentage — no per-series rescaling needed the way NAV comparisons need.
 * The touch handler and tooltip both work in real timestamps rather than a
 * shared index for the same reason: `at` is "the moment being pointed at",
 * and each segment's tooltip row finds its own nearest point to that
 * moment independently (`nearestPoint`), rather than assuming every
 * segment has a point at the same index NavChart's aligned series would.
 *
 * Every segment passed in draws at the same weight — this used to also
 * take a single `highlighted` key and dim everything else, but the reader
 * can now pick any number of segments on the screen above (matching web's
 * own multi-select, changed 18 Sep from a one-at-a-time radio group on
 * both platforms), so "the rest, dimmed" no longer describes anything:
 * `vsi.tsx` only ever passes the segments actually selected.
 */
export function VsiChart({
  segments,
  height = 240,
  zoneLabel,
}: {
  segments: VsiChartSegment[];
  height?: number;
  /** Names the zones, e.g. "Large Cap" → "Risk OFF: Underweight Large Cap". Omitted → no zone labels. */
  zoneLabel?: string;
}) {
  const [atT, setAtT] = useState<number | null>(null);
  // Both a ref and state tracking the same measured width, deliberately —
  // see NavChart's own comment on this exact pattern (`widthRef` for the
  // PanResponder closure, which needs the latest value regardless of which
  // render created it; `measuredWidth` for the tooltip position computed
  // during render, where the React Compiler flags a ref read as unsafe).
  const widthRef = useRef(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const ML = measuredWidth > 0 ? (Y_GUTTER_PX / measuredWidth) * W : 30;

  const { minT, maxT, lines } = useMemo(() => {
    const all = segments.flatMap((s) =>
      s.points.filter((p) => Number.isFinite(p.value)).map((p) => Date.parse(p.date)),
    );
    const lo = all.length ? Math.min(...all) : 0;
    const hi = all.length ? Math.max(...all) : 1;
    const lines = segments.map((s) => {
      const finite = s.points.filter((p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.date)));
      const sampled = downsample(finite, MAX_POINTS);
      const pts = sampled.map((p) => ({ t: Date.parse(p.date), v: p.value as number, date: p.date }));
      return { key: s.key, label: s.label, color: s.color, pts };
    });
    return { minT: lo, maxT: hi, lines };
  }, [segments]);

  const x = (t: number) => ML + ((t - minT) / (maxT - minT || 1)) * (W - ML - MR);
  const y = (v: number) => MT + (1 - v / 100) * (height - MT - MB);

  const yearTicks = useMemo(() => {
    if (!Number.isFinite(minT) || !Number.isFinite(maxT) || minT >= maxT) return [];
    // Short windows (the 1Y / 2Y period filters) span only one or two
    // 1 Jan boundaries, so they get month ticks instead of year ticks.
    const spanDays = (maxT - minT) / 86_400_000;
    if (spanDays < 3 * 365) {
      const stepMonths = spanDays <= 400 ? 3 : 6;
      const end = new Date(maxT);
      let yr = end.getUTCFullYear();
      let mo = end.getUTCMonth() - (end.getUTCMonth() % stepMonths);
      const months: { t: number; label: string }[] = [];
      for (;;) {
        const t = Date.UTC(yr, mo, 1);
        if (t < minT) break;
        if (t <= maxT) months.unshift({ t, label: monthLabel(new Date(t).toISOString()) });
        mo -= stepMonths;
        if (mo < 0) {
          mo += 12;
          yr -= 1;
        }
      }
      return months;
    }
    const startYear = new Date(minT).getUTCFullYear();
    const endYear = new Date(maxT).getUTCFullYear();
    const span = endYear - startYear + 1;
    const step = Math.max(1, Math.ceil(span / MAX_YEAR_TICKS));
    // Anchored at the END and walked backward, not forward from the
    // start with the most recent year appended afterward — appending
    // could land within a year or two of the step's own last tick (e.g.
    // …2015, 2020, 2025, then 2026 tacked on right beside it), crowding
    // exactly the two labels a reader looks at first while every other
    // pair sat a full step apart (reported 18 Sep, "the last year is
    // clipping with previous values"). Walking back from `endYear`
    // guarantees the final tick IS the most recent year, evenly spaced
    // from its neighbour like every other pair.
    const out: { t: number; label: string }[] = [];
    for (let yr = endYear; yr >= startYear; yr -= step) {
      const t = Date.UTC(yr, 0, 1);
      if (t >= minT && t <= maxT) out.unshift({ t, label: String(yr) });
    }
    return out;
  }, [minT, maxT]);

  function updateAtFromLocalX(localX: number) {
    if (widthRef.current <= 0 || !Number.isFinite(minT) || !Number.isFinite(maxT) || minT >= maxT) return;
    const frac = localX / widthRef.current;
    const sx = frac * W;
    // From `widthRef`, not the render-time `ML`: the PanResponder holding
    // this function is created once, before the first layout measures a width.
    const ml = (Y_GUTTER_PX / widthRef.current) * W;
    const t = minT + ((sx - ml) / (W - ml - MR)) * (maxT - minT);
    setAtT(t >= minT && t <= maxT ? t : null);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => updateAtFromLocalX(evt.nativeEvent.locationX),
      onPanResponderGrant: (evt) => updateAtFromLocalX(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setAtT(null),
      onPanResponderTerminate: () => setAtT(null),
    }),
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
    setMeasuredWidth(e.nativeEvent.layout.width);
  }

  // The line with the most points is the most reliable source for "what
  // date is this", the same role `dateSource` plays in NavChart.
  const dateSourceLine = lines.reduce((a, s) => (s.pts.length >= a.pts.length ? s : a), lines[0]);
  const atRows =
    atT === null
      ? []
      : lines
          .map((s) => ({ ...s, near: nearestPoint(s.pts, atT) }))
          .filter((s): s is typeof s & { near: NonNullable<(typeof s)['near']> } => s.near !== null)
          .sort((a, b) => b.near.v - a.near.v);
  const atDate = atT === null ? null : nearestPoint(dateSourceLine?.pts ?? [], atT)?.date ?? null;

  const TOOLTIP_WIDTH = 150;
  const TOOLTIP_MARGIN = 10;
  const tooltipLeft =
    atT === null || measuredWidth <= 0
      ? 0
      : Math.min(
          Math.max((x(atT) / W) * measuredWidth + TOOLTIP_MARGIN, TOOLTIP_MARGIN),
          Math.max(measuredWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN, TOOLTIP_MARGIN),
        );

  return (
    <View style={{ height }} onLayout={onLayout} {...panResponder.panHandlers}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        {BANDS.map((b) => (
          <Rect key={b.from} x={ML} y={y(b.to)} width={W - MR - ML} height={y(b.from) - y(b.to)} fill={b.color} />
        ))}
        {[20, 80].map((t) => (
          <Line
            key={t}
            x1={ML}
            x2={W - MR}
            y1={y(t)}
            y2={y(t)}
            stroke={QodeColor.gold}
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <Line
          x1={ML}
          x2={W - MR}
          y1={y(50)}
          y2={y(50)}
          stroke="#000B02"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
        {lines.map((s) => (
          <Polyline
            key={s.key}
            points={s.pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            // Real pixels regardless of the viewBox's scale-down factor —
            // same fix NavChart needed for the identical reason (see its
            // own comment on this prop).
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {atT !== null ? (
          <Line
            x1={x(atT)}
            x2={x(atT)}
            y1={MT}
            y2={height - MB}
            stroke={LINE_COLOR}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Y_TICKS.map((t) => (
          <Text
            key={t}
            maxFontSizeMultiplier={1.2}
            style={[
              styles.axisLabel,
              styles.axisLabelY,
              // Anchored by `right`, not `left` — the plot's own left
              // gutter (`ML`, then 3% of the viewBox) was only wide enough for
              // a 2-digit tick on a wide screen; "100%" grew past it and
              // sat on top of the lines themselves (reported 18 Sep,
              // "graph is intersecting with y axis"). `right` pins the
              // label's edge at the plot's own boundary and lets it grow
              // LEFTWARD instead, the same fix NavChart's y-axis already
              // uses for the identical problem.
              { right: `${100 - ((ML - 4) / W) * 100}%`, top: `${(y(t) / height) * 100}%` },
            ]}>
            {t}%
          </Text>
        ))}
        {zoneLabel ? (
          <>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={[styles.zoneLabel, { color: RISK_OFF_TEXT, left: `${((ML + 6) / W) * 100}%`, top: MT + 3 }]}>
              Risk OFF: Underweight {zoneLabel}
            </Text>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={[styles.zoneLabel, { color: RISK_ON_TEXT, left: `${((ML + 6) / W) * 100}%`, bottom: MB + 3 }]}>
              Risk ON: Overweight {zoneLabel}
            </Text>
          </>
        ) : null}
        {yearTicks.map((yt) => (
          <Text
            key={yt.t}
            maxFontSizeMultiplier={1.2}
            style={[styles.axisLabel, styles.axisLabelX, { left: `${(x(yt.t) / W) * 100}%` }]}>
            {yt.label}
          </Text>
        ))}
        {atRows.map((s) => (
          <View
            key={s.key}
            style={[
              styles.hoverDot,
              { left: `${(x(atT!) / W) * 100}%`, top: `${(y(s.near.v) / height) * 100}%`, backgroundColor: s.color },
            ]}
          />
        ))}
      </View>

      {atT !== null && atRows.length ? (
        <View style={[styles.tooltip, { left: tooltipLeft }]} pointerEvents="none">
          <Text style={styles.tooltipDate}>{dayLabel(atDate)}</Text>
          {atRows.map((s) => (
            <View key={s.key} style={styles.tooltipRow}>
              <View style={[styles.tooltipDot, { backgroundColor: s.color }]} />
              <Text style={styles.tooltipLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.tooltipValue}>{s.near.v.toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  zoneLabel: {
    position: 'absolute',
    fontFamily: QodeFont.ui,
    fontSize: 10,
  },
  axisLabelY: {
    textAlign: 'right',
    transform: [{ translateY: -6 }],
  },
  axisLabelX: {
    bottom: 2,
    transform: [{ translateX: -10 }],
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
  // Fixed `width`, not `minWidth` — same reason as NavChart's own tooltip:
  // `tooltipLeft`'s clamp above is measured against a KNOWN box width, so
  // a content-driven width would silently invalidate that math.
  tooltip: {
    position: 'absolute',
    top: 4,
    width: 150,
    backgroundColor: QodeColor.greenDeep,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
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
});
