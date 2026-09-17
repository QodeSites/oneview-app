import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron } from '@/components/Chevron';
import { Donut } from '@/components/charts/Donut';
import { NavChart } from '@/components/charts/NavChart';
import { ThreeRoads } from '@/components/charts/ThreeRoads';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace, StrategyColor } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, signedPct } from '@/lib/format';
import { type CapBand } from '@/lib/mock-data';
import { getPerformance, getRiskProfileData } from '@/lib/reviewApi';
import { calculateScores } from '@/lib/strategy-scoring';

/**
 * Performance & Overview, merged into one screen exactly like
 * qode-oneview's own /review page (PortfolioHero + Performance + Overview
 * stacked) — now real data, via `GET /api/mobile/performance`
 * (src/lib/reviewApi.ts; see MOBILE_BACKEND_CHANGES.md for what that route
 * wraps). Every card here corresponds to one on the real screen: the
 * journey chart, three roads, the gap readout, the allocation donut with
 * its accordion, and alerts.
 *
 * "Your mix, on the same three strategies" (added back 16 Sep, having been
 * wrongly dropped as unbuildable): it does NOT come from `mix` — that field
 * really is only the Journey chart's NAV series, as the note below explains.
 * But web's own version of this card (Performance.tsx's `yourBlend`) never
 * reads a percentage-blend field from the API either — it derives one
 * client-side from `data.capMix`, the exact same field this screen's
 * "Allocation by market cap" donut already reads. `bandPct`/`RECOMMENDED_
 * BLEND` below port that derivation verbatim (checked directly against
 * `Performance.tsx` and `features/review/config.ts`).
 *
 * The Journey chart, Three Roads and the Wealth Gap card gate on `mix`/
 * `gap` directly — NOT `data.performance`, which is permanently hardcoded
 * `null` everywhere in qode-oneview (real accounts and demo alike; dead
 * code from before the real web Performance screen was rewritten to read
 * `mix`/`gap` as page-level props instead). Gating on it here meant these
 * three sections never rendered for ANY account (reported 15 Sep — only
 * the allocation donut, which has its own independent `data.capMix` gate,
 * ever showed). Journey gates on `mix.length >= 2`, matching web's own
 * `hasChart` exactly; Three Roads and the Wealth Gap card gate on `gap`
 * alone, also matching web — the "roads" themselves are built from
 * `gap.benchmark`/`.you`/`.qode`, the same three legs the mock's old,
 * separately-fabricated `performance.bars` represented.
 */

/** Verbatim from qode-oneview's `features/review/config.ts` — the fixed-weight fallback for "Your mix" below. */
const RECOMMENDED_BLEND = [
  {
    code: 'QAW' as const,
    name: 'Qode All Weather',
    percent: 66.7,
    role: 'The core. Built to hold up across market conditions rather than to win any one of them.',
  },
  {
    code: 'QTF' as const,
    name: 'Qode Tactical Fund',
    percent: 11.1,
    role: "The tactical sleeve, moving with the market's own signal rather than sitting still.",
  },
  {
    code: 'QGF' as const,
    name: 'Qode Growth Fund',
    percent: 22.2,
    role: 'The growth sleeve, in smaller companies — more return on offer, and more of a ride.',
  },
];

export default function PerformanceScreen() {
  const { state, refreshing, refresh } = useRemoteData(getPerformance);
  // The saved Risk Profile answers, for the mix card's second view — web
  // gets them as a page prop (`savedAnswers`); `/api/mobile/performance`
  // doesn't carry them, so they come from the Risk Profile route instead.
  const riskProfile = useRemoteData(getRiskProfileData);
  const [mixView, setMixView] = useState<'yours' | 'risk'>('yours');
  const [openBand, setOpenBand] = useState<CapBand | null>(null);
  const tabBarHeight = useTabBarHeight();

  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ErrorView message={state.message} onRetry={refresh} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const { data, mix, gap, calculating } = state.data;
  const classes = data.assetCards.filter((c) => c.value > 0);

  // The date range the Journey chart covers — web's own `window` (checked
  // directly against Performance.tsx), missing here entirely until now
  // (reported 16 Sep). `gap.from`/`.to` when the wealth-gap comparison
  // exists; otherwise falls back to the drawn client series' own first and
  // last dates, so the chart still states its own range even on an account
  // without a benchmark comparison.
  const clientLine = mix?.find((s) => s.role === 'client') ?? null;
  const chartWindow = gap
    ? `${gap.from} to ${gap.to}`
    : clientLine
      ? `${clientLine.points[0]?.date} to ${clientLine.points[clientLine.points.length - 1]?.date}`
      : null;

  // "Your mix" — see the component doc comment. `bandPct`/`yoursTotal`/
  // `yourBlend` port Performance.tsx's own derivation verbatim: large/mid/
  // small cap mapped onto QAW/QTF/QGF respectively (micro and unclassified
  // have no equity strategy and are left out entirely, same as web), then
  // re-scaled to total 100 so the three shares are comparable to the fixed
  // blend they sit beside.
  const bandPct = (band: string) => data.capMix.find((s) => s.band === band)?.percent ?? 0;
  const yoursRaw = { QAW: bandPct('large'), QTF: bandPct('mid'), QGF: bandPct('small') };
  const yoursTotal = yoursRaw.QAW + yoursRaw.QTF + yoursRaw.QGF;
  const yourBlend =
    yoursTotal > 0
      ? RECOMMENDED_BLEND.map((b) => ({ ...b, percent: Number(((yoursRaw[b.code] / yoursTotal) * 100).toFixed(1)) }))
      : null;
  // Ported from Performance.tsx's `riskBlend`: the saved answers' allocation
  // on the same three sleeves. Null until all six are answered.
  const savedAnswers = riskProfile.state.status === 'ready' ? riskProfile.state.data : null;
  const riskBlend =
    savedAnswers && savedAnswers.length === 6
      ? (() => {
          const byCode = new Map(calculateScores(savedAnswers).map((r) => [r.code, r.allocation]));
          return RECOMMENDED_BLEND.map((b) => ({ ...b, percent: byCode.get(b.code) ?? 0 }));
        })()
      : null;
  // Falls back to "yours" if the answers disappear while the risk view is open.
  const showRisk = mixView === 'risk' && riskBlend !== null;
  const shownBlend = showRisk ? riskBlend : (yourBlend ?? RECOMMENDED_BLEND);

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                refresh();
                riskProfile.revalidate();
              }}
              tintColor={QodeColor.accent}
            />
          }>
          <PageHeader
            title="Performance"
            subtitle="What a year did to your portfolio, and what it is made of."
            navAsOf={data.client.navAsOf}
          />

          {calculating ? (
            <View style={styles.calculatingCard}>
              <Text style={styles.calculatingText}>
                Still building your review — this can take a few minutes the first time. Pull down to check again.
              </Text>
            </View>
          ) : null}

          {/* ── Hero: total portfolio ── */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total portfolio</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {money(data.totals.portfolio)}
            </Text>
            <Text style={styles.heroSplit}>
              Securities {money(data.totals.securities)} · Bank &amp; deposits {money(data.totals.cash)}
            </Text>
            <Text style={styles.heroMeta}>
              {data.client.holdingsCount} holdings across {data.client.assetTypeCount} asset{' '}
              {data.client.assetTypeCount === 1 ? 'type' : 'types'}
            </Text>
            {classes.length ? (
              <View style={styles.classRow}>
                {classes.map((c) => (
                  <View key={c.type} style={styles.classItem}>
                    <Text style={styles.classLabel}>{c.label}</Text>
                    <Text style={styles.classValue}>{money(c.value)}</Text>
                    {/* `c.countLabel` ("15 positions", "5 schemes", "1 account")
                        was already on this payload (mirrors web's own
                        `assetCards` exactly) — this card just wasn't
                        printing it. `toFixed(1)`, not `(2)`, to match web's
                        own PortfolioHero.tsx precision on this figure. */}
                    <Text style={styles.classShare}>
                      {c.sharePercent.toFixed(1)}% · {c.countLabel}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {mix && mix.length >= 2 ? (
            <>
              {chartWindow ? <Text style={styles.coverage}>{chartWindow}</Text> : null}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>The Journey</Text>
                <NavChart series={mix} />
              </View>
            </>
          ) : null}

          {gap ? (
            <>
              {/* ── Three roads ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Three roads from <Text style={styles.cardTitleFig}>{money(gap.amount)}</Text>
                </Text>
                {/* Matches web's own caption exactly (Performance.tsx) —
                    this was missing its closing clause entirely (reported
                    16 Sep: "this sentence is not complete"), stopping at
                    "same value." instead of stating what the three lines'
                    shared starting point actually demonstrates. Spacing
                    between this and the chart below doesn't depend on how
                    many lines this text wraps to either way — `ThreeRoads`
                    carries its own fixed `marginTop` (see that component),
                    not a value tuned to this specific caption's height. */}
                <Text style={styles.cardCaption}>
                  The portfolio was valued at {money(gap.amount)} on {gap.from}, one year before the most recent
                  valuation. All three lines begin from that same value, so the difference between them reflects
                  return alone.
                </Text>
                <ThreeRoads gap={gap} />
              </View>

              {/* ── Where the gap is: sentence + readout ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Where the gap is</Text>
                <Text style={styles.cardCaption}>
                  {money(gap.amount)} over this period: yours grew to {money(gap.you.value)}, the{' '}
                  {gap.benchmark.label} to {money(gap.benchmark.value)}, the Qode mix to {money(gap.qode.value)}.
                </Text>

                <View style={styles.gapStrip}>
                  <GapFigure
                    label="Benchmark Gap"
                    value={gap.benchmarkGap}
                    note={`Your portfolio against ${gap.benchmark.label}.`}
                  />
                  <Text style={styles.gapOp}>+</Text>
                  <GapFigure
                    label="Alpha Potential"
                    value={gap.alphaPotential}
                    note="What Qode's strategies added over the index, historically."
                  />
                  <Text style={styles.gapOp}>=</Text>
                  <GapFigure
                    label="Total Wealth Gap"
                    value={gap.totalWealthGap}
                    note="Your portfolio against the Qode mix."
                    total
                  />
                </View>

                <View style={styles.readout}>
                  <Text style={styles.readoutHead}>In summary</Text>
                  <View style={styles.readoutRow}>
                    <Text style={styles.readoutKey}>Return above {gap.benchmark.label}</Text>
                    {/* Cream, not red for a shortfall here — a deliberate
                        mobile-only choice at the reader's own request (16
                        Sep). Checked directly against review.css first:
                        web's own `.rv-readout__v` DOES use plain `rv-pos`/
                        `rv-neg` (green/red) for this exact figure, no
                        override found — so this is a real, disclosed
                        deviation from web, not a fix for a web-matching
                        bug. */}
                    <Text style={styles.readoutVal}>{signedPct(gap.you.percent - gap.benchmark.percent)}</Text>
                  </View>
                  <View style={styles.readoutRow}>
                    <Text style={styles.readoutKey}>Your Qode Mix, against this portfolio</Text>
                    <Text style={[styles.readoutVal, styles.readoutValGold]}>
                      {signedPct(gap.qode.percent - gap.you.percent)}
                    </Text>
                  </View>

                  {/* Web's own `rv-compare` table (Performance.tsx) — missing
                      here entirely until now (reported 16 Sep). No new
                      computation needed: every `Series` is rebased to 100 at
                      the window's start, so `s.end - 100` IS the window's
                      return — exactly what web's `seriesMetrics().cagr` also
                      computes from the same rebased series (confirmed by
                      reading both `wealthGap()`'s `leg()` helper and
                      `engineStyleMetrics` directly). `gap.you.percent`/
                      `gap.qode.percent` are already that number; recomputing
                      it from `mix` again would just be the same math twice. */}
                  <View style={styles.compare}>
                    <View style={styles.compareHead}>
                      <View style={styles.compareHeadSpacer} />
                      <Text style={styles.compareCol}>Portfolio</Text>
                      <Text style={styles.compareCol}>Your Qode Mix</Text>
                    </View>
                    <View style={styles.compareRow}>
                      <Text style={styles.compareKey}>Annualised return</Text>
                      {/* Same deliberate deviation as the readout row above
                          — cream, not red for a negative figure here, at
                          the reader's own request. Web's real
                          `.rv-compare__v` also uses plain rv-pos/rv-neg
                          for this exact "Portfolio" column, so this is a
                          disclosed mobile-only choice, not a web-matching
                          fix. */}
                      <Text style={styles.compareVal}>
                        {signedPct(gap.you.percent)}
                      </Text>
                      <Text style={[styles.compareVal, styles.compareValGold]}>{signedPct(gap.qode.percent)}</Text>
                    </View>
                  </View>

                  <Text style={styles.readoutFoot}>
                    All figures are calculated from the three return series shown in the chart. Past performance,
                    not a forecast.
                  </Text>
                </View>
              </View>

              {/* ── Your mix / Your risk profile, on the same three strategies ──
                  Two views, as on web (Performance.tsx's `mixView`): the
                  reader's own cap split, or the split their saved Risk
                  Profile answers recommend. With no saved answers, the
                  second chip is a link to the Risk Profile screen instead. */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {showRisk ? 'Your risk profile, on the same three strategies' : 'Your mix, on the same three strategies'}
                </Text>
                <View style={styles.mixChips}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !showRisk }}
                    onPress={() => setMixView('yours')}
                    style={[styles.mixChip, !showRisk && styles.mixChipOn]}>
                    <Text style={[styles.mixChipText, !showRisk && styles.mixChipTextOn]}>Your mix</Text>
                  </Pressable>
                  {riskBlend ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: showRisk }}
                      onPress={() => setMixView('risk')}
                      style={[styles.mixChip, showRisk && styles.mixChipOn]}>
                      <Text style={[styles.mixChipText, showRisk && styles.mixChipTextOn]}>Your risk profile</Text>
                    </Pressable>
                  ) : (
                    <Link href="/risk-profile" asChild>
                      <Pressable style={styles.mixChip}>
                        <Text style={styles.mixChipText}>Your risk profile →</Text>
                      </Pressable>
                    </Link>
                  )}
                </View>
                <Text style={styles.cardCaption}>
                  {showRisk
                    ? `The mix your saved Risk Profile answers recommend — ${shownBlend
                        .map((s) => `${s.name} ${s.percent}%`)
                        .join(', ')}. Edit the answers on the Risk Profile page and this view follows.`
                    : yourBlend
                      ? 'Straight from your own Segment Analysis donut, mapped onto Qode’s three strategies — Large Cap → Qode All Weather, Mid Cap → Qode Tactical Fund, Small Cap → Qode Growth Fund. Others has no equity strategy, so it is left out and the three shares are re-scaled to total 100%.'
                      : 'A fixed model mix of Qode’s strategies, computed daily and rebased to 100 on the same day as every other line. It is what that mix did over this window — not a portfolio tailored to you, and not advice.'}
                </Text>
                {/* Donut above a full-width legend, like the market-cap
                    card below. Side by side, a small phone left the legend
                    under 100dp and the strategy names broke mid-word. */}
                <View style={styles.donutCenter}>
                  <Donut
                    size={130}
                    slices={shownBlend.map((b) => ({ label: b.name, percent: b.percent, color: StrategyColor[b.code] }))}
                  />
                </View>
                <View style={[styles.legend, styles.legendFull]}>
                  {shownBlend.map((b) => (
                    <View key={b.code} style={styles.blendRow}>
                      <View style={styles.blendHead}>
                        <View style={[styles.legendSwatch, { backgroundColor: StrategyColor[b.code] }]} />
                        <Text style={[styles.legendLabel, styles.shrink]}>{b.name}</Text>
                        <Text style={styles.blendPercent}>{b.percent}%</Text>
                      </View>
                      <Text style={styles.blendRole}>{b.role}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {/* ── Allocation by market cap ── */}
          {data.capMix.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Allocation by market cap</Text>
              {/* Donut centered above a full-width legend, not beside a
                  narrow one (changed 16 Sep, at the reader's own request):
                  tapping a band expands its stock list right there, and a
                  legend column squeezed beside the donut left that list
                  cramped. Full card width gives it real room. */}
              <View style={styles.donutCenter}>
                <Donut
                  size={150}
                  slices={data.capMix.map((s) => ({ label: s.label, percent: s.percent, color: CapBandColor[s.band] }))}
                  centerLabel="Portfolio"
                  centerValue={money(data.totals.portfolio)}
                />
              </View>
              <View style={[styles.legend, styles.legendFull]}>
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
                            {s.label} {s.percent.toFixed(2)}%
                          </Text>
                          {rows?.length ? <Chevron open={open} /> : null}
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
                            {/* Matches web's own `.rv-capacc__more` exactly
                                (`Overview.tsx`, confirmed directly) —
                                missing on mobile entirely until now
                                (reported 16 Sep). Not shown for
                                `unclassified`, same as web. */}
                            {s.band !== 'unclassified' ? (
                              <Link
                                href={{ pathname: '/segments', params: { cap: s.band } }}
                                style={styles.legendMore}>
                                See how this band performed →
                              </Link>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
              <Text style={styles.coverageNote}>
                Cap labels come from SEBI&apos;s own classification, matched by ISIN. {data.capCoverage.valued} of{' '}
                {data.capCoverage.total} direct positions matched, covering {data.capCoverage.valuePercent}% of your
                stock value. ETFs are not looked through.
              </Text>
            </View>
          ) : null}

          {/* Concentration alerts removed (16 Sep, at the reader's own
              request) — confirmed against qode-oneview directly: the real
              web page already dropped this exact box on request months
              ago (Overview.tsx's own comment: "The Concentration alert box
              was removed on request (3 Sep)"). The mobile API route still
              computes and returns `data.alerts` (`concentrationAlerts()`,
              unchanged there — out of scope here), just no longer
              rendered, matching what web itself actually shows today. */}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GapFigure({ label, value, note, total }: { label: string; value: number; note: string; total?: boolean }) {
  return (
    <View style={styles.gapFigure}>
      <Text style={styles.gapFigureLabel}>{label}</Text>
      {/* Three figures share one row — shrink a long amount rather than
          wrap it on a narrow phone. */}
      <Text
        style={[styles.gapFigureValue, total && styles.gapFigureValueTotal]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}>
        {money(value)}
      </Text>
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
  calculatingCard: {
    backgroundColor: QodeColor.surfaceRaised,
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  calculatingText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textSecondary,
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
    // Lato (Bold), not Playfair, and gold not cream — confirmed against
    // web's own `.rv-hero__value` CSS and its own comment there: "this is
    // the number the whole page is about, and it has to be read as a
    // quantity rather than admired as a headline." Gold here matches the
    // Curtain's "user's own data" rule (the same reasoning `seriesClient`
    // already applies to a chart's own client line) — this is that same
    // idea for the one number the whole screen exists to answer.
    fontFamily: QodeFont.ui,
    fontSize: 40,
    color: QodeColor.gold,
    marginTop: QodeSpace[1],
    fontVariant: ['tabular-nums'],
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
  // Matches web's `.rv-coverage` exactly (review.css) — the date-range
  // line sitting just above the Journey card, itself outside any card.
  coverage: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    fontStyle: 'italic',
    color: QodeColor.faint,
    marginTop: -2,
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
  // Lato, not inherited Playfair — confirmed against review.css's own
  // "final sweep: nothing numeric keeps the display face" rule, which lists
  // `.rv-fig` (this exact figure, "Three roads from ₹X") explicitly, with
  // its own comment calling out this precise trap: "a rupee value written
  // into [a words-only element] inherits the display face however
  // carefully the list below is maintained." Only `fontFamily`/tabular-nums
  // are overridden — weight (600 there) and color both still correctly
  // inherit from `cardTitle`, same as `.rv-fig` inheriting from
  // `.rv-card__title` on web.
  cardTitleFig: { fontFamily: QodeFont.ui, fontVariant: ['tabular-nums'] },
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
  readoutVal: { fontFamily: QodeFont.ui, fontSize: 13, color: QodeColor.cream },
  readoutValGold: { color: QodeColor.accent },
  pos: { color: QodeColor.success },
  neg: { color: QodeColor.error },
  readoutFoot: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textMuted, marginTop: QodeSpace[1] },
  compare: {
    marginTop: QodeSpace[2],
    paddingTop: QodeSpace[2],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  compareHead: { flexDirection: 'row', marginBottom: QodeSpace[1] },
  compareHeadSpacer: { flex: 1 },
  compareCol: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textMuted,
    textAlign: 'right',
  },
  compareRow: { flexDirection: 'row', alignItems: 'center' },
  compareKey: { flex: 1, fontFamily: QodeFont.uiRegular, fontSize: 12.5, color: QodeColor.textSecondary },
  compareVal: { flex: 1, fontFamily: QodeFont.ui, fontSize: 13, textAlign: 'right', color: QodeColor.cream },
  compareValGold: { color: QodeColor.accent },
  shrink: { flexShrink: 1 },
  donutCenter: { alignItems: 'center', marginTop: QodeSpace[3] },
  legend: { flex: 1, gap: QodeSpace[1] },
  // Full width, not sharing a row with the donut — `flex: 1` above is
  // meaningless without a flex-row sibling to share space with; this
  // resets it and gives the now-standalone legend its own top margin
  // instead of a row's.
  legendFull: { flex: undefined, width: '100%', marginTop: QodeSpace[4] },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[2], paddingVertical: QodeSpace[1] },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: QodeFont.uiRegular, fontSize: 12, color: QodeColor.textPrimary, flex: 1 },
  blendRow: { paddingVertical: QodeSpace[1], gap: 2 },
  blendHead: { flexDirection: 'row', alignItems: 'center', gap: QodeSpace[2] },
  blendPercent: { fontFamily: QodeFont.ui, fontSize: 12, color: QodeColor.textPrimary },
  blendRole: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, lineHeight: 14, color: QodeColor.textMuted, marginLeft: 18 },
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
  legendMore: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.accent,
    marginTop: QodeSpace[2],
  },
  mixChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[2],
    marginTop: QodeSpace[3],
  },
  mixChip: {
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.pill,
    paddingHorizontal: QodeSpace[4],
    paddingVertical: QodeSpace[2],
  },
  // Gold border + gold text for the selected view, as web's chip does.
  mixChipOn: {
    borderColor: QodeColor.accent,
  },
  mixChipText: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  mixChipTextOn: {
    color: QodeColor.accent,
  },
  coverageNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    lineHeight: 16,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[4],
  },
});
