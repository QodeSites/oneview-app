import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius } from '@/constants/qode-theme';
import { money, signedPct } from '@/lib/format';
import type { WealthGap } from '@/lib/mock-data';

/**
 * "Three roads from ₹X" — ported from qode-oneview's `Columns({ gap })`
 * (components/review/Performance.tsx, ~line 620). NOT a bar chart: three
 * bars (benchmark / you / Qode mix), a Catmull-Rom curve drawn exactly
 * through their tops, a dashed zero-reference line, and a gold "alpha"
 * veil + bracket measuring how much of the Qode bar stands above YOUR own
 * level — not the index's. Every geometry constant and the reasoning behind
 * it below is copied from that source, not approximated from memory.
 *
 * Text-over-SVG follows this codebase's established rule (see NavChart.tsx's
 * doc comment): geometry in `react-native-svg`, every label as an
 * absolutely-positioned, percentage-placed RN `<Text>` in a sibling `<View>`
 * — web's own SVG `<text>` elements would otherwise scale (skew-free here,
 * since the aspect ratio is locked below, but still scaled) with the
 * viewBox instead of rendering at a fixed, legible size.
 */
export function ThreeRoads({ gap }: { gap: WealthGap }) {
  const legsRaw = [
    { ...gap.benchmark, role: 'benchmark' as const, fill: QodeColor.seriesBenchmark },
    { ...gap.you, role: 'client' as const, fill: QodeColor.seriesClient },
    { ...gap.qode, role: 'strategy' as const, fill: QodeColor.seriesStrategy },
  ];
  // Defensive against real (not mock) data, same reasoning as NavChart's and
  // Donut's own guards: an extreme or missing `percent` would otherwise
  // cascade into NaN bar heights and a malformed curve/path `d` string,
  // which `react-native-svg`'s native renderer does not tolerate the way a
  // browser's SVG engine would. `value` doesn't need the same guard — it
  // only ever reaches `money()`, which already renders a dash for it.
  const legs = legsRaw.map((l) => ({ ...l, percent: Number.isFinite(l.percent) ? l.percent : 0 }));

  // --- Geometry in viewBox units (PLOT/TOP/BASE/H/BAR verbatim from
  // Columns(); W is not — see its own comment) ------------------------
  const PLOT = 600;
  // Web's real 700 leaves 100 units (14.3% of W) between the last bar's
  // slot and the viewBox's own edge — on web that's genuinely used, since
  // its ALPHA label is SVG `<text>` positioned inside that same space. On
  // mobile the label is an RN `<Text>` overlay that spills OUTSIDE the
  // viewBox entirely, into `ALPHA_GUTTER` below — so that whole 100-unit
  // margin (minus the ~30 units the bracket itself needs) sits genuinely
  // unused inside the SVG, on top of the external gutter. That reads
  // exactly as "the bars and bracket are left-aligned, with dead space at
  // the right corner" (reported 16 Sep, on a phone — not the tablet-width
  // case the `ThreeRoads` `maxWidth` fix two entries back addressed).
  // Tightened to just past where the label starts (`BRACKET + 8` = 630),
  // so the bars/curve/bracket use nearly the full pixel width the
  // external gutter leaves them, instead of ceding an extra internal
  // margin on top of it.
  const W = 636;
  const TOP = 34;
  const BASE = 236;
  const H = 250;
  const BAR = 108;
  const slot = PLOT / legs.length;

  // The scale runs over the returns, always including zero. Padding is
  // added on whichever sides are in use so the tallest bar isn't flush
  // against the canvas top and a negative bar isn't flush against the
  // floor. Guarded against a degenerate span (three identical returns)
  // dividing by zero and putting every bar at NaN.
  const pcts = legs.map((l) => l.percent);
  const hiRaw = Math.max(0, ...pcts);
  const loRaw = Math.min(0, ...pcts);
  const spanRaw = Math.max(hiRaw - loRaw, 0.01);
  const hi = hiRaw + spanRaw * 0.14;
  const lo = loRaw - (loRaw < 0 ? spanRaw * 0.14 : 0);
  const y = (p: number) => BASE - ((p - lo) / (hi - lo)) * (BASE - TOP);
  const zeroY = y(0);

  const pts = legs.map((l, i) => ({ x: slot * i + slot / 2, y: y(l.percent) }));

  // A smooth path through the bar tops. Catmull-Rom converted to cubic
  // béziers: it passes exactly THROUGH each point rather than near it,
  // which matters when the points are bar tops a reader can measure
  // against.
  const curve = pts
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = pts[i - 1]!;
      const cx = (prev.x + p.x) / 2;
      return `C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');

  // The alpha, drawn rather than asserted — measured against YOUR line, not
  // the benchmark's. The reader is not the index; the bar in the middle is
  // theirs, and the question this chart provokes is "how much better off
  // would I have been", not "how did Qode do against the market". So the
  // dashed level sits at the READER's percentage, the veil covers the part
  // of the Qode bar standing above THEM, and the bracket measures that span
  // in points (not rupees — it measures a percentage-axis span, and a rupee
  // figure on it would describe the geometry falsely; the rupee figure is
  // under the client's own bar).
  const alphaPoints = legs[2]!.percent - legs[1]!.percent;
  const benchY = y(legs[1]!.percent);
  const qodeY = y(legs[2]!.percent);
  const qodeX = slot * 2 + (slot - BAR) / 2;
  const bandTop = Math.min(benchY, qodeY);
  const bandH = Math.abs(benchY - qodeY);
  // The veil is clipped to the Qode bar. When the index is negative its
  // level sits below zero, where the Qode bar does not exist, and shading
  // empty air would claim a bar reaches further down than it does.
  const barTop = Math.min(qodeY, zeroY);
  const barBottom = Math.max(qodeY, zeroY);
  const veilTop = Math.max(bandTop, barTop);
  const veilH = Math.min(bandTop + bandH, barBottom) - veilTop;
  const BRACKET = PLOT + 22;
  // Beside the bracket, never inside the band: a band can be two units tall
  // on a portfolio that barely beat the index, and a label that only fits
  // when the number is large is a label that disappears exactly when it is
  // doing the most work. Clamped so a band at either extreme keeps it on
  // the canvas.
  const labelY = Math.min(BASE - 18, Math.max(24, bandTop + bandH / 2));
  // A real, fixed pixel need, not a fraction of the viewBox — like the
  // NavChart.tsx y-axis label fix, text has a minimum legible width that
  // doesn't shrink just because the container does. Web's `.rv-cols__svg`
  // sets `overflow: visible` and lets its SVG `<text>` spill past the
  // nominal viewBox into the card's own generous padding on a ~660px web
  // card (confirmed in review.css); an RN `<Text>` overlay gets no
  // equivalent free pass. Reserving this as real space — rather than
  // widening `W` itself, which was tried and reverted (16 Sep): it fixed
  // the ALPHA label but proportionally shrank the bars AND the writeup
  // columns below them, since both are sized off the same `W` — clipped
  // "Your Qode Mix" instead of fixing anything. This gutter sits OUTSIDE
  // both the bars and the columns, so neither shrinks.
  const ALPHA_GUTTER = 68;

  return (
    <View style={styles.wrap}>
      {/* Only this box (bars, curve, and the ALPHA label inside it) loses
          width to the gutter — the writeup row below is a sibling of this
          whole `View`, not a child of it, so it keeps its full width. The
          ALPHA label, positioned inside the aspectRatio box below, is what
          actually spills rightward past its own 100% edge into this real,
          reserved space. */}
      <View style={{ paddingRight: ALPHA_GUTTER }}>
      {/* The container's aspectRatio locks the rendered box to exactly the
          viewBox's own W:H ratio (matching web's `width:100%; height:auto`,
          which lets the browser's intrinsic-aspect-ratio behavior do the
          same thing) — so x and y always scale by the SAME factor, with no
          skew, and the percentage-positioned text overlays below map onto
          the SVG 1:1 at any card width. `preserveAspectRatio="none"` is set
          anyway, purely so that guarantee holds even if some layout engine
          rounds the measured box a pixel off the exact ratio — with the
          ratio already locked it changes nothing visually (unlike
          NavChart.tsx, which genuinely needs "none" to counter a real
          mismatch between its fixed height and variable width). */}
      <View style={{ aspectRatio: W / H }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {/* Zero — where all three legs began, and the only line on this
              chart that is a fact rather than a scale. */}
          <Line
            x1={0}
            x2={PLOT}
            y1={zeroY}
            y2={zeroY}
            stroke={QodeColor.ghost}
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />

          {/* YOUR level, carried across to the Qode bar. Without it the veil
              is a coloured block with no stated reference. It starts at the
              right edge of the client's bar, which is the thing it is a
              level OF. Drawn behind the bars so it only shows in the gaps
              between them. */}
          <Line
            x1={slot * 1 + (slot + BAR) / 2}
            x2={BRACKET}
            y1={benchY}
            y2={benchY}
            stroke={QodeColor.gold}
            strokeWidth={1}
            strokeDasharray="3 4"
            strokeOpacity={0.55}
            vectorEffect="non-scaling-stroke"
          />

          {legs.map((l, i) => {
            const x = slot * i + (slot - BAR) / 2;
            const top = Math.min(y(l.percent), zeroY);
            const height = Math.abs(y(l.percent) - zeroY);
            return (
              <Rect
                key={l.label}
                x={x}
                y={top}
                width={BAR}
                height={Math.max(height, 0)}
                rx={4}
                fill={l.fill}
              />
            );
          })}

          {alphaPoints > 0 && veilH > 0 ? (
            <Rect x={qodeX} y={veilTop} width={BAR} height={veilH} fill={QodeColor.gold} fillOpacity={0.26} />
          ) : null}

          {/* The level line above runs behind the bars, so it shows in the
              gaps and is hidden where a bar stands — the normal reading of
              a reference level, but it leaves the veil with no lower edge
              on the one bar that matters. This redraws it, solid, only
              where the Qode bar actually reaches. */}
          {benchY >= barTop && benchY <= barBottom ? (
            <Line
              x1={qodeX}
              x2={qodeX + BAR}
              y1={benchY}
              y2={benchY}
              stroke={QodeColor.gold}
              strokeWidth={1.25}
              strokeOpacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          <Path
            d={`M${BRACKET - 5},${bandTop} H${BRACKET} V${bandTop + bandH} H${BRACKET - 5}`}
            fill="none"
            stroke={alphaPoints >= 0 ? QodeColor.gold : QodeColor.error}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* The alpha curve, over the bars. Drawn last (before the knots)
              so it is never clipped by a bar it crosses. */}
          <Path
            d={curve}
            fill="none"
            stroke={QodeColor.gold}
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pts.map((p, i) => (
            <Circle
              key={legs[i]!.label}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={legs[i]!.fill}
              stroke={QodeColor.greenDeep}
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <Line x1={0} x2={PLOT} y1={BASE} y2={BASE} stroke={QodeColor.surfaceBorder} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </Svg>

        {/* Percentage overlays: bar-top return figures, and the ALPHA
            bracket's caption + value. Positioned as percentages of this
            box (which now has the SVG's own aspect ratio locked), not of
            the SVG's internal coordinate system directly — RN has no way
            to read viewBox units, so every x/y below is pre-divided by
            W/H to land at the same fraction of the box the SVG geometry
            uses. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {legs.map((l, i) => {
            const top = Math.min(y(l.percent), zeroY);
            const height = Math.abs(y(l.percent) - zeroY);
            const up = l.percent >= 0;
            return (
              <View
                key={l.label}
                style={[
                  styles.pctBox,
                  {
                    left: `${((slot * i) / W) * 100}%`,
                    width: `${(slot / W) * 100}%`,
                    top: `${((up ? top : top + height) / H) * 100}%`,
                    transform: [{ translateY: up ? -22 : 4 }],
                  },
                ]}>
                <Text style={[styles.pctVal, l.percent >= 0 ? styles.pos : styles.neg]}>{signedPct(l.percent)}</Text>
              </View>
            );
          })}

          <View
            style={[
              styles.alphaBox,
              {
                left: `${((BRACKET + 8) / W) * 100}%`,
                // `marginLeft`: a real, fixed few more dp of clearance from
                // the bracket, on top of the `+8` viewBox-unit gap above.
                // That `+8` is only ~1.1% of `W` — a fine gap on a wide
                // web card, but it scales down to almost nothing on a
                // narrower chart box, reading as the label touching the
                // bracket (reported 16 Sep, on a different phone). Real
                // spacing needs a real minimum, not a percentage of a
                // shrinking container — the same fix already applied to
                // `ALPHA_GUTTER` and the axis label width elsewhere.
                marginLeft: 4,
                top: `${(labelY / H) * 100}%`,
                transform: [{ translateY: -18 }],
              },
            ]}>
            {/* Gold, not green — confirmed against review.css directly:
                `.rv-cols__alpha.is-pos text { fill: var(--gold) }`,
                `.is-neg { fill: var(--neg) }`. Its own comment: "Behind the
                index is not a gold fact" — positive alpha reads as gold
                (this card's own color, matching the bracket beside it),
                never the generic green `.rv-pos` the per-bar percentages
                below use. */}
            <Text style={[styles.alphaCap, alphaPoints >= 0 ? styles.alphaPos : styles.neg]}>ALPHA</Text>
            <Text style={[styles.alphaVal, alphaPoints >= 0 ? styles.alphaPos : styles.neg]}>
              {alphaPoints >= 0 ? '+' : '−'}
              {Math.abs(alphaPoints).toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>
      </View>

      {/* The writeups — a stacked list, one full-width row per leg, not
          three columns aligned under the bars. That column layout went
          through three rounds of real, reported bugs at phone width (16
          Sep): a "you" pill overlapping its neighbor, "Your Qode Mix"
          clipping, and its "fix" (an outer gutter shared with the ALPHA
          label) clipping it worse by taking width from both problems at
          once. Web's own equivalent (`.rv-cols__axis`, checked directly)
          gets away with 3 columns because its card is ~660px wide; a
          ~330dp phone card never had that width budget to begin with, no
          matter how the columns were divided or aligned. A stacked row
          gives every leg the FULL card width for its own label, value and
          delta — nothing to align, nothing to squeeze, nothing left to
          clip regardless of label length or screen size. */}
      <View style={styles.rows}>
        {legs.map((l, i) => {
          const delta = l.value - gap.amount;
          // Qode measured against the READER'S portfolio, not the index —
          // the bracket on the chart answers "how much did Qode beat the
          // market by"; this answers "how much better off would I have
          // been", a different number, so both are stated rather than one
          // standing in for the other.
          const vsYou = l.role === 'strategy' ? l.value - gap.you.value : null;
          return (
            <View key={l.label} style={[styles.row, i === legs.length - 1 && styles.rowLast]}>
              <View style={[styles.dot, { backgroundColor: l.fill }]} />
              <View style={styles.nameBlock}>
                {/* Gold pill with dark text — not web's plain cream label
                    or its small separate "you" badge (`.rv-roads__you`).
                    A deliberate mobile-specific choice, picked from a set
                    of alternatives shown directly to the reader (16 Sep):
                    the dark green text (`QodeColor.greenDeep`, matching
                    what web's own "you" badge already uses) reads clearly
                    against the gold fill — the plain-gold-text version
                    tried earlier had no such badge at all and was easy to
                    miss; a gold pill with muted-grey text (matching the
                    other two labels) was tried in the comparison too and
                    read at noticeably lower contrast than gold-on-dark
                    text everywhere else in the app. */}
                {l.role === 'client' ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillLabel}>{l.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.label}>{l.label}</Text>
                )}
              </View>
              <View style={styles.numBlock}>
                <Text style={styles.amt}>{money(l.value)}</Text>
                <Text style={[styles.amtDelta, delta >= 0 ? styles.pos : styles.neg]}>
                  {delta >= 0 ? '+' : '−'}
                  {money(Math.abs(delta))}
                </Text>
                {vsYou !== null && Math.round(vsYou) !== 0 ? (
                  <Text style={styles.vsYou}>
                    {money(Math.abs(vsYou))} {vsYou > 0 ? 'more' : 'less'} than yours
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `marginTop`: real, fixed headroom above the chart — not a fraction of
  // the viewBox. The topmost bar's percentage label is shifted up by a
  // FIXED `translateY: -22` (see `pctBox`'s usage below) regardless of how
  // tall the chart box itself renders; on a narrower phone, the box (fixed
  // 700:250 aspect ratio, so a narrower card also makes it shorter) can be
  // short enough that shift pushes the label above the chart's own top
  // edge entirely, into the caption text sitting directly above it with no
  // margin of its own (reported 16 Sep, on a different phone than the one
  // this was previously checked against). This dead space absorbs that
  // regardless of device width, the same reasoning as `ALPHA_GUTTER` below.
  // `maxWidth` + `alignSelf: 'center'`: on a card wider than this (a
  // tablet, per the project's own "responsive for mobile devices, tablets,
  // etc." standing rule — see AGENTS.md), the bars/curve/bracket keep
  // their phone-optimized proportions instead of stretching to fill the
  // extra width. Without a cap, that extra width all lands on the RIGHT —
  // `ALPHA_GUTTER` is a fixed 68dp regardless of card width, so on a much
  // wider card the trailing margin the bracket already leaves before that
  // gutter (a fixed fraction of the box's own width) grows into real,
  // visible dead space too, reading as the whole composition sitting
  // left-aligned with an empty right corner (reported 16 Sep). Capping
  // and centering splits any excess width evenly on both sides instead.
  wrap: { width: '100%', maxWidth: 460, alignSelf: 'center', marginTop: 22 },
  pos: { color: QodeColor.success },
  neg: { color: QodeColor.error },
  // Gold specifically for a positive ALPHA figure — see the comment where
  // it's used; kept separate from `pos` (green) since that one still
  // correctly serves the per-bar percentages below (`.rv-cols__pctval.rv-pos`
  // really is green on web).
  alphaPos: { color: QodeColor.gold },
  pctBox: { position: 'absolute', alignItems: 'center' },
  // 13, not web's real 19px — web's own comment calls this figure
  // deliberately "the largest thing on the chart", sized for a ~660px-wide
  // web card. react-native-svg's geometry scales down with the container
  // (percentage/aspectRatio math), but an RN `<Text>` overlay's font size
  // is fixed real dp — so 19dp against a ~330dp phone card reads roughly
  // twice as large, relative to the shrunk bars beside it, as it does on
  // web (reported 16 Sep). Reduced to read at a proportionate size instead
  // of matching the raw pixel value.
  pctVal: { fontFamily: QodeFont.ui, fontSize: 13, fontVariant: ['tabular-nums'] },
  alphaBox: { position: 'absolute', alignItems: 'flex-start' },
  alphaCap: { fontFamily: QodeFont.ui, fontSize: 9.5, letterSpacing: 1, opacity: 0.75 },
  alphaVal: { fontFamily: QodeFont.ui, fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] },
  rows: { marginTop: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: QodeColor.surfaceBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  // `flex: 1` + `minWidth: 0` (not the fixed-fraction columns the aligned
  // layout used): the label gets whatever width is left after the numbers
  // on the right claim theirs, which is always enough for any of these
  // three labels at any card width — the whole reason this row exists.
  nameBlock: { flex: 1, minWidth: 0 },
  numBlock: { alignItems: 'flex-end' },
  label: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textMuted },
  pill: {
    backgroundColor: QodeColor.gold,
    borderRadius: QodeRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillLabel: { fontFamily: QodeFont.ui, fontSize: 13, color: QodeColor.greenDeep },
  amt: { fontFamily: QodeFont.ui, fontSize: 15, color: QodeColor.cream, fontVariant: ['tabular-nums'] },
  amtDelta: { fontFamily: QodeFont.ui, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  vsYou: { fontFamily: QodeFont.ui, fontSize: 11, color: QodeColor.gold },
});
