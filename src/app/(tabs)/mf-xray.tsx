import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, pct } from '@/lib/format';
import { mockReviewData, type CapBand, type FundXray } from '@/lib/mock-data';

const GROUP_ORDER: CapBand[] = ['large', 'mid', 'small', 'unclassified'];
const GROUP_LABEL: Record<CapBand, string> = {
  large: 'Large Cap Funds',
  mid: 'Mid Cap Funds',
  small: 'Small Cap Funds',
  micro: 'Micro Cap Funds',
  unclassified: 'Debt, Gold & Other Funds',
};

/** A fund's own dominant exposure — same rule qode-oneview's MfXray.tsx groups by. */
function dominantBand(fund: FundXray): CapBand {
  return [...fund.exposure].sort((a, b) => b.percent - a.percent)[0]?.band ?? 'unclassified';
}

/**
 * MF X-Ray — MVP preview with dummy data shaped like the real `FundXray[]`
 * contract. Matches qode-oneview's MfXray.tsx: funds grouped by dominant
 * cap exposure under a heading, drawn as a split bar; tapping one opens
 * the real companies disclosed inside it.
 *
 * Deliberately NOT shown, matching the real screen: a drift badge
 * (green/amber/red) or a verdict-style headline ("30% outside mandate").
 * qode-oneview's own file comment explains why it was removed from web —
 * "a judgement about a fund manager's choices rather than a fact about
 * the reader's money" — and `FundXray` still carries `badge`/`headline`
 * only because the QA exports report them, not because a screen reads
 * them. What's shown instead: the exposure bars themselves (the fact),
 * and — once expanded — the same factual sentence web shows for a pinned
 * fund ("largest disclosed positions outside its mandate: X, Y").
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

          {GROUP_ORDER.flatMap((band) => {
            const members = funds.filter((f) => dominantBand(f) === band);
            if (!members.length) return [];
            return [
              <Text key={`head-${band}`} style={styles.groupHeading}>
                {GROUP_LABEL[band]}
              </Text>,
              ...members.map((f) => (
                <FundCard
                  key={f.id}
                  fund={f}
                  open={expanded === f.id}
                  onToggle={() => setExpanded((cur) => (cur === f.id ? null : f.id))}
                />
              )),
            ];
          })}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FundCard({ fund, open, onToggle }: { fund: FundXray; open: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onToggle}>
      <Text style={styles.fundName} numberOfLines={2}>
        {fund.name}
      </Text>
      <Text style={styles.fundMeta}>
        {fund.mandate ?? 'No stated mandate'} · {money(fund.value)}
      </Text>

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

      {open ? (
        <View style={styles.holdings}>
          {/* Fact, not a verdict — same sentence qode-oneview's own
              pinned-fund detail shows, not a "30% outside mandate" grade. */}
          <Text style={styles.holdingsNote}>
            You hold {money(fund.value)} of this fund
            {fund.culprits.length
              ? `. Largest disclosed positions outside its mandate: ${fund.culprits.join(', ')}.`
              : '.'}
            {fund.asOf ? ` Disclosure as of ${fund.asOf}.` : ''}
          </Text>
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
  groupHeading: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: QodeSpace[2],
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
  holdingsNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 18,
    color: QodeColor.textSecondary,
    marginBottom: QodeSpace[2],
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
});
