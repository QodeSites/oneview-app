import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Donut } from '@/components/charts/Donut';
import { NavChart } from '@/components/charts/NavChart';
import { RaceBars } from '@/components/charts/RaceBars';
import { PageHeader } from '@/components/PageHeader';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, signedPct } from '@/lib/format';
import { mockReviewData, type CapBand } from '@/lib/mock-data';

/**
 * Performance & Overview, merged into one screen exactly like
 * qode-oneview's own /review page (PortfolioHero + Performance + Overview
 * stacked) — MVP preview with dummy data shaped like the real contracts.
 * Every card here corresponds to one on the real screen: the journey
 * chart, three roads, the gap readout, your mix, the allocation donut
 * with its accordion, and alerts. See qode-oneview's Performance.tsx and
 * Overview.tsx for the originals.
 *
 * `performance.takeaways` (a real field on the mock `Performance` type)
 * is deliberately NOT rendered here. It restated figures already shown
 * twice over — "Beat the benchmark" duplicated the gap readout's "Return
 * above {benchmark}" row, "Behind the Qode mix" duplicated its "Your Qode
 * Mix, against this portfolio" row, and "Concentration" duplicated the
 * Alerts card below. The real Performance.tsx's own code comments are
 * explicit about cutting exactly this kind of restatement ("every fact
 * appeared at least twice... this screen has been cut back twice to
 * remove duplication") — rendering takeaways here would have reintroduced
 * the thing the original design deliberately removed.
 */
export default function PerformanceScreen() {
  const data = mockReviewData;
  const perf = data.performance;
  const gap = data.gap;
  const classes = data.assetCards.filter((c) => c.value > 0);
  const [openBand, setOpenBand] = useState<CapBand | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = useTabBarHeight();

  // Mock delay only; there's no real POST /api/refresh to call yet
  // (SPEC-mobile-dashboard.md).
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={QodeColor.accent} />
          }>
          <Text style={styles.dummyBadge}>Preview data — not your real portfolio</Text>

          <PageHeader
            title="Performance"
            subtitle="What a year did to your portfolio, and what it is made of."
            navAsOf={data.client.navAsOf}
          />

          {/* ── Hero: total portfolio (PortfolioHero.tsx) ── */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total portfolio</Text>
            <Text style={styles.heroValue}>{money(data.totals.portfolio)}</Text>
            <Text style={styles.heroSplit}>
              Securities {money(data.totals.securities)} · Bank &amp; deposits {money(data.totals.cash)}
            </Text>
            <Text style={styles.heroMeta}>
              {data.client.holdingsCount} holdings across {data.client.assetTypeCount} asset types · as of{' '}
              {data.client.asOf}
            </Text>
            <View style={styles.classRow}>
              {classes.map((c) => (
                <View key={c.type} style={styles.classItem}>
                  <Text style={styles.classLabel}>{c.label}</Text>
                  <Text style={styles.classValue}>{money(c.value)}</Text>
                  <Text style={styles.classShare}>{c.sharePercent.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>

          {perf ? (
            <>
              {/* ── The Journey ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>The Journey</Text>
                <NavChart series={perf.journey} />
              </View>

              {/* ── Three roads ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Three roads from <Text style={styles.cardTitleFig}>{money(gap.amount)}</Text>
                </Text>
                <Text style={styles.cardCaption}>
                  The portfolio was valued at {money(gap.amount)} on {gap.from}, one year before the most recent
                  valuation. All three lines begin from that same value.
                </Text>
                <RaceBars bars={perf.bars} />
              </View>

              {/* ── Where the gap is: sentence + readout ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Where the gap is</Text>
                <Text style={styles.cardCaption}>
                  {money(gap.amount)} over this period: yours grew to {money(gap.you.value)}, the{' '}
                  {gap.benchmark.label} to {money(gap.benchmark.value)}, the Qode mix to {money(gap.qode.value)}.
                </Text>

                <View style={styles.gapStrip}>
                  <GapFigure label="Benchmark Gap" value={gap.benchmarkGap} note={`Your portfolio against ${gap.benchmark.label}.`} />
                  <Text style={styles.gapOp}>+</Text>
                  <GapFigure label="Alpha Potential" value={gap.alphaPotential} note="What Qode's strategies added over the index, historically." />
                  <Text style={styles.gapOp}>=</Text>
                  <GapFigure label="Total Wealth Gap" value={gap.totalWealthGap} note="Your portfolio against the Qode mix." total />
                </View>

                <View style={styles.readout}>
                  <Text style={styles.readoutHead}>In summary</Text>
                  <View style={styles.readoutRow}>
                    <Text style={styles.readoutKey}>Return above {gap.benchmark.label}</Text>
                    <Text style={[styles.readoutVal, gap.you.percent >= gap.benchmark.percent ? styles.pos : styles.neg]}>
                      {signedPct(gap.you.percent - gap.benchmark.percent)}
                    </Text>
                  </View>
                  <View style={styles.readoutRow}>
                    <Text style={styles.readoutKey}>Your Qode Mix, against this portfolio</Text>
                    <Text style={[styles.readoutVal, styles.readoutValGold]}>
                      {signedPct(gap.qode.percent - gap.you.percent)}
                    </Text>
                  </View>
                  <Text style={styles.readoutFoot}>
                    All figures are calculated from the three return series shown in the chart. Past performance,
                    not a forecast.
                  </Text>
                </View>
              </View>

              {/* ── Your mix ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your mix, on the same three strategies</Text>
                <Text style={styles.cardCaption}>
                  Your money, split the way it sits today —{' '}
                  {data.mixBlend.map((s) => `${s.name} ${s.percent}%`).join(', ')} — large cap mapped to Qode All
                  Weather, mid to Qode Tactical Fund, small to Qode Growth Fund.
                </Text>

                <View style={styles.mixBar}>
                  {data.mixBlend.map((s) => (
                    <View key={s.code} style={{ flexGrow: s.percent, backgroundColor: s.color }} />
                  ))}
                </View>

                <View style={styles.sleeves}>
                  {data.mixBlend.map((s) => (
                    <View key={s.code} style={styles.sleeve}>
                      <View style={styles.sleeveHead}>
                        <View style={[styles.sleeveDot, { backgroundColor: s.color }]} />
                        <Text style={styles.sleevePct}>{s.percent}%</Text>
                      </View>
                      <Text style={styles.sleeveName}>{s.name}</Text>
                      <Text style={styles.sleeveRole}>{s.role}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.disclaimer}>
                  Not advice or a portfolio built for you, and one past year is not a forecast — the same mix over a
                  different window gives a different number.
                </Text>
              </View>
            </>
          ) : null}

          {/* ── Allocation by market cap (Overview.tsx) ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allocation by market cap</Text>
            <View style={styles.donutRow}>
              <Donut
                size={150}
                slices={data.capMix.map((s) => ({ label: s.label, percent: s.percent, color: CapBandColor[s.band] }))}
                centerLabel="Portfolio"
                centerValue={money(data.totals.portfolio)}
              />
              <View style={styles.legend}>
                {data.capMix.map((s) => {
                  const rows = data.capContents[s.band];
                  const open = openBand === s.band;
                  return (
                    <View key={s.band}>
                      <Pressable
                        style={styles.legendRow}
                        onPress={() => rows?.length && setOpenBand(open ? null : s.band)}>
                        <View style={[styles.legendSwatch, { backgroundColor: CapBandColor[s.band] }]} />
                        <Text style={styles.legendLabel}>
                          {s.label} {s.percent.toFixed(1)}%
                        </Text>
                        {rows?.length ? (
                          <Text style={styles.legendCaret}>{open ? '▾' : '▸'}</Text>
                        ) : null}
                      </Pressable>
                      {open && rows?.length ? (
                        <View style={[styles.legendPanel, { borderLeftColor: CapBandColor[s.band] }]}>
                          {rows.slice(0, 8).map((r) => (
                            <View key={r.name} style={styles.legendPanelRow}>
                              <Text style={styles.legendPanelName} numberOfLines={1}>
                                {r.name}
                              </Text>
                              <Text style={styles.legendPanelValue}>{money(r.value)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={styles.coverageNote}>
              Cap labels come from SEBI&apos;s own classification, matched by ISIN. {data.capCoverage.valued} of{' '}
              {data.capCoverage.total} direct positions matched, covering {data.capCoverage.valuePercent}% of your
              stock value. ETFs are not looked through.
            </Text>
          </View>

          {/* ── Alerts ── */}
          {data.alerts.length ? (
            <View style={styles.alerts}>
              {data.alerts.map((a) => (
                <View key={a.title} style={styles.alert}>
                  <Text style={styles.alertTitle}>⚠ {a.title}</Text>
                  <Text style={styles.alertBody}>{a.body}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GapFigure({ label, value, note, total }: { label: string; value: number; note: string; total?: boolean }) {
  return (
    <View style={styles.gapFigure}>
      <Text style={styles.gapFigureLabel}>{label}</Text>
      <Text style={[styles.gapFigureValue, total && styles.gapFigureValueTotal]}>{money(value)}</Text>
      <Text style={styles.gapFigureNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    gap: QodeSpace[4],
  },
  dummyBadge: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.warning,
    textAlign: 'center',
  },
  hero: { paddingVertical: QodeSpace[4] },
  heroLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: QodeColor.textMuted,
  },
  heroValue: {
    fontFamily: QodeFont.display,
    fontSize: 40,
    color: QodeColor.cream,
    marginTop: QodeSpace[1],
  },
  heroSplit: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[2],
  },
  heroMeta: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[1],
  },
  classRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[4],
    marginTop: QodeSpace[4],
  },
  classItem: { minWidth: '42%' },
  classLabel: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  classValue: { fontFamily: QodeFont.ui, fontSize: 16, color: QodeColor.textPrimary, marginTop: 2 },
  classShare: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
  cardTitleFig: { color: QodeColor.cream },
  cardCaption: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    lineHeight: 17,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[1],
  },
  gapStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: QodeSpace[4],
    gap: QodeSpace[1],
  },
  gapFigure: { flex: 1 },
  gapFigureLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 9.5,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
  },
  gapFigureValue: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary, marginTop: 2 },
  gapFigureValueTotal: { color: QodeColor.accent },
  gapFigureNote: { fontFamily: QodeFont.uiRegular, fontSize: 10, color: QodeColor.textMuted, marginTop: 2 },
  gapOp: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textMuted },
  readout: {
    marginTop: QodeSpace[4],
    paddingTop: QodeSpace[3],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
    gap: QodeSpace[2],
  },
  readoutHead: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-between' },
  readoutKey: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, color: QodeColor.textSecondary, flex: 1 },
  readoutVal: { fontFamily: QodeFont.ui, fontSize: 13 },
  readoutValGold: { color: QodeColor.accent },
  pos: { color: QodeColor.success },
  neg: { color: QodeColor.error },
  readoutFoot: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textMuted, marginTop: QodeSpace[1] },
  mixBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: QodeSpace[4],
  },
  sleeves: { flexDirection: 'row', gap: QodeSpace[2], marginTop: QodeSpace[3] },
  sleeve: { flex: 1 },
  sleeveHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sleeveDot: { width: 7, height: 7, borderRadius: 3.5 },
  sleevePct: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary },
  sleeveName: { fontFamily: QodeFont.ui, fontSize: 11, color: QodeColor.textPrimary, marginTop: 3 },
  sleeveRole: { fontFamily: QodeFont.uiRegular, fontSize: 10, color: QodeColor.textMuted, marginTop: 2, lineHeight: 13 },
  disclaimer: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    lineHeight: 15,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[3],
  },
  donutRow: { flexDirection: 'row', gap: QodeSpace[4], marginTop: QodeSpace[3], alignItems: 'flex-start' },
  legend: { flex: 1, gap: QodeSpace[1] },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[2], paddingVertical: QodeSpace[1] },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: QodeFont.uiRegular, fontSize: 12, color: QodeColor.textPrimary, flex: 1 },
  legendCaret: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  legendPanel: {
    borderLeftWidth: 2,
    paddingLeft: QodeSpace[2],
    marginLeft: 4,
    marginBottom: QodeSpace[2],
    gap: 3,
  },
  legendPanelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: QodeSpace[2] },
  legendPanelName: { flex: 1, fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textSecondary },
  legendPanelValue: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  coverageNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    lineHeight: 16,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[4],
  },
  alerts: { gap: QodeSpace[2] },
  alert: {
    backgroundColor: 'rgba(247, 168, 96, 0.08)',
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  alertTitle: { fontFamily: QodeFont.ui, fontSize: 13, color: QodeColor.warning },
  alertBody: { fontFamily: QodeFont.uiRegular, fontSize: 12.5, lineHeight: 18, color: QodeColor.textSecondary, marginTop: 3 },
});
