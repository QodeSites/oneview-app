import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { PageHeader } from '@/components/PageHeader';
import { ErrorView, LoadingView } from '@/components/RemoteStateView';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { fetchReportPdf } from '@/lib/api';
import { track } from '@/lib/telemetry';
import { getReportsData } from '@/lib/reviewApi';

/**
 * Reports — real data from qode-oneview's `reports/page.tsx` composition
 * via `GET /api/mobile/reports` (see MOBILE_BACKEND_CHANGES.md).
 *
 * "Download report" now actually works (16 Sep) — wired to the real,
 * unmodified `GET /api/review/report.pdf` (`fetchReportPdf` in api.ts;
 * confirmed against qode-oneview's source: the same PDF web's own
 * download button opens, generated fresh per request, no separate mobile
 * format). Deliberately NOT a WebView pointed at that URL: web's own
 * `/link` flow already needed a whole "cookie bridge" (a one-time handoff
 * code + a dedicated route) to get a WebView authenticated at all,
 * because a bare WebView doesn't reliably inherit this app's own session
 * cookie — building an equivalent bridge just for a PDF would be new
 * backend surface for no real benefit. A plain `fetch` with
 * `credentials: 'include'` already carries the same session every other
 * call in this app relies on, with zero new routes needed. The bytes are
 * then written to a real file (`expo-file-system`) and handed to the
 * OS's native "Save to Files / Share" sheet (`expo-sharing`) — arguably a
 * better mobile result than web's own "opens in a browser tab."
 *
 * `expo-file-system/legacy`, not the SDK 57 default `File`/`Directory`
 * API — the classic `writeAsStringAsync`/`cacheDirectory` functions are
 * explicitly still supported via this import path (confirmed directly
 * against the installed package's own `exports` map and deprecation
 * notices) and have an exact, long-documented signature; the new default
 * API's own `File.write()` isn't fully typed in this version's
 * declarations, not worth guessing at for a one-time file write.
 */
function bookACallUrl(phone: string, name: string): string {
  const digits = phone.replace(/\D/g, '');
  const text = `Hi, I'd like to book a call about my portfolio review. — ${name}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function ReportsScreen() {
  const { state, refreshing, refresh } = useRemoteData(getReportsData);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    const result = await fetchReportPdf();
    if (!result.ok) {
      setDownloading(false);
      setDownloadError(result.error);
      return;
    }
    try {
      const fileUri = `${FileSystem.cacheDirectory}qode-review.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, result.base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        // `UTI` is iOS's own file-type tag; without it the iOS share sheet
        // may not offer PDF-specific actions like "Save to Files".
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Save or share your review',
        });
        track('factsheet_downloaded', { product: 'portfolio_review' });
      } else {
        setDownloadError('Downloaded, but this device has no way to save or share it.');
      }
    } catch {
      setDownloadError('Could not save the report on this device. Try again.');
    } finally {
      setDownloading(false);
    }
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

  const { reports: r, client } = state.data;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.cream} />}
        >
          <PageHeader
            title="Reports"
            subtitle="Take it with you, or hand it back to us."
            navAsOf={client.navAsOf}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Download this review</Text>
            <Text style={styles.cardBody}>
              A print-perfect PDF of everything you see in the app, generated from the same data, always in sync.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.downloadButton,
                downloading && styles.downloadButtonBusy,
                pressed && styles.pressed,
              ]}
              disabled={downloading}
              onPress={() => void handleDownload()}>
              <Text style={styles.downloadButtonText}>
                {downloading ? 'Generating your report…' : '⬇ Download report'}
              </Text>
            </Pressable>
            {downloadError ? <Text style={styles.downloadError}>{downloadError}</Text> : null}
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
              style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
              onPress={() => {
                track('support_contacted', { channel: 'whatsapp' });
                Linking.openURL(bookACallUrl(r.contact.phone, client.name)).catch(() => {});
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
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
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
  downloadButtonBusy: { opacity: 0.6 },
  downloadButtonText: { fontFamily: QodeFont.ui, fontSize: 14, color: QodeColor.textOnAccent },
  downloadError: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    color: QodeColor.error,
    textAlign: 'center',
    marginTop: QodeSpace[2],
  },
  regLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: QodeSpace[3],
    marginTop: QodeSpace[4],
  },
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
