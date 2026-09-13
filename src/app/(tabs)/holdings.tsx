import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { DASH, money, signedPct } from '@/lib/format';
import { mockReviewData, type AssetType, type CapBand, type Holding } from '@/lib/mock-data';

const CAP_LABEL: Record<CapBand, string> = {
  large: 'Large',
  mid: 'Mid',
  small: 'Small',
  micro: 'Micro',
  unclassified: '—',
};

const TYPE_LABEL: Record<AssetType, string> = {
  stock: 'Stocks',
  mf: 'Funds',
  etf: 'ETFs',
  invitReit: 'InvIT/REIT',
  bank: 'Bank',
  deposit: 'Deposits',
};

/**
 * The full holdings ledger — MVP preview with dummy data shaped like the
 * real `Holding[]` contract (src/lib/mock-data.ts). See qode-oneview's
 * HoldingsTable.tsx for the real (desktop table) version this is a
 * mobile card-list adaptation of: same filter-by-type chips, same fields
 * per row (value, weight %, cap band, P&L).
 */
export default function HoldingsScreen() {
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const tabBarHeight = useTabBarHeight();
  const holdings = mockReviewData.holdings;

  const chips = useMemo(() => {
    const counts = new Map<AssetType, number>();
    for (const h of holdings) counts.set(h.type, (counts.get(h.type) ?? 0) + 1);
    return (Object.keys(TYPE_LABEL) as AssetType[])
      .filter((t) => (counts.get(t) ?? 0) > 0)
      .map((t) => ({ type: t, count: counts.get(t)! }));
  }, [holdings]);

  const rows = filter === 'all' ? holdings : holdings.filter((h) => h.type === filter);
  const [refreshing, setRefreshing] = useState(false);

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
            title="Holdings"
            subtitle="Every asset in one explorer, sort it, filter it, open any row."
            navAsOf={mockReviewData.client.navAsOf}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}>
          <FilterChip label={`All ${holdings.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          {chips.map((c) => (
            <FilterChip
              key={c.type}
              label={`${TYPE_LABEL[c.type]} ${c.count}`}
              active={filter === c.type}
              onPress={() => setFilter(c.type)}
            />
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={QodeColor.accent} />
          }>
          {rows.map((h) => (
            <HoldingRow key={h.id} holding={h} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function HoldingRow({ holding: h }: { holding: Holding }) {
  const hasPnl = h.unrealisedPnl !== null && h.unrealisedPnlPercent !== null;
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowNameCol}>
          <Text style={styles.rowName} numberOfLines={1}>
            {h.name}
          </Text>
          <View style={styles.rowMetaLine}>
            <View style={styles.capPill}>
              <Text style={styles.capPillText}>{CAP_LABEL[h.cap]}</Text>
            </View>
            <Text style={styles.rowMeta}>{h.weightPercent.toFixed(1)}% of portfolio</Text>
          </View>
        </View>
        <View style={styles.rowValueCol}>
          <Text style={styles.rowValue}>{money(h.value)}</Text>
          {hasPnl ? (
            <Text style={[styles.rowPnl, h.unrealisedPnl! >= 0 ? styles.pnlUp : styles.pnlDown]}>
              {signedPct(h.unrealisedPnlPercent)}
            </Text>
          ) : (
            <Text style={styles.rowPnlNone}>{DASH} cost basis</Text>
          )}
        </View>
      </View>
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
    // A horizontal ScrollView's own cross-axis (height) sizing from
    // content alone is unreliable in RN — without an explicit height it
    // can collapse below the chips' actual rendered height, vertically
    // clipping their text (the pill outline shows, the label doesn't).
    // An explicit height plus centered content sidesteps that entirely.
    height: 40,
    marginTop: QodeSpace[3],
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: QodeSpace[5],
    gap: QodeSpace[2],
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: QodeSpace[3],
    paddingVertical: QodeSpace[1],
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
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  chipLabelActive: {
    fontFamily: QodeFont.ui,
    color: QodeColor.textPrimary,
  },
  list: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
    gap: QodeSpace[2],
  },
  row: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: QodeSpace[3],
  },
  rowNameCol: {
    flex: 1,
  },
  rowName: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textPrimary,
  },
  rowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QodeSpace[2],
    marginTop: QodeSpace[1],
  },
  capPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: QodeRadius.sm,
    backgroundColor: QodeColor.surfaceRaised,
  },
  capPillText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10,
    color: QodeColor.textSecondary,
  },
  rowMeta: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
  },
  rowValueCol: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textPrimary,
  },
  rowPnl: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    marginTop: 2,
  },
  pnlUp: {
    color: QodeColor.success,
  },
  pnlDown: {
    color: QodeColor.error,
  },
  rowPnlNone: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    marginTop: 2,
  },
});
