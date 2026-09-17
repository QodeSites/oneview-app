import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalysisBuilding } from '@/components/BuildingReview';
import { NavChart } from '@/components/charts/NavChart';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, monthYearLabel, pct } from '@/lib/format';
import type { CapBand, CapContentRow, CapSlice, MetricCard, BucketId } from '@/lib/mock-data';
import { getCapAnalysis } from '@/lib/reviewApi';

// capSections only ever has these three ids — qode-oneview builds it from a
// fixed 3-entry list (from-analysis.ts's `BANDS`), with Micro always folded
// into "Small & Micro" server-side (no dedicated Qode strategy is left to
// compare a standalone Micro tab against). `capMix`, read below for the
// actual money figures, can still carry a separate `"micro"` slice — see
// `shareOf`/`rowsFor`.
const KNOWN_SECTION_IDS: BucketId[] = ['large', 'mid', 'small'];
/** Narrowest band-bar segment that can hold its "12.34%" label. */
const BAND_LABEL_MIN_WIDTH = 46;
type Tab = BucketId | 'others';

/**
 * Segment Analysis — real data from qode-oneview's cap-analysis composition
 * via `GET /api/mobile/cap-analysis` (see MOBILE_BACKEND_CHANGES.md).
 *
 * Ported directly against `qode-oneview/src/components/review/CapAnalysis.tsx`
 * (read in full, not guessed at) — this screen used to show only a sliver of
 * that page (a metrics table and a "top holdings" list), missing the NAV
 * chart, the SEBI-band split bar, the correct Stocks-vs-Mutual-funds
 * breakdown, and the Others tab entirely (reported 16 Sep). All four are
 * ported here, matching web's own maths, not an approximation of it:
 *
 * - `shareOf()`/`rowsFor()` read `capMix`/`capContents`, not
 *   `section.percentOfPortfolio`/`section.top` — web's own code comment
 *   explains why: the section is the ENGINE's valuation and capMix is the
 *   AA's, and reading the engine's number for "how much of your portfolio"
 *   once summed bands to 133% on a real account. `capMix`/`capContents` are
 *   the only figures also used by the donut, so this screen can no longer
 *   disagree with it.
 * - Small and Micro are combined for money purposes even though Micro can
 *   still arrive as its own `capMix` slice — `shareOf('small')` and
 *   `rowsFor('small')` both sum bands `["small", "micro"]`, exactly
 *   matching web's own `shareOf`/`rowsFor`.
 * - "Others" is a fourth chip, shown only when it holds anything
 *   (`others.value > 0`), with no chart and no strategy comparison —
 *   deliberate on web ("cash, gold, debt and un-looked-through ETFs have no
 *   cap-band strategy to be measured against, and drawing one would be
 *   inventing a benchmark").
 *
 * `prevCap`/the `if (cap !== prevCap)` block is the same render-time
 * "adjusting state when a prop changes" pattern used elsewhere in this app
 * (see the 16 Sep changelog entry) — required because expo-router keeps tab
 * screens mounted across navigations, so a plain `useState(initial)` seeded
 * from `cap` only ever reads it on this screen's true first mount.
 */
export default function SegmentsScreen() {
  const { state, refreshing, refresh } = useRemoteData(getCapAnalysis);
  const tabBarHeight = useTabBarHeight();
  const { cap } = useLocalSearchParams<{ cap?: string }>();
  const [active, setActive] = useState<Tab | null>(
    cap === 'others' || KNOWN_SECTION_IDS.includes(cap as BucketId) ? (cap as Tab) : null,
  );
  const [prevCap, setPrevCap] = useState(cap);
  if (cap !== prevCap) {
    setPrevCap(cap);
    if (cap === 'others' || KNOWN_SECTION_IDS.includes(cap as BucketId)) {
      setActive(cap as Tab);
    }
  }
  // The one metric whose ⓘ definition is open, as `${band}:${metric}` —
  // opening another closes it, and switching tabs leaves none open.
  const [openDefinition, setOpenDefinition] = useState<string | null>(null);
  // Width of the SEBI band bar, so a segment's % label is only drawn where
  // it fits — a fixed share cut-off was too loose on a small phone.
  const [bandBarWidth, setBandBarWidth] = useState(0);
  if (state.status === 'loading') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (state.status === 'error') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ErrorView message={state.message} onRetry={refresh} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const { analysis } = state.data;

  // The first analysis isn't done — same gate as Performance and the
  // top-level tab gate (see `performance.tsx`'s own comment on this):
  // this screen's own `useRemoteData(getCapAnalysis)` fetch can land a
  // beat apart from the tab gate's, and must never show its own
  // half-built cap mix in that gap. Was a plain `calculating` boolean that
  // went false the moment ANY stored analysis row existed, partial or not
  // — its inline "Building your cap comparison" notice below then
  // disagreed with a donut and bands already drawn from that same partial
  // data (reported 17 Sep, alongside the identical bug on Performance).
  if (analysis?.building) {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView
            contentContainerStyle={styles.buildingScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
            <AnalysisBuilding analysis={analysis} />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const data = state.data.data;
  const sections = data.capSections;
  const capMix: CapSlice[] = data.capMix ?? [];
  const capContents = data.capContents ?? {};

  const shareOf = (bucket: BucketId): { value: number; percent: number } => {
    const bands: CapBand[] = bucket === 'small' ? ['small', 'micro'] : [bucket];
    return bands.reduce(
      (acc, b) => {
        const slice = capMix.find((s) => s.band === b);
        return { value: acc.value + (slice?.value ?? 0), percent: acc.percent + (slice?.percent ?? 0) };
      },
      { value: 0, percent: 0 },
    );
  };

  const rowsFor = (bucket: BucketId): CapContentRow[] => {
    const bands: CapBand[] = bucket === 'small' ? ['small', 'micro'] : [bucket];
    return bands.flatMap((b) => capContents[b] ?? []).sort((a, b) => b.value - a.value);
  };

  const isOthers = active === 'others';
  const sectionId: BucketId = !isOthers ? (active ?? sections[0]?.id ?? 'large') : (sections[0]?.id ?? 'large');
  const section = !isOthers ? (sections.find((s) => s.id === sectionId) ?? sections[0]) : undefined;

  const others = capMix.find((s) => s.band === 'unclassified') ?? null;
  const otherRows = (capContents.unclassified ?? []).filter((r) => r.via !== 'funds');
  const othersBreakdown = data.othersBreakdown ?? [];

  const equityTotal = sections.reduce((a, s) => a + shareOf(s.id).value, 0);

  const bandRows = section ? rowsFor(section.id) : [];
  const bandDirect = bandRows
    .filter((r) => r.via !== 'funds')
    .reduce((acc, r) => ({ value: acc.value + r.value, count: acc.count + 1 }), { value: 0, count: 0 });
  // Read once, into a plain local — same reason as `shareValue` above:
  // `bandDirect.value` used directly inside a `style={...}` prop gets
  // flagged by the worklets babel plugin's inline-styles-warning check.
  const bandDirectValue = bandDirect.value;
  const bandViaFunds = bandRows.filter((r) => r.via === 'funds').reduce((a, r) => a + r.value, 0);

  const navPoints = section?.series[0]?.points ?? [];
  const navWindow =
    navPoints.length >= 2
      ? `${monthYearLabel(navPoints[0]!.date)} – ${monthYearLabel(navPoints[navPoints.length - 1]!.date)}`
      : null;

  const held = section ? shareOf(section.id).value > 0 : false;
  const hasChart = !!section && section.series.length >= 2;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          key={isOthers ? 'others' : sectionId}
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
          {/* Header and band chips scroll with the page rather than
              sitting fixed above it, where on a small phone they took
              over a third of the screen. */}
          <PageHeader
            title="Segment Analysis"
            subtitle="How much of you sits in large, mid and small caps, directly and through funds."
            navAsOf={data.client.navAsOf}
          />

          <View style={styles.chipsRow}>
            {sections.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setActive(s.id)}
                style={[styles.chip, !isOthers && sectionId === s.id && styles.chipActive]}>
                <Text style={[styles.chipLabel, !isOthers && sectionId === s.id && styles.chipLabelActive]}>
                  {s.label} · {shareOf(s.id).percent.toFixed(2)}%
                </Text>
              </Pressable>
            ))}
            {/* Others earns a chip of its own, same as web — a tab row that
                omitted it would imply the three bands were the whole story. */}
            {others && others.value > 0 ? (
              <Pressable onPress={() => setActive('others')} style={[styles.chip, isOthers && styles.chipActive]}>
                <Text style={[styles.chipLabel, isOthers && styles.chipLabelActive]}>
                  Others · {others.percent.toFixed(2)}%
                </Text>
              </Pressable>
            ) : null}
          </View>

          {section && hasChart ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {section.label}
                {navWindow ? <Text style={styles.cardSub}> · {navWindow}</Text> : null}
              </Text>
              <NavChart series={section.series} height={220} />
              <Text style={styles.coverage}>
                Each line starts at 100 on the same day. The tiles below compare the first day with the last, so two
                lines can finish level having been far apart in between — that distance is the ride, not the result.
              </Text>
              {section.blendNote ? <Text style={styles.coverage}>{section.blendNote}</Text> : null}
            </View>
          ) : null}

          {section && section.metrics.length ? (
            <View style={styles.metrics}>
              {section.metrics
                .filter((m) => (m.value !== null && m.value !== 0) || m.strategyValue !== null || m.benchmarkValue !== null)
                .map((m) => {
                  const id = `${section.id}:${m.key}`;
                  return (
                    <MetricTile
                      key={m.key}
                      metric={m}
                      strategyLabel={section.strategy?.name ?? 'Qode'}
                      benchmarkLabel={section.benchmark ?? 'Index'}
                      held={held}
                      showDefinition={openDefinition === id}
                      onToggleDefinition={() => setOpenDefinition((cur) => (cur === id ? null : id))}
                    />
                  );
                })}
            </View>
          ) : null}

          {section && equityTotal > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How your equity splits across the SEBI bands</Text>
              <View style={styles.bandBar} onLayout={(e) => setBandBarWidth(e.nativeEvent.layout.width)}>
                {sections
                  .filter((s) => shareOf(s.id).value > 0)
                  .map((s) => {
                    // Hoisted to a plain local, not read as `shareOf(s.id)
                    // .value` directly inside the `style` prop below — the
                    // react-native-worklets babel plugin statically flags
                    // ANY `x.value` member expression it finds inside a
                    // `style={...}` object as a possible Reanimated shared-
                    // value misuse and wraps it in a runtime console.warn,
                    // with no type information to tell a real shared value
                    // apart from an ordinary `{value, percent}` object like
                    // this one — confirmed directly in its installed
                    // source (`react-native-worklets/plugin/index.js`,
                    // `processPropertyValueForInlineStylesWarning`). That
                    // syntactic false positive, not any actual Reanimated
                    // usage, was the real source of the "shared value's
                    // .value inside inline style" warning reported firing
                    // on this screen (16 Sep) — app-tabs.tsx's own,
                    // genuine `useSharedValue` usage was investigated
                    // twice already and is unrelated.
                    const shareValue = shareOf(s.id).value;
                    const segPct = (shareValue / equityTotal) * 100;
                    return (
                      <View
                        key={s.id}
                        style={[
                          styles.bandBarSeg,
                          { flex: shareValue, backgroundColor: CapBandColor[s.id], opacity: s.id === sectionId ? 1 : 0.42 },
                        ]}>
                        {(segPct / 100) * bandBarWidth >= BAND_LABEL_MIN_WIDTH ? (
                          <Text style={styles.bandBarLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                            {segPct.toFixed(2)}%
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
              {/* Text matches web's own legend exactly — just the label
                  and the rupee figure, no percentage (asked to keep this
                  one matching web, 16 Sep). The color dot is the one
                  addition beyond web: web's legend never had one either,
                  getting away with it because a mouse can still hover the
                  bar itself to match a segment to its color — there's no
                  touch equivalent, and once a segment is too thin to carry
                  its own inline label (Small & Micro, on a real account,
                  is often too thin for its label above), color was the only
                  thing left identifying it. The dot fixes that without
                  changing the text web already has right. */}
              <View style={styles.bandSplitRow}>
                {sections.map((s) => (
                  <View key={s.id} style={styles.bandSplitItem}>
                    <View style={[styles.bandSplitDot, { backgroundColor: CapBandColor[s.id] }]} />
                    <Text style={styles.bandSplitText}>
                      {s.label} <Text style={styles.bandSplitValue}>{money(shareOf(s.id).value)}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {isOthers && others && others.value > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Others<Text style={styles.cardSub}> · {money(others.value)} · {others.percent.toFixed(2)}% of everything you own</Text>
              </Text>
              <Text style={styles.coverage}>
                The part of your portfolio no cap band describes: cash, debt, gold, REITs, InvITs and ETFs we do not
                look through. It is not compared against a Qode strategy because there is no strategy that replaces
                it.
              </Text>

              {othersBreakdown.length ? (
                <View style={styles.othersList}>
                  {othersBreakdown.map((r) => (
                    <View key={r.label} style={styles.othersRow}>
                      <Text style={[styles.othersName, styles.othersNameCol]}>
                        {r.label}
                        {r.count != null ? (
                          <Text style={styles.othersVia}> · {r.count} {r.count === 1 ? 'holding' : 'holdings'}</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.othersAmt}>{money(r.value)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {otherRows.length ? (
                <>
                  <Text style={styles.subhead}>ETFs, InvITs & stocks</Text>
                  <View style={[styles.othersList, styles.othersPanel]}>
                    {otherRows.slice(0, 20).map((r) => (
                      <View key={`${r.via}-${r.name}`} style={styles.othersRow}>
                        <View style={styles.othersNameCol}>
                          {/* No `numberOfLines` — a truncated ellipsis on a
                              long name ("Ola Electric Mobility Limited
                              #Formerly Ola Electric Mobility Private
                              Limited") sat right up against the amount
                              beside it, reading as the two intersecting
                              (reported 16 Sep). Wrapping instead, same as
                              web's own table cell, never truncates. */}
                          <Text style={styles.othersName}>{r.name}</Text>
                          <Text style={styles.othersVia}>
                            {r.via === 'both' ? 'Stock & mutual fund' : r.kind === 'etf' ? 'ETF' : r.kind === 'invitReit' ? 'InvIT' : 'Stock'}
                          </Text>
                        </View>
                        <Text style={styles.othersAmt}>{money(r.value)}</Text>
                      </View>
                    ))}
                    {otherRows.length > 20 ? (
                      <Text style={styles.othersVia}>and {otherRows.length - 20} more</Text>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {section ? (
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{section.label}, what gets you there</Text>
                {bandRows.length ? (
                  <View style={styles.topList}>
                    {bandRows.slice(0, 10).map((t) => (
                      <View key={`${t.via}-${t.name}`} style={styles.topRow}>
                        <View style={styles.topNameCol}>
                          {/* No `numberOfLines` — see the matching comment
                              on `othersName` above; wraps instead of
                              truncating into the amount beside it. */}
                          <Text style={styles.topName}>{t.name}</Text>
                          <Text style={styles.topVia}>
                            {t.via === 'direct'
                              ? t.kind === 'etf'
                                ? 'ETF'
                                : t.kind === 'invitReit'
                                  ? 'InvIT'
                                  : 'Stock'
                              : t.via === 'both'
                                ? 'Stock & mutual fund'
                                : 'Mutual fund'}
                          </Text>
                        </View>
                        <Text style={styles.topValue}>{money(t.value)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyNote}>You hold nothing in this band, directly or through mutual funds.</Text>
                )}
                {bandRows.length > 10 ? (
                  <Text style={styles.coverage}>Showing the 10 largest of {bandRows.length} holdings in this band.</Text>
                ) : null}
              </View>

              {/* One card, not three stacked boxes — a split bar shows Direct
                  against Mutual funds at a glance, with the exact figures in
                  the legend rows beneath it (matches web's own redesign,
                  replacing this screen's previous plain "Direct · Through
                  funds" caption, reported 16 Sep as not matching web at
                  all). */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total in {section.label.toLowerCase()}</Text>
                <Text style={styles.summaryValue}>{money(shareOf(section.id).value)}</Text>
                <Text style={styles.summaryPct}>{shareOf(section.id).percent.toFixed(2)}% of everything you own</Text>

                {bandDirectValue + bandViaFunds > 0 ? (
                  <>
                    <View style={styles.splitBar}>
                      <View
                        style={[
                          styles.splitBarFill,
                          { flex: bandDirectValue, backgroundColor: QodeColor.accent },
                        ]}
                      />
                      <View style={[styles.splitBarFill, { flex: bandViaFunds, backgroundColor: QodeColor.capLarge }]} />
                    </View>
                    <View style={styles.splitLegend}>
                      <View style={styles.splitLegendRow}>
                        <View style={styles.splitLegendLeft}>
                          <View style={[styles.splitDot, { backgroundColor: QodeColor.accent }]} />
                          <Text style={styles.splitLegendText}>
                            Stocks · {bandDirect.count} {bandDirect.count === 1 ? 'holding' : 'holdings'}
                          </Text>
                        </View>
                        <Text style={styles.splitLegendValue}>{money(bandDirectValue)}</Text>
                      </View>
                      <View style={styles.splitLegendRow}>
                        <View style={styles.splitLegendLeft}>
                          <View style={[styles.splitDot, { backgroundColor: QodeColor.capLarge }]} />
                          <Text style={styles.splitLegendText}>Mutual funds</Text>
                        </View>
                        <Text style={styles.splitLegendValue}>{money(bandViaFunds)}</Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* A genuinely different case from the building gate above: the
              overall analysis is done (or we'd never have reached this
              render), but this one band still has no comparison curve —
              e.g. nothing held in it. */}
          {section && !hasChart ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Your comparison hasn&apos;t been calculated yet</Text>
              <Text style={styles.noticeBody}>
                Comparing your holdings against a Qode strategy runs off your linked accounts, and that calculation
                hasn&apos;t been done for you yet. It takes a couple of minutes and runs on its own once your
                accounts refresh — you don&apos;t need to do anything.
              </Text>
            </View>
          ) : null}

          {data.capCoverage.total > 0 && data.capCoverage.valuePercent < 100 ? (
            <Text style={styles.coverage}>
              Based on {data.capCoverage.valued} of {data.capCoverage.total} direct positions carrying a SEBI cap
              label ({data.capCoverage.valuePercent}% of stock value). Holdings in Others, and ETFs, are excluded
              from the three bands rather than assigned to one.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * One metric, three bars — ported from `CapAnalysis.tsx`'s `MetricTile`.
 * Replaces this screen's old plain "You / Qode / Index" three-column text
 * (still fine for MF X-Ray, which never had a web equivalent to match) —
 * here, web actually has one, and it's bars, not columns (reported 16 Sep,
 * "graphs are missing").
 */
function MetricTile({
  metric,
  strategyLabel,
  benchmarkLabel,
  held,
  showDefinition,
  onToggleDefinition,
}: {
  metric: MetricCard;
  strategyLabel: string;
  benchmarkLabel: string;
  held: boolean;
  /** Controlled by the screen, so only one definition is open at a time. */
  showDefinition: boolean;
  onToggleDefinition: () => void;
}) {
  const wins = (a: number, b: number) => (metric.better === 'higher' ? a >= b : Math.abs(a) <= Math.abs(b));
  const good = metric.value != null && metric.strategyValue != null && wins(metric.value, metric.strategyValue);

  const contenders: [string, number][] = [
    ...(held && metric.value != null ? ([['you', metric.value]] as [string, number][]) : []),
    ...(metric.strategyValue != null ? ([['strategy', metric.strategyValue]] as [string, number][]) : []),
    ...(metric.benchmarkValue != null ? ([['benchmark', metric.benchmarkValue]] as [string, number][]) : []),
  ];
  const max = Math.max(...contenders.map((c) => Math.abs(c[1])), Number.EPSILON);
  const leader =
    contenders.length < 2
      ? null
      : contenders.reduce((best, c) =>
          metric.better === 'higher' ? (c[1] > best[1] ? c : best) : Math.abs(c[1]) < Math.abs(best[1]) ? c : best,
        )[0];

  const rows: { who: string; name: string; value: number; color: string }[] = [
    ...(held && metric.value != null ? [{ who: 'you', name: 'You', value: metric.value, color: QodeColor.accent }] : []),
    ...(metric.strategyValue != null
      ? [{ who: 'strategy', name: strategyLabel, value: metric.strategyValue, color: QodeColor.success }]
      : []),
    ...(metric.benchmarkValue != null
      ? [{ who: 'benchmark', name: benchmarkLabel, value: metric.benchmarkValue, color: QodeColor.metricBarBenchmark }]
      : []),
  ];

  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileHead}>
        <Text style={styles.metricTileLabel}>
          {held ? metric.label : `${metric.label.replace(/^Your /, '')} — ${strategyLabel}`}
        </Text>
        {/* web's ⓘ (`.rv-metric__info`) opens a floating popover positioned
            beside the cursor — no such anchor exists on touch, so this
            reveals the same sentence inline, below the head row, instead of
            attempting a floating bubble that would need the same overflow-
            clamping NavChart's tooltip already needed (see its own fix
            earlier this file's changelog) for a one-line caption that
            doesn't warrant it. */}
        <Pressable
          onPress={onToggleDefinition}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showDefinition ? `Hide what ${metric.label} means` : `What ${metric.label} means`}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </Pressable>
      </View>
      {showDefinition ? (
        <View style={styles.definitionBubble}>
          <Text style={styles.definitionText}>{metric.definition}</Text>
        </View>
      ) : null}
      <Text style={[styles.metricTileValue, good && styles.metricTileValueGood]}>
        {pct(held ? metric.value : metric.strategyValue)}
      </Text>
      <View style={styles.metricBars}>
        {rows.map((r) => (
          <View key={r.who} style={styles.metricBarRow}>
            <View style={styles.metricBarNameRow}>
              <Text style={styles.metricBarName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[styles.metricBarValue, leader === r.who && styles.metricBarValueLead]}>{pct(r.value)}</Text>
            </View>
            <View style={styles.metricBarTrack}>
              <View
                style={[
                  styles.metricBarFill,
                  { width: `${Math.max((Math.abs(r.value) / max) * 100, 2)}%`, backgroundColor: r.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Same as `app-tabs.tsx`'s own `gateScroll` / `performance.tsx`'s
  // `buildingScroll`: centers the loader on a tall screen, scrolls on a
  // short one, and always leaves a pull-to-refresh gesture somewhere to
  // register.
  buildingScroll: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[2],
  },
  chip: {
    alignItems: 'center',
    paddingVertical: QodeSpace[2],
    paddingHorizontal: QodeSpace[3],
    borderRadius: QodeRadius.pill,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
  },
  chipActive: {
    backgroundColor: QodeColor.surfaceRaised,
    borderColor: QodeColor.controlBorder,
  },
  chipLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textSecondary,
  },
  chipLabelActive: {
    fontFamily: QodeFont.ui,
    color: QodeColor.textPrimary,
  },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    gap: QodeSpace[4],
  },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  // Playfair, 17px, cream — matches web's `.rv-card__title` exactly (and
  // Performance.tsx's own `cardTitle`, which already had this right). This
  // screen's version had drifted to Lato Bold at 14px, reported 16 Sep as
  // "the title's font is different on web". `marginBottom` matches web's
  // own 14px there too — without it, a title sat flush against whatever
  // came right after it (e.g. "Large Cap, what gets you there" touching
  // its own first holding row).
  cardTitle: {
    fontFamily: QodeFont.display,
    fontSize: 17,
    color: QodeColor.cream,
    marginBottom: QodeSpace[3],
  },
  cardSub: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
  },
  noticeCard: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
    gap: QodeSpace[1],
  },
  noticeTitle: {
    fontFamily: QodeFont.ui,
    fontSize: 13.5,
    color: QodeColor.textPrimary,
  },
  noticeBody: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: QodeColor.textMuted,
  },
  coverage: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    lineHeight: 17,
    color: QodeColor.faint,
    marginTop: QodeSpace[3],
  },
  metrics: {
    gap: QodeSpace[2],
  },
  metricTile: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  metricTileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: QodeSpace[2],
  },
  metricTileLabel: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    color: QodeColor.textMuted,
  },
  infoIcon: {
    fontSize: 13,
    color: QodeColor.accent,
  },
  definitionBubble: {
    backgroundColor: QodeColor.surfaceRaised,
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.sm,
    paddingVertical: QodeSpace[2],
    paddingHorizontal: QodeSpace[3],
    marginTop: QodeSpace[2],
  },
  definitionText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    lineHeight: 17,
    color: QodeColor.textSecondary,
  },
  metricTileValue: {
    fontFamily: QodeFont.ui,
    fontSize: 22,
    color: QodeColor.textPrimary,
    marginTop: 2,
    marginBottom: QodeSpace[2],
  },
  metricTileValueGood: {
    color: QodeColor.success,
  },
  metricBars: {
    gap: 6,
  },
  metricBarRow: {
    gap: 3,
  },
  // The name and its bar used to share one row, name squeezed into a fixed
  // 64dp column — long strategy/index names ("Qode Tactical Fund", "NIFTY
  // Midcap 150") got clipped there (reported 16 Sep). Name and value now
  // sit on their own row, full tile width, with the bar on its own row
  // below — nothing is forced into a column too narrow for it.
  metricBarNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: QodeSpace[2],
  },
  metricBarName: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textMuted,
  },
  metricBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: QodeColor.surfaceBorder,
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricBarValue: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  metricBarValueLead: {
    fontFamily: QodeFont.ui,
    color: QodeColor.textPrimary,
  },
  // Thicker (32, matching MF X-Ray's exposure bar — the same "too thin"
  // report, same fix). No `marginTop` of its own any more — `cardTitle`
  // already carries a 12dp `marginBottom`, and stacking this bar's own gap
  // on top of that (reported 16 Sep as "more upper padding above the bar")
  // was double-counting the same space every other card on this screen
  // only pays once.
  bandBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: QodeRadius.sm,
    overflow: 'hidden',
  },
  bandBarSeg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandBarLabel: {
    fontFamily: QodeFont.ui,
    fontSize: 10,
    color: QodeColor.textOnAccent,
  },
  bandSplitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[3],
    marginTop: QodeSpace[3],
  },
  bandSplitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bandSplitDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  bandSplitText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    color: QodeColor.textMuted,
  },
  bandSplitValue: {
    fontFamily: QodeFont.ui,
    color: QodeColor.textPrimary,
  },
  othersList: {
    gap: QodeSpace[2],
  },
  othersPanel: {
    marginTop: QodeSpace[2],
  },
  othersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // 'flex-start', not 'center' — a long holding name ("Ola Electric
    // Mobility Limited #Formerly...") wraps to two lines now (see
    // `othersName` below), and centering the row vertically against that
    // pushed the amount down into the middle of the wrapped name instead
    // of sitting level with its first line.
    alignItems: 'flex-start',
    gap: QodeSpace[2],
  },
  othersNameCol: {
    flex: 1,
    // Explicit, not just the row's own `gap` — a name whose wrapped width
    // fills the entire column right up to its edge left no visible space
    // before the amount for exactly the long names this screen exists to
    // show ("Ola Electric Mobility..."), reported 16 Sep as touching even
    // after the ellipsis-truncation fix. `marginRight` guarantees real
    // physical space between the two boxes regardless of how wide the
    // text inside renders.
    marginRight: QodeSpace[2],
  },
  othersName: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  othersVia: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
  },
  othersAmt: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  subhead: {
    fontFamily: QodeFont.ui,
    fontSize: 12,
    color: QodeColor.textPrimary,
    marginTop: QodeSpace[4],
    marginBottom: QodeSpace[2],
  },
  grid: {
    gap: QodeSpace[4],
  },
  topList: {
    gap: QodeSpace[2],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Same reasoning as `othersRow` — a wrapped two-line name needs the
    // amount level with its first line, not centered against both.
    alignItems: 'flex-start',
    backgroundColor: QodeColor.surfaceRaised,
    borderRadius: QodeRadius.md,
    paddingVertical: QodeSpace[3],
    paddingHorizontal: QodeSpace[4],
  },
  topNameCol: {
    flex: 1,
    // Same fix as `othersNameCol`, same reason — see its comment.
    marginRight: QodeSpace[2],
  },
  topName: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  topVia: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    marginTop: 1,
  },
  topValue: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  emptyNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
  },
  metricCard: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
    gap: QodeSpace[3],
  },
  metricLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
  },
  summaryValue: {
    // Lato, not Playfair — confirmed against web's own CapAnalysis.tsx,
    // which renders this exact figure with className="rv-metric__value"
    // alone (no "--lead"/"--good" modifier, so no bold, no gold).
    fontFamily: QodeFont.uiRegular,
    fontSize: 28,
    color: QodeColor.cream,
    fontVariant: ['tabular-nums'],
    marginTop: -4,
  },
  summaryPct: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
    marginTop: -6,
  },
  splitBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%',
  },
  splitLegend: {
    gap: QodeSpace[2],
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitLegendLeft: {
    flexShrink: 1,
    marginRight: QodeSpace[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  splitDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  splitLegendText: {
    flexShrink: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  splitLegendValue: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
});
