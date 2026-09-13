import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, pct } from '@/lib/format';
import { mockReviewData, type BucketId } from '@/lib/mock-data';

/**
 * Segment Analysis — MVP preview with dummy data shaped like the real
 * `CapSection[]` contract. See qode-oneview's CapAnalysis.tsx for the
 * real screen: chips switch the band, each shows the customer's return
 * vs. the matching Qode strategy vs. a benchmark, then the constituent
 * holdings behind the number.
 */
export default function SegmentsScreen() {
  const sections = mockReviewData.capSections;
  const [active, setActive] = useState<BucketId>(sections[0]?.id ?? 'large');
  const section = sections.find((s) => s.id === active) ?? sections[0];
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
        <View style={styles.headerWrap}>
          <Text style={styles.dummyBadge}>Preview data</Text>
          <PageHeader
            title="Segment Analysis"
            subtitle="How much of you sits in large, mid and small caps, directly and through funds."
            navAsOf={mockReviewData.client.navAsOf}
          />
        </View>

        <View style={styles.chipsRow}>
          {sections.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setActive(s.id)}
              style={[styles.chip, active === s.id && styles.chipActive]}>
              <Text style={[styles.chipLabel, active === s.id && styles.chipLabelActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {section ? (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={QodeColor.accent} />
            }>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>{money(section.value)}</Text>
              <Text style={styles.summaryPct}>{section.percentOfPortfolio.toFixed(1)}% of portfolio</Text>
            </View>
            <Text style={styles.summarySplit}>
              Direct {money(section.directValue)} · Through funds {money(section.viaFundsValue)}
            </Text>

            {section.strategy ? (
              <Text style={styles.compareLabel}>
                vs. {section.strategy.name} · vs. {section.benchmark}
              </Text>
            ) : null}

            <View style={styles.metrics}>
              {section.metrics.map((m) => (
                <View key={m.key} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <View style={styles.metricRow}>
                    <MetricCol label="You" value={m.value} highlight={false} />
                    <MetricCol label="Qode" value={m.strategyValue} highlight />
                    <MetricCol label="Index" value={m.benchmarkValue} highlight={false} muted />
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.insight}>{section.insight}</Text>

            <Text style={styles.subhead}>What's in this band</Text>
            <View style={styles.topList}>
              {section.top.map((t) => (
                <View key={t.name} style={styles.topRow}>
                  <View style={styles.topNameCol}>
                    <Text style={styles.topName} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={styles.topVia}>
                      {t.via === 'direct' ? 'Direct holding' : t.via === 'funds' ? 'Through a fund' : 'Direct + fund'}
                    </Text>
                  </View>
                  <Text style={styles.topValue}>{money(t.value)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

function MetricCol({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: number | null;
  highlight: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.metricCol}>
      <Text style={styles.metricColLabel}>{label}</Text>
      <Text
        style={[
          styles.metricColValue,
          highlight && styles.metricColValueGold,
          muted && styles.metricColValueMuted,
        ]}>
        {pct(value, 1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    gap: QodeSpace[2],
  },
  dummyBadge: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.warning,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: QodeSpace[2],
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: QodeSpace[2],
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
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    color: QodeColor.cream,
  },
  summaryPct: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
  },
  summarySplit: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
    marginTop: 4,
  },
  compareLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[3],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metrics: {
    gap: QodeSpace[2],
    marginTop: QodeSpace[2],
  },
  metricCard: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  metricLabel: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
    marginBottom: QodeSpace[2],
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    alignItems: 'center',
  },
  metricColLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10,
    color: QodeColor.textMuted,
  },
  metricColValue: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textPrimary,
    marginTop: 2,
  },
  metricColValueGold: {
    color: QodeColor.accent,
  },
  metricColValueMuted: {
    color: QodeColor.textMuted,
  },
  insight: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[4],
  },
  subhead: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
    marginTop: QodeSpace[5],
    marginBottom: QodeSpace[2],
  },
  topList: {
    gap: QodeSpace[2],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.md,
    paddingVertical: QodeSpace[3],
    paddingHorizontal: QodeSpace[4],
  },
  topNameCol: {
    flex: 1,
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
});
