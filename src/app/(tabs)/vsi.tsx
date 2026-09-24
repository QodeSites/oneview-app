import { LinearGradient } from 'expo-linear-gradient';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VsiChart } from '@/components/charts/VsiChart';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { getVsiIndicator } from '@/lib/reviewApi';

/**
 * VSI (Valuation Spread Indicator) — Market Breadth chart only. Mobile port
 * of qode-oneview's `/review/vsi` (branch `feature/vsi-indicator`,
 * `src/components/review/Vsi.tsx`, read in full before porting).
 *
 * A primary bottom tab (not tucked into More, where web itself places VSI
 * in its own nav — Shell.tsx: "market-wide, not derived from this
 * customer's own holdings — every other page in this group is") — kept as
 * its own tab here per explicit request.
 *
 * Same fixed combination as web (Combined / pb_ratio_lag / 10 Years / 2
 * buckets / Daily), no filter UI — `GET /api/mobile/vsi` bakes those in
 * server-side, so this screen never sees or sends them.
 *
 * One card per band, stacked vertically (18 Sep, on request — a swipeable
 * carousel was tried first, but hid four of the five cards behind a swipe;
 * stacking keeps all of them reachable by an ordinary scroll instead).
 * Overall first, then Large/Mid/Small/Micro — same order requested. Each
 * card's own drag tooltip (`VsiChart`) carries that one band's value at a
 * point in time; there's nothing to select, so no toggle row or legend.
 */
const SEGMENTS: { key: string; label: string; color: string }[] = [
  { key: 'Top 750', label: 'Overall', color: QodeColor.info },
  { key: 'Top 100', label: 'Large Cap', color: QodeColor.capLarge },
  { key: '101-250', label: 'Mid Cap', color: QodeColor.capMid },
  { key: '251-500', label: 'Small Cap', color: QodeColor.capSmall },
  // Brightened from `QodeColor.capMicro` (#d4703f) — the same reason web's
  // own Vsi.tsx brightens it for this exact use: the shared token only
  // clears ~3.4:1 contrast against this dark background, this reaches
  // ~4.5:1. Matches web's value verbatim rather than re-deriving it.
  { key: '500-750', label: 'Micro Cap', color: '#e2895f' },
];

/**
 * qode360's own "10 Years" lookback parameter turned out not to actually
 * bound the response — a live pull returned data back to 2000, not a
 * 10-year window (checked directly, 18 Sep). Filtered here instead of
 * trusting that parameter: 2006 is what was asked for once that was
 * found, rather than the un-bounded raw response.
 */
const START_DATE = '2006-01-01';

export default function VsiScreen() {
  const { state, refreshing, refresh } = useRemoteData(getVsiIndicator);
  const tabBarHeight = useTabBarHeight();
  // Each tab reopens at its own top — see the hook.
  const scrollRef = useScrollToTopOnFocus();

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

  const { series, notReady } = state.data;
  const bySegment = new Map(series.map((s) => [s.segment, s]));
  const latestDate = series.flatMap((s) => s.points.map((p) => p.date)).sort().slice(-1)[0] ?? null;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
          <PageHeader
            title="Valuation Spread Indicator (VSI)"
            subtitle="Market breadth — the share of stocks in the second valuation bucket, by market-cap segment (P/B, since 2006)."
            navAsOf={latestDate}
          />

          <Text style={styles.sectionTitle}>Market Breadth</Text>

          {notReady ? (
            <View style={styles.card}>
              <Text style={styles.status}>No precomputed VSI data for this combination yet.</Text>
            </View>
          ) : (
            SEGMENTS.map((seg) => (
              <View key={seg.key} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.cardDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.cardTitle}>{seg.label}</Text>
                </View>
                <Text style={styles.axisCaption}>% of stocks in bucket 2</Text>
                <VsiChart
                  segments={[
                    {
                      key: seg.key,
                      label: seg.label,
                      color: seg.color,
                      points: (bySegment.get(seg.key)?.points ?? []).filter((p) => p.date >= START_DATE),
                    },
                  ]}
                  height={240}
                />
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingTop: QodeSpace[4],
    paddingHorizontal: QodeSpace[5],
    gap: QodeSpace[3],
  },
  sectionTitle: {
    fontFamily: QodeFont.display,
    fontSize: 17,
    color: QodeColor.cream,
  },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QodeSpace[2],
    marginBottom: QodeSpace[2],
  },
  cardDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  cardTitle: {
    fontFamily: QodeFont.display,
    fontSize: 15,
    color: QodeColor.cream,
  },
  axisCaption: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.faint,
    marginBottom: QodeSpace[1],
  },
  status: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.faint,
    textAlign: 'center',
    paddingVertical: QodeSpace[7],
  },
});
