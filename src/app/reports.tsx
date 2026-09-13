import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from '@/components/PageHeader';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { mockReviewData } from '@/lib/mock-data';

/**
 * Reports — MVP preview. See qode-oneview's Reports.tsx for the real
 * screen: a PDF download (GET /api/review/report.pdf, already a real,
 * reusable endpoint per SPEC-mobile-dashboard.md — this screen still
 * needs building around it) and a WhatsApp book-a-call card. Fee models
 * and a fee calculator are deliberately absent there too — "OneView tells
 * someone how their portfolio is doing; anything that sells is for the
 * call," per that file's own comment.
 */
/**
 * Wired for real, matching Reports.tsx exactly — a wa.me deep link, not a
 * backend call. `data.client.name` is the mock customer's name, same as
 * the web version's `data.client.name` in its own message string.
 */
function bookACallUrl(phone: string, name: string): string {
  const digits = phone.replace(/\D/g, '');
  const text = `Hi, I'd like to book a call about my portfolio review. — ${name}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function ReportsScreen() {
  const r = mockReviewData.reports;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.dummyBadge}>Preview data</Text>
          <PageHeader
            title="Reports"
            subtitle="Take it with you, or hand it back to us."
            navAsOf={mockReviewData.client.navAsOf}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Download this review</Text>
            <Text style={styles.cardBody}>
              A print-perfect PDF of everything you see in the app, generated from the same data, always in sync.
            </Text>
            <Pressable style={styles.downloadButton} onPress={() => console.log('would open report.pdf')}>
              <Text style={styles.downloadButtonText}>⬇ Download report</Text>
            </Pressable>
            <View style={styles.regLine}>
              <Text style={styles.regEntity}>Qode Advisors LLP</Text>
              <Text style={styles.regReg}>SEBI reg. {r.sebiReg}</Text>
            </View>
          </View>

          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>Questions about this review?</Text>
            <Text style={styles.contactLine}>
              {r.contact.email} · {r.contact.phone}
            </Text>
            <Pressable
              style={styles.callButton}
              onPress={() => {
                Linking.openURL(bookACallUrl(r.contact.phone, mockReviewData.client.name)).catch(() => {});
              }}>
              <Text style={styles.callButtonText}>Book a call with Qode</Text>
            </Pressable>
          </View>

          <Text style={styles.disclaimer}>
            Past performance is not indicative of future results. Comparisons against Qode strategies apply
            strategy returns to your own market-cap weights over the stated period; they are not returns you would
            necessarily have earned, which depend on entry timing, costs and taxes. This is a portfolio review, not
            investment advice.
          </Text>
          <View style={styles.regLine}>
            <Text style={styles.regEntity}>Qode Advisors LLP</Text>
            <Text style={styles.regReg}>SEBI reg. {r.sebiReg}</Text>
          </View>
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
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream },
  cardBody: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[2],
    marginBottom: QodeSpace[4],
  },
  downloadButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  downloadButtonText: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textOnAccent },
  regLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: QodeSpace[4] },
  regEntity: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  regReg: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted },
  contactCard: {
    backgroundColor: QodeColor.greenDeep,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  contactLine: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textSecondary, marginTop: QodeSpace[1] },
  callButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: QodeSpace[4],
  },
  callButtonText: { fontFamily: QodeFont.ui, fontSize: 14.5, color: QodeColor.textOnAccent },
  disclaimer: { fontFamily: QodeFont.uiRegular, fontSize: 11, lineHeight: 17, color: QodeColor.textMuted },
});
