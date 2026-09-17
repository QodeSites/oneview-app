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

// Kept in sync with qode-oneview's review.css :root block — the only two
// CSS custom properties from-analysis.ts's `benchmarkColor()` ever emits
// as a literal Series.color value (checked directly against its source).
const CSS_VAR_COLOR: Record<string, string> = {
  '--series-client': QodeColor.seriesClient,
  '--series-strategy': QodeColor.seriesStrategy,
  '--series-benchmark': QodeColor.seriesBenchmark,
  '--series-benchmark-alt': QodeColor.seriesBenchmarkAlt,
};

/**
 * qode-oneview's real API embeds literal CSS custom-property strings for
 * some series — e.g. `"var(--series-benchmark-alt)"` for BSE/Sensex, so a
 * chart carrying both BSE and NIFTY draws two tellable-apart lines rather
 * than two identical cream ones (from-analysis.ts's own comment on
 * `benchmarkColor()`). That resolves fine in a browser's CSS engine but
 * means nothing to `react-native-svg` — passing it straight through as a
 * `stroke`/`backgroundColor` crashed with `"var(--series-benchmark-alt)" is
 * not a valid color or brush` (16 Sep). Known tokens map to their real
 * value here; anything else — a real color qode-oneview already sends
 * (hex/rgb/rgba), or a `var()` token this map doesn't know about yet —
 * falls back to the plain role color rather than risk another string
 * react-native-svg can't render.
 */
function resolveColor(color: string | undefined, role: Series['role']): string {
  if (!color) return ROLE_COLOR[role];
  const match = /^var\((--[\w-]+)\)$/.exec(color.trim());
  if (!match) return color;
  return CSS_VAR_COLOR[match[1]!] ?? ROLE_COLOR[role];
}

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
  // Deliberately BOTH a ref and state tracking the same measured width, not
  // one or the other. `widthRef` is what `updateAtFromLocalX` (below) reads
  // — it has to be a ref: `panResponder`'s handlers are created once inside
  // `useRef(...)` and permanently close over that first render's function
  // objects, but since those functions read `widthRef.current` rather than
  // a captured local, they still always see the latest measured width
  // regardless of which render's closure ends up being the one that's
  // actually called — a `useState` value read the same way would instead
  // be frozen at whatever it was on that first render. `measuredWidth`
  // (state) exists for the opposite reason: the tooltip's own position
  // (below) is computed during render, where reading a ref is exactly what
  // the React Compiler this project runs under flags as unsafe (`react-
  // hooks/refs`) — state is the one that's safe to read there.
  const widthRef = useRef(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const pointCount = Math.max(...series.map((s) => s.points.length), 2);

  const { yMin, yMax, ticks } = useMemo(() => {
    // Guarded the same way Donut.tsx's slice math was (reported 15 Sep on
    // that component; this one has the identical class of bug, just never
    // hit yet since it only started receiving real `mix` data once
    // performance.tsx's gate was fixed to read it at all). An empty `all`
    // — every series in `mix` resolving to zero points, a real possibility
    // from date-alignment across data sources — makes a bare
    // `Math.min(...[])`/`Math.max(...[])` return `Infinity`/`-Infinity`
    // with no error thrown, cascading into `NaN` polyline coordinates that
    // silently render nothing rather than crashing visibly like Donut did.
    const all = series.flatMap((s) => s.points.map((p) => p.value)).filter(Number.isFinite);
    if (all.length === 0) return { yMin: 0, yMax: 1, ticks: [0, 1] };
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
    setMeasuredWidth(e.nativeEvent.layout.width);
  }

  // A real pixel position, clamped to the container's actual measured
  // width — not the percentage-based left/right switch this used to be.
  // That switch (anchor via `left` below 60% of the way across, `right`
  // above it) assumed the tooltip's own width was small enough to never
  // matter, but the box has no `maxWidth` and sizes to its longest label
  // ("Your Qode Mix" vs "BSE 500" vs "Your portfolio") — three lines
  // longer than 60% would push its far edge straight past the container
  // (reported 16 Sep: "the last one gets out of the box"). `TOOLTIP_WIDTH`
  // below is a genuine, matching `width` on `styles.tooltip` (not just a
  // guess used for this math), so clamping against it is exact rather
  // than another heuristic threshold.
  //
  // Reads `measuredWidth` (state), not `widthRef.current` — this runs
  // during render, and the React Compiler treats a ref read there as
  // unsafe (`react-hooks/refs`: a ref can change without triggering the
  // re-render this calculation depends on). `widthRef` stays reserved for
  // `updateAtFromLocalX` above, which runs from an event handler, not
  // render.
  const TOOLTIP_WIDTH = 168;
  const TOOLTIP_MARGIN = 10;
  const tooltipLeft =
    at === null || measuredWidth <= 0
      ? 0
      : Math.min(
          Math.max((x(at) / W) * measuredWidth + TOOLTIP_MARGIN, TOOLTIP_MARGIN),
          Math.max(measuredWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN, TOOLTIP_MARGIN),
        );

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
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${W} ${height}`}
          // Matches web's NavChart (components/review/charts.tsx), which sets
          // the same prop on its own <svg> — without it, react-native-svg's
          // default "xMidYMid meet" scales x and y by the SAME factor (the
          // smaller of the two), picked here by the huge W=1000 vs. the real
          // container width. Since the RN <Text> axis-label overlays below
          // are positioned by raw percentages of container width/height
          // (assuming x and y each map 1:1 onto 0-100%), a uniform "meet"
          // scale silently compresses+letterboxes the y-axis relative to
          // that assumption — gridlines land at one height, their label
          // overlays at another, reading as a crooked, non-right-angled
          // axis. "none" stretches x and y independently to fill the given
          // width/height exactly, which is what the percentage math assumes.
          preserveAspectRatio="none">
          {ticks.map((t) => (
            <Line key={t} x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={QodeColor.divider} strokeWidth={1} />
          ))}
          {series.map((s) => (
            <Polyline
              key={s.label}
              // Same guard as `yMin`/`yMax` above — a single non-finite
              // point turns into a literal "NaN" token inside this points
              // string, which `react-native-svg`'s native renderer doesn't
              // tolerate any better than it tolerated Donut's malformed
              // strokeDasharray.
              points={s.points
                .map((p, i) => (Number.isFinite(p.value) ? `${x(i).toFixed(1)},${y(p.value).toFixed(1)}` : null))
                .filter((point): point is string => point !== null)
                .join(' ')}
              fill="none"
              stroke={resolveColor(s.color, s.role)}
              strokeWidth={s.role === 'benchmark' ? 1.5 : 2}
              // NOT dashed (corrected 16 Sep). The previous fix for this
              // line's near-invisibility cited `features/report/charts.tsx`
              // as the "intended" design — but that file draws a completely
              // separate, PDF-export-only chart. The actual live web page's
              // NavChart (components/review/charts.tsx, confirmed by reading
              // it directly) has no `strokeDasharray` anywhere; every series,
              // benchmark included, is a plain solid line distinguished only
              // by color/opacity (`ROLE_COLOR.benchmark`'s own quiet,
              // translucent cream). The real bug was purely the missing
              // `vectorEffect` below — fixed on its own merits, no dash
              // needed to make the line visible.
              // Without this, a stroke width given in viewBox units (1.5-2 out
              // of W=1000) gets scaled down by the same huge factor as the
              // coordinates once the SVG maps 1000 units onto a ~350dp phone
              // width — under 1 real device pixel, i.e. invisible. Web's
              // review/charts.tsx applies the same fix (vectorEffect=
              // "non-scaling-stroke" on every series path) so stroke width is
              // read in real pixels, independent of the viewBox scale.
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {at !== null ? (
            <Line
              x1={x(at)}
              x2={x(at)}
              y1={MT}
              y2={height - MB}
              stroke={QodeColor.controlBorder}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </Svg>

        {/* Axis labels and hover dots — RN Text/View overlays, percentage
            positioned, not SVG text (see the component doc comment). */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ticks.map((t) => (
            <Text
              key={t}
              // Overlays sit at fixed chart positions, so very large system
              // text is capped rather than left to collide.
              maxFontSizeMultiplier={1.2}
              style={[
                styles.axisLabel,
                styles.axisLabelY,
                {
                  // Anchored by `right`, not `left` + a fixed `width`. The
                  // previous version (fixed 16 Sep) set `width` to exactly
                  // the plot's own left margin as a percentage of `W`, so
                  // the label's right edge would always land where the
                  // lines start — correct for alignment, but that box is
                  // only ~5% of the chart's width, comfortably wide enough
                  // for a 2-digit tick on a wide screen but too narrow for
                  // a 3-digit one ("180") on many phones, so RN wrapped the
                  // text onto two lines instead of overflowing it the way
                  // a browser would have (reported 16 Sep, a different
                  // screen than the alignment fix was checked against).
                  // `right` pins the same edge without constraining width
                  // at all — the Text sizes to its own content and grows
                  // LEFTWARD as needed, so it can never wrap regardless of
                  // how many digits the tick has, on any screen width.
                  right: `${100 - ((ML - 6) / W) * 100}%`,
                  top: `${(y(t) / height) * 100}%`,
                },
              ]}>
              {axisTick(t)}
            </Text>
          ))}
          {monthTicks.map((m) => (
            <Text
              key={m.i}
              maxFontSizeMultiplier={1.2}
              style={[styles.axisLabel, styles.axisLabelX, { left: `${(x(m.i) / W) * 100}%` }]}>
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
                        backgroundColor: resolveColor(s.color, s.role),
                      },
                    ]}
                  />
                ))
            : null}
        </View>

        {at !== null && dateSource ? (
          <View style={[styles.tooltip, { left: tooltipLeft }]} pointerEvents="none">
            <Text style={styles.tooltipDate}>{dayLabel(dateSource.points[at]?.date ?? '')}</Text>
            {series
              .filter((s) => s.points[at] !== undefined)
              .slice()
              .sort((a, b) => b.points[at]!.value - a.points[at]!.value)
              .map((s) => (
                <View key={s.label} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: resolveColor(s.color, s.role) }]} />
                  <Text style={styles.tooltipLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={styles.tooltipValue}>{s.points[at]!.value.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: resolveColor(s.color, s.role) }]} />
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
  // Fixed `width`, not `minWidth` — the whole point of `tooltipLeft`'s
  // clamp (computed above) is that it's measured against a KNOWN box
  // width, not a guess; a content-driven width here would silently
  // invalidate that math again the next time a label changes.
  tooltip: {
    position: 'absolute',
    top: 4,
    width: 168,
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
