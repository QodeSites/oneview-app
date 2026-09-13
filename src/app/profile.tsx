import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { dayLabel } from '@/lib/format';
import { mockReviewData } from '@/lib/mock-data';

/**
 * Profile — MVP preview. See qode-oneview's Profile.tsx for the real
 * screen: "what do you know about me", account details, and every
 * connected source named plainly ("HDFC Bank, 1 account, read on 17 Aug"
 * rather than an abstract "we hold your data").
 */
export default function ProfileScreen() {
  const p = mockReviewData.profile;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.dummyBadge}>Preview data</Text>
          <PageHeader
            title="Your profile"
            subtitle="What we hold about you, and how to have it deleted."
            navAsOf={mockReviewData.client.navAsOf}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your details</Text>
            <Row label="Name" value={p.name} />
            <Row label="Mobile" value={p.phone} />
            <Row label="PAN" value={p.panMasked} />
            <Row label="Email" value={p.email} />
            <Row label="Member since" value={dayLabel(p.memberSince)} />
            <Row label="Account reference" value={p.custId} small />
            <Text style={styles.note}>
              To correct any of this, write to investor.relations@qodeinvest.com. Your mobile number cannot be
              changed here — it is what your accounts are linked against.
            </Text>
          </View>

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
            {p.sources.map((s) => (
              <Row
                key={s.label}
                label={s.label}
                sub={`${s.kind} · ${s.count} ${s.count === 1 ? 'record' : 'records'}`}
                value={dayLabel(s.lastSeen)}
              />
            ))}
            <Text style={styles.note}>
              Read-only, through the RBI&apos;s Account Aggregator framework. We can see balances and holdings; we
              can never move money, and we never see your bank login. You can withdraw consent with your Account
              Aggregator at any time.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Row({ label, sub, value, small }: { label: string; sub?: string; value: string; small?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={[styles.rowValue, small && styles.rowValueSmall]}>{value}</Text>
    </View>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: QodeSpace[2],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  rowLeft: { flex: 1 },
  rowLabel: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textPrimary },
  rowSub: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted, marginTop: 1 },
  rowValue: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textSecondary },
  rowValueSmall: { fontSize: 11.5 },
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
  metricValue: { fontFamily: QodeFont.display, fontSize: 18, color: QodeColor.cream, marginTop: 4 },
  metricSub: { fontFamily: QodeFont.uiRegular, fontSize: 10.5, color: QodeColor.textMuted, marginTop: 4 },
});
