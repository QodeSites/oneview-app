import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chevron } from '@/components/Chevron';
import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { CapBandColor, QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { money, pct } from '@/lib/format';
import type { CapBand, FundXray } from '@/lib/mock-data';
import { getMfXrayData } from '@/lib/reviewApi';

const GROUP_ORDER: CapBand[] = ['large', 'mid', 'small', 'unclassified'];
const GROUP_LABEL: Record<CapBand, string> = {
  large: 'Large Cap Funds',
  mid: 'Mid Cap Funds',
  small: 'Small Cap Funds',
  micro: 'Micro Cap Funds',
  unclassified: 'Debt, Gold & Other Funds',
};

/**
 * The expanded per-fund SEBI stat columns' exact label pairs — verbatim
 * from `MfXray.tsx` (`"SEBI 1–100" · "Large"`, etc.). `micro` never
 * actually appears in a real `exposure` array (confirmed against
 * `from-analysis.ts`'s own band list) but is filled in for type
 * completeness rather than left to throw on an unexpected value.
 */
const SEBI_RANGE: Record<CapBand, string> = {
  large: 'SEBI 1–100',
  mid: 'SEBI 101–250',
  small: 'SEBI 251+',
  micro: 'SEBI 251+',
  unclassified: 'Not equity',
};
const SEBI_BAND_LABEL: Record<CapBand, string> = {
  large: 'Large',
  mid: 'Mid',
  small: 'Small',
  micro: 'Micro',
  unclassified: 'Debt, cash & others',
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
 *
 * The whole card is a tap target (web's equivalent works the same way,
 * pinning a fund on click) but had no visible sign of it — reported 16
 * Sep, a first-time reader had no reason to expect a static-looking card
 * to open into a holdings list. Fixed with two cues, not one: a chevron
 * (shared with Performance's own expand affordance) that most readers
 * will already recognize, plus an explicit "Tap to view this fund's
 * holdings" caption for anyone who doesn't — shown only while collapsed,
 * so it never competes with the real holdings list once open.
 */
export default function MfXrayScreen() {
  const { state, refreshing, refresh } = useRemoteData(getMfXrayData);
  const [expanded, setExpanded] = useState<string | null>(null);
  const tabBarHeight = useTabBarHeight();

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

  const { xray, client } = state.data;
  const funds = xray.funds;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + QodeSpace[3] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />
          }>
          <PageHeader
            title="MF X-Ray"
            subtitle="What your funds actually hold, against what their label claims."
            navAsOf={client.navAsOf}
          />
          <Text style={styles.subtitle}>
            {xray.fundsResolved} of {xray.fundsHeld} funds looked through
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
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.fundName} numberOfLines={2}>
            {fund.name}
          </Text>
          {/* No "No stated mandate" fallback any more — confirmed directly
              against web's `MfXray.tsx`: that literal string doesn't exist
              anywhere in it. Web shows `mandate` only when the fund
              actually has one (a suffix on the fund's name, nothing at all
              otherwise) — a sectoral/thematic fund like the one reported
              16 Sep genuinely has no SEBI mandate category, and printing
              "No stated mandate" claimed an absence as if it were itself a
              fact worth stating. */}
          <Text style={styles.fundMeta}>
            {fund.mandate ? `${fund.mandate} · ` : ''}
            {money(fund.value)}
          </Text>
        </View>
        {/* The whole card is a tap target, but nothing on it looked
            tappable — no chevron, no hint, just a static-looking card
            (reported 16 Sep: a first-time reader had no way to know
            tapping opens the fund's actual holdings). Shares the same
            drawn chevron as Performance's cap-band legend, the app's own
            established "this expands" signal. */}
        <Chevron open={open} />
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
          <View key={e.band} style={styles.exposureLegendItem}>
            {/* Missing entirely until now (reported 16 Sep): this legend
                text has no visible link to the bar segment it names. Web
                gets away without one — its equivalent is hover/click-only,
                so the color under the pointer IS the association — but
                this row is the touch-first replacement for that
                (mobile has no hover), and needs its own color key. */}
            <View style={[styles.exposureLegendDot, { backgroundColor: CapBandColor[e.band] }]} />
            <Text style={styles.exposureLegendText}>
              {e.band === 'unclassified' ? 'Other' : e.band[0].toUpperCase() + e.band.slice(1)} {pct(e.percent, 1)}
            </Text>
          </View>
        ))}
      </View>

      {!open ? <Text style={styles.tapHint}>Tap to view this fund&apos;s holdings</Text> : null}

      {open ? (
        <View style={styles.holdings}>
          {/* The four SEBI-band stat columns from web's own per-fund detail
              card (`MfXray.tsx`'s second card, shown there on hover/click
              — this screen's `open` state is the direct touch equivalent).
              Missing from mobile entirely until now; reads straight off
              `fund.exposure`, the same array the bar above already uses —
              no new data needed. A band with 0% exposure is dropped
              entirely, matching web's own filter, rather than shown as a
              hollow "0.0%" column. */}
          <View style={styles.sebiStats}>
            {fund.exposure
              .filter((e) => e.percent > 0)
              .map((e) => (
                <View key={e.band} style={styles.sebiStat}>
                  <Text style={styles.sebiStatLabel}>
                    {SEBI_RANGE[e.band]} · {SEBI_BAND_LABEL[e.band]}
                  </Text>
                  <Text style={[styles.sebiStatValue, { color: CapBandColor[e.band] }]}>{pct(e.percent, 1)}</Text>
                </View>
              ))}
          </View>

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
          {/* `.filter(Boolean)` and an index-qualified key are runtime
              guards, not decoration: this API's real payload isn't
              guaranteed to match this file's local TS types field-for-
              field (documented in reviewApi.ts) — a null/malformed entry
              in one particular fund's real `holdings` array crashed this
              exact line reading `h.name` off it (reported 16 Sep, "error
              when open one list": the crash only ever reproduced for one
              fund, meaning the data, not the code, differed). Two names
              could also collide as a plain `key={h.name}` if the same
              company appears twice in one fund's disclosure. */}
          {fund.holdings.filter(Boolean).map((h, i) => (
            <View key={`${h.name}-${i}`} style={styles.holdingRow}>
              <View style={[styles.holdingDot, { backgroundColor: CapBandColor[h.band] }]} />
              <Text style={styles.holdingName} numberOfLines={1}>
                {h.name}
              </Text>
              <Text style={styles.holdingPct}>{pct(h.percent)}</Text>
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
  // Bold, not web's own regular weight — a deliberate mobile-specific
  // deviation at the reader's request (16 Sep): web's equivalent class
  // (`.rv-aside__label`) is actually regular weight and even more muted
  // than this already was, but making the exposure bars taller two
  // entries back left this thin heading looking proportionally smaller
  // against the bigger cards it now sits above.
  groupHeading: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    color: QodeColor.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: QodeSpace[2],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: QodeSpace[2],
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
  // 32, not 8 — matches web's real `.rv-xbar__track` exactly (review.css),
  // confirmed unchanged even at web's own narrow-screen breakpoint (its
  // 390px-width override touches this bar's layout, not its height), so
  // this isn't a "web is wide, mobile is narrow" case at all — 8 was just
  // too thin on any screen (reported 16 Sep).
  exposureBar: {
    flexDirection: 'row',
    height: 32,
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
  exposureLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exposureLegendDot: { width: 9, height: 9, borderRadius: 4.5 },
  exposureLegendText: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  tapHint: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: QodeColor.textMuted,
    marginTop: QodeSpace[3],
  },
  // Wraps to a 2-per-row grid on a phone rather than cramming 4 columns
  // into ~340dp — web's own layout is a 4-column CSS grid because desktop
  // has the width to spare; this is the mobile-appropriate reflow of the
  // same content, not a different design.
  sebiStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: QodeSpace[3],
  },
  sebiStat: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  sebiStatLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 10.5,
    color: QodeColor.textMuted,
  },
  sebiStatValue: {
    fontFamily: QodeFont.ui,
    fontSize: 20,
    marginTop: 2,
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
