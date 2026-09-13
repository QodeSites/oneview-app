import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, pct } from '@/lib/format';
import { mockReviewData, type DriftBadge, type FundXray } from '@/lib/mock-data';

const BADGE_COLOR: Record<DriftBadge, string> = {
  green: QodeColor.success,
  amber: QodeColor.warning,
  red: QodeColor.error,
};

/**
 * MF X-Ray — MVP preview with dummy data shaped like the real `FundXray[]`
 * contract. See qode-oneview's MfXray.tsx for the real screen: every fund
 * grouped by its dominant cap exposure, drawn as a split bar; tapping one
 * opens the real companies disclosed inside it.
 */
export default function MfXrayScreen() {
  const funds = mockReviewData.xray.funds;
  const [expanded, setExpanded] = useState<string | null>(funds[0]?.id ?? null);
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
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={QodeColor.accent} />
          }>
          <Text style={styles.dummyBadge}>Preview data</Text>
          <PageHeader
            title="MF X-Ray"
            subtitle="What your funds actually hold, against what their label claims."
            navAsOf={mockReviewData.client.navAsOf}
          />
          <Text style={styles.subtitle}>
            {mockReviewData.xray.fundsResolved} of {mockReviewData.xray.fundsHeld} funds looked through
          </Text>

          {funds.map((f) => (
            <FundCard
              key={f.id}
              fund={f}
              open={expanded === f.id}
              onToggle={() => setExpanded((cur) => (cur === f.id ? null : f.id))}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FundCard({ fund, open, onToggle }: { fund: FundXray; open: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onToggle}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.fundName} numberOfLines={2}>
            {fund.name}
          </Text>
          <Text style={styles.fundMeta}>
            {fund.mandate ?? 'No stated mandate'} · {money(fund.value)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${BADGE_COLOR[fund.badge]}22` }]}>
          <View style={[styles.badgeDot, { backgroundColor: BADGE_COLOR[fund.badge] }]} />
        </View>
      </View>

      <View style={styles.exposureBar}>
        {fund.exposure.map((e) => (
          <View
            key={e.band}
            style={{ flexGrow: e.percent, backgroundColor: CapBandColor[e.band] }}
          />
        ))}
      </View>
      <View style={styles.exposureLegend}>
        {fund.exposure.map((e) => (
          <Text key={e.band} style={styles.exposureLegendText}>
            {e.band === 'unclassified' ? 'Other' : e.band[0].toUpperCase() + e.band.slice(1)} {pct(e.percent, 0)}
          </Text>
        ))}
      </View>

      <Text style={styles.headline}>{fund.headline}</Text>

      {open ? (
        <View style={styles.holdings}>
          <Text style={styles.holdingsLabel}>Largest disclosed holdings</Text>
          {fund.holdings.map((h) => (
            <View key={h.name} style={styles.holdingRow}>
              <View style={[styles.holdingDot, { backgroundColor: CapBandColor[h.band] }]} />
              <Text style={styles.holdingName} numberOfLines={1}>
                {h.name}
              </Text>
              <Text style={styles.holdingPct}>{pct(h.percent, 1)}</Text>
            </View>
          ))}
          {fund.asOf ? <Text style={styles.asOf}>Disclosed portfolio as of {fund.asOf}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 26,
    color: QodeColor.cream,
  },
  dummyBadge: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.warning,
  },
  subtitle: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
    paddingHorizontal: QodeSpace[5],
    marginTop: 2,
  },
  list: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    gap: QodeSpace[3],
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
    justifyContent: 'space-between',
    gap: QodeSpace[3],
  },
  cardHeadText: {
    flex: 1,
  },
  fundName: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textPrimary,
  },
  fundMeta: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
    marginTop: 2,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  exposureBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: QodeSpace[3],
  },
  exposureLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[3],
    marginTop: QodeSpace[2],
  },
  exposureLegendText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
  },
  headline: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 18,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[3],
  },
  holdings: {
    marginTop: QodeSpace[4],
    paddingTop: QodeSpace[3],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
    gap: QodeSpace[2],
  },
  holdingsLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: QodeSpace[1],
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QodeSpace[2],
  },
  holdingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  holdingName: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  holdingPct: {
    fontFamily: QodeFont.ui,
    fontSize: 12,
    color: QodeColor.textSecondary,
  },
  asOf: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[2],
  },
});
