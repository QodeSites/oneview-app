import { LinearGradient } from 'expo-linear-gradient';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { DetailRow, ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { dayLabel } from '@/lib/format';
import { getProfileData } from '@/lib/reviewApi';

/**
 * Profile — real data from qode-oneview's `getProfile(custId)` via
 * `GET /api/mobile/profile` (see MOBILE_BACKEND_CHANGES.md). `null` means
 * nothing on file yet (e.g. analysis hasn't run), not an error.
 */
export default function ProfileScreen() {
  const { state, refreshing, refresh } = useRemoteData(getProfileData);

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

  const p = state.data;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.cream} />}
        >
          <PageHeader
            title="Your profile"
            subtitle="What we hold about you, and how to have it deleted."
            navAsOf={p?.analysisAt ?? null}
          />

          {p === null ? (
            <View style={styles.card}>
              <Text style={styles.note}>
                Nothing on file yet. Link an account to start building your profile.
              </Text>
            </View>
          ) : (
            <>
              <ProfileDetailsCard profile={p} />

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Holdings on file</Text>
                  <Text style={styles.metricValue}>{p.holdingsCount}</Text>
                  <Text style={styles.metricSub}>
                    stocks, funds and ETFs · plus {p.bankAccountCount} bank account{p.bankAccountCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Review last computed</Text>
                  <Text style={styles.metricValue}>{dayLabel(p.analysisAt)}</Text>
                  <Text style={styles.metricSub}>
                    {p.riskProfileAt ? `Risk profile completed ${dayLabel(p.riskProfileAt)}` : 'Risk profile not completed'}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>What we have read, and from where</Text>
                {p.sources.length === 0 ? (
                  <Text style={styles.note}>No sources linked yet.</Text>
                ) : (
                  p.sources.map((s) => (
                    // `s.label` alone isn't unique — confirmed against the
                    // real query (qode-oneview's profile.ts): it groups
                    // `fip_name` separately WITHIN each holding kind across
                    // 5 unioned queries, so the same provider legitimately
                    // produces two rows with the same label when it
                    // supplies more than one kind of holding (hit exactly
                    // this on a real account, 16 Sep: "Central Depository
                    // Services Limited" reporting both stocks and mutual
                    // funds). Not a bug to work around — web's own
                    // Profile.tsx already keys on this same composite
                    // (`${s.kind}-${s.label}`), matched here.
                    <DetailRow
                      key={`${s.kind}-${s.label}`}
                      label={s.label}
                      sub={`${s.kind} · ${s.count} ${s.count === 1 ? 'record' : 'records'}`}
                      value={dayLabel(s.lastSeen)}
                    />
                  ))
                )}
                <Text style={styles.note}>
                  Read-only, through the RBI&apos;s Account Aggregator framework. We can see balances and holdings;
                  we can never move money, and we never see your bank login. You can withdraw consent with your
                  Account Aggregator at any time.
                </Text>
              </View>
            </>
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
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[4],
    paddingBottom: QodeSpace[8],
    gap: QodeSpace[4],
  },
  dummyBadge: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.warning, textAlign: 'center' },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream, marginBottom: QodeSpace[2] },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    lineHeight: 17,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[3],
  },
  metricsRow: { flexDirection: 'row', gap: QodeSpace[3] },
  metric: {
    flex: 1,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.md,
    padding: QodeSpace[4],
  },
  metricLabel: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textMuted, textTransform: 'uppercase' },
  // Lato, not Playfair — confirmed against web's own Profile.tsx, where
  // both this figure (holdingsCount) and the sibling "Review last computed"
  // date share one class, `rv-metric__value`, with no bold/gold modifier.
  // review.css's own comment on that rule: "Numbers are Lato throughout.
  // Playfair is a display face... which makes it good for a heading and bad
  // for a column of figures, where the only job is to be compared against
  // the figure above it." Cream stays — that class carries no color of its
  // own either.
  metricValue: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 18,
    color: QodeColor.cream,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  metricSub: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textMuted, marginTop: 4 },
});
