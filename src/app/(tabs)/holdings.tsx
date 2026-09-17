import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron } from '@/components/Chevron';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { DASH, money, rupeesExact } from '@/lib/format';
import type { AssetType, CapBand, Holding } from '@/lib/mock-data';
import { getHoldingsData } from '@/lib/reviewApi';

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

type SortKey = 'name' | 'type' | 'value' | 'weightPercent' | 'cap';
type Sort = { key: SortKey; dir: 1 | -1 };

const CAP_ORDER: Record<CapBand, number> = { large: 0, mid: 1, small: 2, micro: 3, unclassified: 4 };

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Holding' },
  { key: 'type', label: 'Category' },
  { key: 'value', label: 'Value' },
  { key: 'weightPercent', label: 'Wt %' },
  { key: 'cap', label: 'Cap' },
];

// A stable reference for the "not ready yet" case — a fresh `[]` literal
// inline would change identity every render, defeating `rows`'s own
// `useMemo` below for no reason (it can only ever be read during the
// brief loading/error state anyway, before this screen returns early).
const EMPTY_HOLDINGS: Holding[] = [];

function compareHoldings(a: Holding, b: Holding, sort: Sort): number {
  let diff = 0;
  switch (sort.key) {
    case 'name':
      diff = a.name.localeCompare(b.name);
      break;
    case 'type':
      diff = TYPE_LABEL[a.type].localeCompare(TYPE_LABEL[b.type]);
      break;
    case 'value':
      diff = a.value - b.value;
      break;
    case 'weightPercent':
      diff = a.weightPercent - b.weightPercent;
      break;
    case 'cap':
      diff = CAP_ORDER[a.cap] - CAP_ORDER[b.cap];
      break;
  }
  return diff * sort.dir;
}

/**
 * The full holdings ledger — real data from qode-oneview's
 * `components/review/HoldingsTable.tsx` composition via
 * `GET /api/mobile/holdings` (see MOBILE_BACKEND_CHANGES.md). Ported
 * directly against that file (read in full, not guessed at), as a mobile
 * card-list adaptation of its desktop table:
 *
 * - **Search** (added 16 Sep, was entirely missing): matches web's own
 *   `query` filter exactly — name OR ISIN, case-insensitive substring,
 *   synchronous on every keystroke (no debounce, no minimum length).
 *   Switching a filter chip clears the search, same as web (its own
 *   comment: a stock search left active while switching to the "Funds"
 *   chip would silently show zero rows with no visible reason why).
 * - **Sort** (added 16 Sep, was entirely missing): web's table has five
 *   clickable column headers; mobile has no table, so this is a row of
 *   tappable labels instead — same five keys, same default (Value,
 *   descending), same toggle-current-column-or-switch-with-its-own-default
 *   behavior, same ▲/▼ indicator.
 * - **Expandable detail row** (added 16 Sep, was entirely missing): tapping
 *   a holding reveals Value (precise)/Cost/Gain/Units/Category (if
 *   present)/Held at, plus a "See what it holds →" link for mutual funds
 *   only — confirmed this is a plain static link to MF X-Ray on web too
 *   (`/review/mf-xray`, no fund-specific id or query param), not a deep
 *   link into that one fund's own detail, so `/mf-xray` here matches web
 *   exactly rather than under-delivering a link web itself doesn't have.
 *
 * Gain/loss lives only in the expandable drawer, not on the collapsed row
 * — same as web, which removed "Gain" from its table columns (14 Aug).
 * The collapsed row shows just the amount.
 */
export default function HoldingsScreen() {
  const { state, refreshing, refresh } = useRemoteData(getHoldingsData);
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'value', dir: -1 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tabBarHeight = useTabBarHeight();

  const holdings = state.status === 'ready' ? state.data.data.holdings : EMPTY_HOLDINGS;
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = holdings
      .filter((h) => filter === 'all' || h.type === filter)
      .filter((h) => !q || h.name.toLowerCase().includes(q) || (h.isin ?? '').toLowerCase().includes(q));
    return [...filtered].sort((a, b) => compareHoldings(a, b, sort));
  }, [holdings, filter, q, sort]);

  function setSortKey(key: SortKey) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));
  }

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

  const chips = countByType(holdings);

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerWrap}>
          <PageHeader
            title="Holdings"
            subtitle="Every asset in one explorer, sort it, filter it, open any row."
            navAsOf={state.data.data.client.navAsOf}
          />
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search holdings…"
              placeholderTextColor={QodeColor.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}>
          <FilterChip
            label={`All ${holdings.length}`}
            active={filter === 'all'}
            onPress={() => {
              setFilter('all');
              setQuery('');
            }}
          />
          {chips.map((c) => (
            <FilterChip
              key={c.type}
              label={`${TYPE_LABEL[c.type]} ${c.count}`}
              active={filter === c.type}
              onPress={() => {
                setFilter(c.type);
                setQuery('');
              }}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortRow}
          contentContainerStyle={styles.sortContent}>
          {SORT_COLUMNS.map((col) => {
            const active = sort.key === col.key;
            return (
              <Pressable key={col.key} onPress={() => setSortKey(col.key)} style={styles.sortChip}>
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {col.label}
                  {active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />
          }>
          {/* Same gate as `upload-statement.tsx` itself (casUploadEnabled
              && something is actually missing) — matches web's own
              placement, embedded under the holdings list rather than a
              separate destination. */}
          {state.data.casUploadEnabled && (!state.data.have.funds || !state.data.have.shares) ? (
            <Link href="/upload-statement" asChild>
              <Pressable style={styles.uploadCard}>
                <Text style={styles.uploadCardTitle}>Data looks incomplete?</Text>
                <Text style={styles.uploadCardBody}>
                  Upload your CAMS/KFin or NSDL/CDSL statement — or fetch it straight from CDSL, no PDF needed.
                </Text>
              </Pressable>
            </Link>
          ) : null}
          {rows.length ? (
            rows.map((h) => (
              <HoldingRow
                key={h.id}
                holding={h}
                open={expandedId === h.id}
                onToggle={() => setExpandedId((cur) => (cur === h.id ? null : h.id))}
              />
            ))
          ) : (
            <Text style={styles.emptyNote}>
              {q ? `No holdings match "${query.trim()}".` : 'No holdings in this filter.'}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * Ported from qode-oneview's own `.rv-pill`/`.rv-pill--{cap}` (`review.css`)
 * — a solid, full-opacity fill in the cap's own color with dark text, not
 * the flat neutral badge this used to render (reported 15 Sep: "not
 * highlighted like on web"). `unclassified` is its own separate ghost-box
 * treatment there (`.rv-pill--unclassified`: transparent + a border, no
 * fill) rather than a colored pill with a dash inside it — kept that
 * distinction here too.
 */
function CapPill({ cap }: { cap: CapBand }) {
  if (cap === 'unclassified') {
    return (
      <View style={styles.capPillGhost}>
        <Text style={styles.capPillGhostText}>{CAP_LABEL[cap]}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.capPill, { backgroundColor: CapBandColor[cap] }]}>
      <Text style={styles.capPillText}>{CAP_LABEL[cap]}</Text>
    </View>
  );
}

function countByType(holdings: Holding[]) {
  const counts = new Map<AssetType, number>();
  for (const h of holdings) counts.set(h.type, (counts.get(h.type) ?? 0) + 1);
  return (Object.keys(TYPE_LABEL) as AssetType[])
    .filter((t) => (counts.get(t) ?? 0) > 0)
    .map((t) => ({ type: t, count: counts.get(t)! }));
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function HoldingRow({ holding: h, open, onToggle }: { holding: Holding; open: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={styles.rowTop}>
        <View style={styles.rowNameCol}>
          <Text style={styles.rowName} numberOfLines={1}>
            {h.name}
          </Text>
          <View style={styles.rowMetaLine}>
            <CapPill cap={h.cap} />
            <Text style={styles.rowMeta}>{h.weightPercent.toFixed(2)}% of portfolio</Text>
          </View>
        </View>
        <View style={styles.rowValueCol}>
          <Text style={styles.rowValue}>{money(h.value)}</Text>
        </View>
        <Chevron open={open} />
      </View>

      {open ? (
        <View style={styles.drawer}>
          <DrawerField label="Value" value={rupeesExact(h.value)} />
          <DrawerField label="Cost" value={h.investedValue === null ? 'not reported' : rupeesExact(h.investedValue)} />
          <DrawerField label="Gain" value={h.unrealisedPnl === null ? DASH : rupeesExact(h.unrealisedPnl)} />
          <DrawerField label="Units" value={h.units === null ? DASH : h.units.toLocaleString('en-IN')} />
          {h.schemeCategory ? <DrawerField label="Category" value={h.schemeCategory} /> : null}
          <DrawerField label="Held at" value={h.custodian ?? DASH} />
          {h.type === 'mf' ? (
            <Link href="/mf-xray" style={styles.drawerLink}>
              See what it holds →
            </Link>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function DrawerField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.drawerField}>
      <Text style={styles.drawerLabel}>{label}</Text>
      <Text style={styles.drawerValue}>{value}</Text>
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
    gap: QodeSpace[3],
  },
  dummyBadge: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.warning,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QodeSpace[2],
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.pill,
    paddingHorizontal: QodeSpace[4],
    height: 42,
  },
  searchIcon: {
    fontSize: 13,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textPrimary,
    padding: 0,
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
  sortRow: {
    height: 30,
    marginTop: QodeSpace[2],
    flexGrow: 0,
  },
  sortContent: {
    paddingHorizontal: QodeSpace[5],
    gap: QodeSpace[4],
    alignItems: 'center',
  },
  sortChip: {
    paddingVertical: 2,
  },
  sortChipText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sortChipTextActive: {
    fontFamily: QodeFont.ui,
    color: QodeColor.accent,
  },
  list: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
    gap: QodeSpace[2],
  },
  emptyNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
    textAlign: 'center',
    marginTop: QodeSpace[6],
  },
  uploadCard: {
    backgroundColor: QodeColor.accentSoft,
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
    marginBottom: QodeSpace[1],
  },
  uploadCardTitle: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textPrimary },
  uploadCardBody: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    lineHeight: 17,
    color: QodeColor.textSecondary,
    marginTop: 3,
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
    alignItems: 'center',
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
    minWidth: 46,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: QodeRadius.sm,
  },
  capPillText: {
    fontFamily: QodeFont.ui,
    fontSize: 10.5,
    color: QodeColor.greenDeep,
  },
  capPillGhost: {
    minWidth: 46,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: QodeRadius.sm,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
  },
  capPillGhostText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textMuted,
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
  drawer: {
    marginTop: QodeSpace[3],
    paddingTop: QodeSpace[3],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
    gap: QodeSpace[2],
  },
  drawerField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawerLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
  },
  drawerValue: {
    fontFamily: QodeFont.ui,
    fontSize: 12.5,
    color: QodeColor.textPrimary,
  },
  drawerLink: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.accent,
    marginTop: QodeSpace[1],
  },
});
