import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextProps } from 'react-native';
import { Line, Svg, Text as SvgText } from 'react-native-svg';

import { CountUp, DrawLine, FadeIn, GrowingDonut, GrowX, PlayProvider, PulseDot } from '@/components/welcome/motion';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';

/**
 * The review cards from the web sign-in page (qode-oneview
 * `components/auth/PreviewDeck.tsx`), one per welcome page.
 *
 * Three of web's four chapters — what you hold, where the gap is,
 * allocation by market cap — with web's own illustrative figures and the
 * same shell: Qode / Portfolio review header, stat boxes, the chart, a
 * foot row and the "for illustration only" line. Web stacks them in an
 * animated deck; here the welcome screen swipes between them (17 Sep).
 *
 * Each card builds itself while `playing` (./motion.tsx): figures count
 * up, the donut fills, lines draw and bars grow.
 */

/** Web's `--login-panel`: green-deep mixed 78/22 with green-base. */
const PANEL = '#01271B';
const TRACK = 'rgba(239, 236, 211, 0.12)';
const CHART = {
  c1: '#DABD38',
  c2: '#C2D583',
  c3: '#8FC48D',
  c4: '#57AC9C',
};
const BENCHMARK = 'rgba(239, 236, 211, 0.55)';

type Tone = 'loss' | 'profit' | undefined;
interface Stat {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

/**
 * The cards are an illustration with fixed proportions, so very large
 * system text is capped here rather than left to burst the layout.
 */
function T(props: TextProps) {
  return <Text maxFontSizeMultiplier={1.3} {...props} />;
}

const toneColor = (tone: Tone) =>
  tone === 'loss' ? QodeColor.coral : tone === 'profit' ? QodeColor.mint : QodeColor.textPrimary;

/* -- Card 01 · What you hold ------------------------------------------- */

const HOLDINGS = [
  { label: 'Stocks', value: '₹4,44,474', percent: 63.2, count: '8 positions', color: CHART.c1 },
  { label: 'Mutual funds', value: '₹1,37,997', percent: 19.6, count: '5 schemes', color: CHART.c2 },
  { label: 'ETFs', value: '₹85,546', percent: 12.2, count: '1 holding', color: CHART.c3 },
  { label: 'Bank', value: '₹35,662', percent: 5.0, count: '1 account', color: CHART.c4 },
];

const X = [34, 81, 127, 174, 221, 267, 314];
const toY = (v: number) => 110 - (v - 90) * 2.5;
const line = (values: number[]): [number, number][] => values.map((v, i) => [X[i]!, toY(v)]);
const QODE_LINE = line([100, 108, 104, 115, 110, 122, 124]);
const QODE_END = QODE_LINE[QODE_LINE.length - 1]!;

function HoldBody() {
  return (
    <>
      <View style={styles.donutCol}>
        <GrowingDonut
          size={60}
          thickness={13}
          delay={200}
          trackColor={TRACK}
          slices={HOLDINGS.map((h) => ({ label: h.label, percent: h.percent, color: h.color }))}
        />
        <View style={styles.legendRows}>
          {HOLDINGS.map((h, i) => (
            // Each row arrives as its slice fills.
            <FadeIn key={h.label} delay={250 + i * 280} style={styles.legendRowTop}>
              <View style={[styles.dot, styles.dotTop, { backgroundColor: h.color }]} />
              <View style={styles.shrink}>
                <T style={styles.legendStrong}>{h.label}</T>
                <T style={styles.legendMeta}>
                  {h.value} · {h.percent.toFixed(1)}% · {h.count}
                </T>
              </View>
            </FadeIn>
          ))}
        </View>
      </View>

      <View>
        <T style={styles.chartTitle}>Your return, rebased to 100</T>
        <View style={styles.chartBox}>
          <Svg width="100%" height="100%" viewBox="0 0 320 130">
            {[90, 100, 110, 120, 130].map((v) => (
              <Line key={v} x1={34} x2={314} y1={toY(v)} y2={toY(v)} stroke={QodeColor.divider} strokeWidth={0.8} />
            ))}
            {[90, 100, 110, 120, 130].map((v) => (
              <SvgText
                key={`t${v}`}
                x={28}
                y={toY(v) + 3.5}
                textAnchor="end"
                fontSize={10}
                fontFamily={QodeFont.uiRegular}
                fill={QodeColor.textMuted}>
                {v}
              </SvgText>
            ))}
            {(
              [
                { x: X[0], label: 'Sept 2025', anchor: 'start' },
                { x: X[2], label: 'Jan 2026', anchor: 'middle' },
                { x: X[4], label: 'May 2026', anchor: 'middle' },
                { x: X[6], label: 'Sept 2026', anchor: 'end' },
              ] as const
            ).map((m) => (
              <SvgText
                key={m.label}
                x={m.x}
                y={127}
                textAnchor={m.anchor}
                fontSize={10}
                fontFamily={QodeFont.uiRegular}
                fill={QodeColor.textMuted}>
                {m.label}
              </SvgText>
            ))}
            <DrawLine points={line([100, 102, 99, 103, 101, 104, 100.5])} stroke={BENCHMARK} strokeWidth={1.6} delay={600} />
            <DrawLine points={line([100, 97, 103, 98, 95, 101, 99])} stroke={QodeColor.coral} strokeWidth={1.8} delay={800} />
            <DrawLine points={QODE_LINE} stroke={QodeColor.gold} strokeWidth={2.2} delay={1000} duration={1700} />
            <PulseDot cx={QODE_END[0]} cy={QODE_END[1]} color={QodeColor.gold} delay={2600} />
          </Svg>
        </View>
        <View style={styles.chartLegend}>
          <LegendChip color={QodeColor.coral} label="Your portfolio" />
          <LegendChip color={QodeColor.gold} label="Your Qode mix" />
          <LegendChip color={BENCHMARK} label="BSE 500" />
        </View>
      </View>
    </>
  );
}

/* -- Card 02 · Where the gap is ---------------------------------------- */

const ROADS = [
  { label: 'Your portfolio', value: 703679, text: '₹7,03,679', color: QodeColor.coral },
  { label: 'BSE 500', value: 714483, text: '₹7,14,483', color: BENCHMARK },
  { label: 'Your Qode mix', value: 881873, text: '₹8,81,873', color: QodeColor.gold },
];
const ROAD_START = 710787;
const ROAD_SPAN = Math.max(...ROADS.map((r) => r.value)) - ROAD_START;

function GapBody() {
  return (
    <>
      <View>
        <T style={styles.chartTitle}>Three roads from ₹7,10,787</T>
        <View style={styles.barList}>
          {ROADS.map((r, i) => (
            <View key={r.label} style={styles.barRow}>
              <T style={[styles.legendText, styles.roadLabel]} numberOfLines={1}>
                {r.label}
              </T>
              <View style={styles.barTrack}>
                <GrowX
                  delay={300 + i * 200}
                  duration={1100}
                  style={[
                    styles.bar,
                    { width: `${Math.max(3, ((r.value - ROAD_START) / ROAD_SPAN) * 100)}%`, backgroundColor: r.color },
                  ]}
                />
              </View>
              <CountUp
                TextComponent={T}
                value={r.text}
                delay={300 + i * 200}
                style={[styles.legendValue, styles.roadValue]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.gapStrip}>
        <GapItem delay={1000} label="Benchmark gap" value="₹10,804" note="Your portfolio against BSE 500." />
        <FadeIn delay={1200} style={styles.gapOpBox}>
          <T style={styles.gapOp}>+</T>
        </FadeIn>
        <GapItem delay={1300} label="Alpha potential" value="₹1,67,390" note="BSE 500 against the Qode mix." />
        <FadeIn delay={1500} style={styles.gapOpBox}>
          <T style={styles.gapOp}>=</T>
        </FadeIn>
        <GapItem delay={1600} label="Total wealth gap" value="₹1,78,194" note="Your portfolio against the Qode mix." total />
      </View>
    </>
  );
}

function GapItem({
  label,
  value,
  note,
  total,
  delay,
}: {
  label: string;
  value: string;
  note: string;
  total?: boolean;
  delay: number;
}) {
  return (
    <FadeIn delay={delay} style={[styles.gapItem, total && styles.gapItemTotal]}>
      <T style={styles.eyebrow}>{label}</T>
      <CountUp
        TextComponent={T}
        value={value}
        delay={delay}
        style={[styles.gapValue, total && { color: QodeColor.mint }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      />
      <T style={styles.gapNote}>{note}</T>
    </FadeIn>
  );
}

/* -- Card 03 · Allocation by market cap -------------------------------- */

const CAP_MIX = [
  { label: 'Large cap', percent: 58, color: CHART.c1 },
  { label: 'Mid cap', percent: 27, color: CHART.c3 },
  { label: 'Small & micro', percent: 15, color: CHART.c4 },
];
const LARGE_TABLE: { metric: string; caption: string; cells: [string, string, string]; best: 0 | 1 | 2 }[] = [
  { metric: 'Return', caption: 'Higher is better', cells: ['+12.79%', '+21.23%', '−5.79%'], best: 1 },
  { metric: 'Max drawdown', caption: 'Smaller fall is better', cells: ['−2.27%', '−8.33%', '−15.18%'], best: 0 },
  { metric: 'Volatility', caption: 'Lower is better', cells: ['5.37%', '17.50%', '12.95%'], best: 0 },
];

function CapBody() {
  return (
    <>
      <View>
        <T style={styles.chartTitle}>How your equity splits across the SEBI bands</T>
        <View style={styles.stack}>
          {/* Bands fill one after another, left to right. */}
          {CAP_MIX.map((c, i) => (
            <View key={c.label} style={{ flex: c.percent }}>
              <GrowX delay={300 + i * 450} duration={600} style={[styles.fill, { backgroundColor: c.color }]} />
            </View>
          ))}
        </View>
        <View style={styles.legendRows}>
          {CAP_MIX.map((c, i) => (
            <FadeIn key={c.label} delay={300 + i * 450} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <T style={[styles.legendText, styles.shrink]}>{c.label}</T>
              <CountUp
                TextComponent={T}
                value={`${c.percent}%`}
                delay={300 + i * 450}
                duration={600}
                style={styles.legendValue}
              />
            </FadeIn>
          ))}
        </View>
      </View>

      <View>
        <T style={styles.chartTitle}>Large cap, side by side</T>
        <View style={[styles.tableRow, styles.tableHeadRow]}>
          <View style={styles.tableMetric} />
          {['You', 'Qode All Weather', 'Nifty 50'].map((h, i) => (
            <T key={h} style={[styles.tableHead, i === 1 && styles.tableQode]}>
              {h}
            </T>
          ))}
        </View>
        {LARGE_TABLE.map((r, ri) => (
          <FadeIn key={r.metric} delay={1700 + ri * 250} style={[styles.tableRow, ri > 0 && styles.tableRowRule]}>
            <View style={styles.tableMetric}>
              <T style={styles.tableMetricText}>{r.metric}</T>
              <T style={styles.tableCaption}>{r.caption}</T>
            </View>
            {r.cells.map((c, i) => (
              <T
                key={i}
                style={[styles.tableCell, i === 1 && styles.tableQode, i === r.best && styles.tableBest]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {c}
              </T>
            ))}
          </FadeIn>
        ))}
      </View>
    </>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <T style={styles.legendText}>{label}</T>
    </View>
  );
}

/* -- The shell --------------------------------------------------------- */

const CARDS: { title: string; stats: Stat[]; foot: Stat[]; body: ReactNode }[] = [
  {
    title: 'What You Hold',
    stats: [
      { label: 'Total portfolio', value: '₹7,03,679', sub: 'Securities ₹6,68,017 · cash ₹35,662' },
      { label: 'Holdings', value: '15', sub: 'Across 4 asset types' },
      { label: 'Priced as at', value: '7 Sept 2026', sub: 'No bank account linked' },
    ],
    foot: [
      { label: 'Your return', value: '−1.00%', tone: 'loss' },
      { label: 'Your Qode mix', value: '+24.07%', tone: 'profit' },
      { label: 'Period', value: 'Sept 2025 – Sept 2026' },
    ],
    body: <HoldBody />,
  },
  {
    title: 'Where the Gap Is',
    stats: [
      { label: 'Yours grew to', value: '₹7,03,679', sub: '−1.00% on ₹7,10,787', tone: 'loss' },
      { label: 'BSE 500 to', value: '₹7,14,483', sub: '+0.52%, same money', tone: 'profit' },
      { label: 'Qode mix to', value: '₹8,81,873', sub: '+24.07%, same money', tone: 'profit' },
    ],
    foot: [
      { label: 'Your return', value: '−1.00%', tone: 'loss' },
      { label: 'BSE 500', value: '+0.52%', tone: 'profit' },
      { label: 'Your Qode mix', value: '+24.07%', tone: 'profit' },
    ],
    body: <GapBody />,
  },
  {
    title: 'Allocation by Market Cap',
    stats: [
      { label: 'Large cap', value: '58%', sub: 'Matched to Qode All Weather' },
      { label: 'Mid cap', value: '27%', sub: 'Matched to Qode Tactical Fund' },
      { label: 'Small & micro', value: '15%', sub: 'Matched to Qode Growth Fund' },
    ],
    foot: [
      { label: 'Direct', value: '₹4,44,474' },
      { label: 'Through funds', value: '₹2,23,543' },
      { label: 'Others', value: '₹35,662' },
    ],
    body: <CapBody />,
  },
];

const COUNT = CARDS.length;

/** One review card, filling the width it's given. */
export function PreviewCard({ index, playing, still }: { index: number; playing: boolean; still: boolean }) {
  const card = CARDS[index]!;
  return (
    <PlayProvider playing={playing} still={still}>
      <View style={[styles.card, styles.cardInner]}>
        <View style={styles.head}>
          <T style={styles.headBrand}>Qode</T>
          <T style={styles.headRight}>PORTFOLIO REVIEW</T>
        </View>

        <View style={styles.section}>
          <T style={styles.sectionTitle}>{card.title}</T>
          <T style={styles.chapter}>
            0{index + 1} <T style={styles.chapterOf}>/ 0{COUNT}</T>
          </T>
        </View>

        <View style={styles.statBoxes}>
          {card.stats.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <T style={styles.eyebrow}>{s.label}</T>
              <CountUp
                TextComponent={T}
                value={s.value}
                style={[styles.statValue, { color: toneColor(s.tone) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              />
              {s.sub ? <T style={styles.statSub}>{s.sub}</T> : null}
            </View>
          ))}
        </View>

        <View style={styles.body}>{card.body}</View>

        <View style={styles.foot}>
          {card.foot.map((s) => (
            <View key={s.label} style={styles.shrink}>
              <T style={styles.eyebrow}>{s.label}</T>
              <CountUp
                TextComponent={T}
                value={s.value}
                delay={600}
                style={[styles.footValue, { color: toneColor(s.tone) }]}
              />
            </View>
          ))}
        </View>

        <T style={styles.disclaimer}>* For illustration only — your own figures appear once you link.</T>
      </View>
    </PlayProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
  },
  cardInner: {
    padding: QodeSpace[3],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: QodeSpace[2],
    borderBottomWidth: 1.5,
    borderBottomColor: QodeColor.gold,
  },
  headBrand: { fontFamily: QodeFont.displayBold, fontSize: 15, color: QodeColor.cream },
  headRight: { fontFamily: QodeFont.ui, fontSize: 10, letterSpacing: 1, color: QodeColor.textSecondary },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: QodeSpace[2],
    marginBottom: 6,
  },
  sectionTitle: { flexShrink: 1, fontFamily: QodeFont.display, fontSize: 13, color: QodeColor.textPrimary },
  chapter: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, letterSpacing: 0.6, color: QodeColor.textSecondary },
  chapterOf: { color: QodeColor.textMuted },
  statBoxes: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: QodeSpace[2],
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  eyebrow: {
    fontFamily: QodeFont.ui,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: QodeColor.textMuted,
    marginBottom: 2,
  },
  statValue: { fontFamily: QodeFont.ui, fontSize: 13, fontVariant: ['tabular-nums'] },
  statSub: { fontFamily: QodeFont.uiRegular, fontSize: 9, lineHeight: 11.5, color: QodeColor.textMuted, marginTop: 1 },
  body: {
    gap: QodeSpace[3],
    paddingTop: QodeSpace[2],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
    marginBottom: QodeSpace[2],
  },
  donutCol: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[2] },
  legendRows: { flex: 1, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotTop: { marginTop: 4 },
  shrink: { flexShrink: 1 },
  legendStrong: { fontFamily: QodeFont.ui, fontSize: 11, color: QodeColor.textPrimary },
  legendMeta: { fontFamily: QodeFont.uiRegular, fontSize: 9.5, lineHeight: 12, color: QodeColor.textMuted, fontVariant: ['tabular-nums'] },
  legendText: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textSecondary },
  legendValue: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textPrimary, fontVariant: ['tabular-nums'] },
  chartTitle: { fontFamily: QodeFont.uiRegular, fontSize: 12, color: QodeColor.textSecondary, marginBottom: 4 },
  chartBox: { width: '100%', aspectRatio: 320 / 130 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 4, marginTop: 4 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barList: { gap: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roadLabel: { width: '32%' },
  roadValue: { width: 64, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: TRACK, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  gapStrip: { flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  gapItem: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.sm,
  },
  gapItemTotal: { borderColor: QodeColor.accentBorder },
  gapValue: { fontFamily: QodeFont.ui, fontSize: 12.5, color: QodeColor.textPrimary, fontVariant: ['tabular-nums'] },
  gapNote: { fontFamily: QodeFont.uiRegular, fontSize: 9, lineHeight: 11.5, color: QodeColor.textMuted, marginTop: 2 },
  gapOpBox: { alignSelf: 'center' },
  fill: { flex: 1 },
  gapOp: { alignSelf: 'center', fontFamily: QodeFont.uiRegular, fontSize: 14, color: QodeColor.textMuted },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 2, marginBottom: 8 },
  tableRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tableHeadRow: { borderBottomWidth: 1, borderBottomColor: QodeColor.divider, alignItems: 'flex-end' },
  tableRowRule: { borderTopWidth: 1, borderTopColor: QodeColor.divider },
  tableMetric: { flex: 1.3, paddingVertical: 4, paddingRight: 4 },
  tableMetricText: { fontFamily: QodeFont.ui, fontSize: 10.5, color: QodeColor.textPrimary },
  tableCaption: { fontFamily: QodeFont.uiRegular, fontSize: 8.5, color: QodeColor.textMuted },
  tableHead: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlign: 'right',
    fontFamily: QodeFont.ui,
    fontSize: 8.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: QodeColor.textMuted,
  },
  tableCell: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlign: 'right',
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tableQode: { backgroundColor: QodeColor.surface, color: QodeColor.textPrimary },
  tableBest: { fontFamily: QodeFont.ui, color: QodeColor.mint },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: QodeSpace[3],
    rowGap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  footValue: { fontFamily: QodeFont.ui, fontSize: 13, fontVariant: ['tabular-nums'] },
  disclaimer: { fontFamily: QodeFont.uiRegular, fontSize: 10, color: QodeColor.textMuted, marginTop: 6 },
});
