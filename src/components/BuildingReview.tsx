import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import type { AnalysisState, BuildingState } from '@/lib/reviewApi';

/**
 * Ported from qode-oneview's `src/components/review/BuildingReview.tsx` —
 * the wait screen a customer sees whose consent EXISTS but hasn't delivered
 * yet (`presence.consent.hasConsent && !everDelivered`). Only the "fetching"
 * phase is ported (an elapsed clock, no percentage — mobile has no
 * equivalent of the real "building" phase's slice-count progress, since
 * `/api/mobile/review` doesn't expose engine-stage counts), plus the real
 * "hasn't come through yet" fallback once `FETCH_BUDGET_MS` (60s, same
 * constant as `src/features/review/fetch-budget.ts`) has passed — matching
 * the real copy's own reasoning: a straight answer, not an apology, naming
 * the actual registrars (CAMS/KFin/NSDL/CDSL) rather than "your providers".
 *
 * NOT ported: the CasUpload fallback the web version offers alongside the
 * WhatsApp link — that flow doesn't exist on mobile yet (see PROGRESS.md).
 *
 * There is no polling here the way the web version's `router.refresh()`
 * interval has — `app-tabs.tsx`'s own `useRemoteData` re-fetches on
 * pull-to-refresh (its `TabsGate` now actually wraps this in a
 * `ScrollView`+`RefreshControl` — it never did before, despite this
 * screen's own "Pull down to check again" copy always assuming it would;
 * fixed 16 Sep alongside the dead end below), and re-mounting this screen
 * (tab switch, app foreground) re-runs the presence check on its own.
 *
 * `AggregatorTrouble` gained a real "Link another account" action (16
 * Sep) — someone who backs out of `/link` before finishing lands here
 * with a valid-but-undelivered consent and, before this, had no way back
 * into the linking journey at all short of `app-tabs.tsx`'s separate
 * `/more` fix (see that file's own comment) landing them on the Sign-out/
 * Link-accounts list a tap away instead. This is the direct, one-tap
 * version of the same escape route, from the exact screen that reported
 * it ("I am stuck").
 */
const FETCH_BUDGET_MS = 60_000;

/** Same contact number `/api/mobile/reports` returns as `REPORTS_CONFIG.contact.phone` — hardcoded here since this screen renders before any dashboard data (including Reports) has loaded. */
const CONTACT_PHONE = '+91 98203 00028';

export function BuildingReview({ building }: { building: BuildingState }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const base = building.startedAt ? Date.parse(building.startedAt) : Date.now();
    const tick = () => setElapsedSeconds(Math.max(0, Math.round((Date.now() - base) / 1000)));
    tick();
    const clock = setInterval(tick, 1000);
    return () => clearInterval(clock);
  }, [building.startedAt]);

  const overdue = elapsedSeconds * 1000 > FETCH_BUDGET_MS;

  if (overdue) return <AggregatorTrouble elapsedSeconds={elapsedSeconds} />;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Collecting your accounts</Text>
        <Text style={styles.body}>Your providers are sending it over — usually a minute or two.</Text>
        <View style={styles.meterTrack}>
          <View style={styles.meterIndeterminate} />
        </View>
        <Text style={styles.elapsed}>{elapsedSeconds}s elapsed</Text>
        <Text style={styles.foot}>
          Pull down to check again — this opens on its own the moment your data arrives.
        </Text>
      </View>
    </View>
  );
}

/** After this long, the building screen adds a "taking longer" note with a way to reach us. */
const BUILD_SLOW_MS = 5 * 60_000;

function openWhatsApp(text: string) {
  Linking.openURL(`https://wa.me/${CONTACT_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`).catch(
    () => {},
  );
}

/**
 * "Building your review" — web BuildingReview's building phase. The
 * accounts are in and the first analysis is running; the dashboard stays
 * hidden until it's complete, so a first-time customer never sees the donut
 * beside empty charts and zero values.
 *
 * The meter follows web: real progress from finished engine stages, with a
 * time-based floor creeping toward 88% so it never looks frozen, never below
 * 8% and never 100% while still here.
 */
export function AnalysisBuilding({ analysis }: { analysis: AnalysisState }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const base = analysis.startedAt ? Date.parse(analysis.startedAt) : Date.now();
    const tick = () => setElapsedSeconds(Math.max(0, Math.round((Date.now() - base) / 1000)));
    tick();
    const clock = setInterval(tick, 1000);
    return () => clearInterval(clock);
  }, [analysis.startedAt]);

  const slicePct = Math.round((analysis.done / Math.max(1, analysis.total)) * 100);
  const creepPct = Math.round(88 * (1 - Math.exp(-elapsedSeconds / 55)));
  const pct = Math.min(96, Math.max(8, slicePct, creepPct));
  const stage =
    pct < 35 ? 'Reading what you hold' : pct < 70 ? 'Valuing it against the market' : 'Working out your market-cap split';
  const slow = elapsedSeconds * 1000 > BUILD_SLOW_MS;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Building your review</Text>
        <Text style={styles.body}>
          Accounts are in. Pricing every holding against the market — a couple of minutes, first time only.
        </Text>
        <View
          style={styles.meterTrack}
          accessibilityRole="progressbar"
          accessibilityLabel="Building your review"
          accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <View style={[styles.meterFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.meterRow}>
          <Text style={styles.stage}>{stage}…</Text>
          <Text style={styles.elapsed}>{pct}%</Text>
        </View>
        <Text style={styles.foot}>
          {elapsedSeconds > 0 ? `${elapsedSeconds}s elapsed · ` : ''}Your dashboard opens by itself when it&apos;s
          ready. You can close the app and come back.
        </Text>
        {slow ? (
          <>
            <Text style={styles.explain}>
              This is taking longer than usual. We&apos;re still working on it — if it doesn&apos;t open soon,
              message us and we&apos;ll look into it.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.linkAgainButton, pressed && styles.pressed]}
              onPress={() => openWhatsApp("Hi, my OneView dashboard is still building and I need a hand.")}>
              <Text style={styles.linkAgainButtonText}>Message us on WhatsApp</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function AggregatorTrouble({ elapsedSeconds }: { elapsedSeconds: number }) {
  const router = useRouter();
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Your data hasn&apos;t come through yet</Text>
        <Text style={styles.body}>
          Nothing you did — your banks and brokers haven&apos;t sent it. We&apos;re still asking, and this screen
          updates on its own the moment it arrives.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.whatsappButton, pressed && styles.pressed]}
          onPress={() => {
            const text = "Hi, my OneView data hasn't come through and I need a hand.";
            Linking.openURL(`https://wa.me/${CONTACT_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`).catch(
              () => {},
            );
          }}>
          <Text style={styles.whatsappButtonText}>Message us on WhatsApp</Text>
        </Pressable>
        {/* Missing entirely until now (reported 16 Sep): someone who backed
            out of `/link` before finishing (its own "Close" button, or the
            OS back gesture) can land here with a consent that's valid but
            never delivered — the exact account they meant to add is stuck
            waiting, and there was no way back into the linking journey to
            try again or add a different one, only a support contact. */}
        <Pressable
          style={({ pressed }) => [styles.linkAgainButton, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/link', params: { force: '1' } })}>
          <Text style={styles.linkAgainButtonText}>Link another account</Text>
        </Pressable>
        <Text style={styles.explain}>
          Your consent is valid and our request was accepted — what hasn&apos;t happened is delivery. Holdings reach
          us through the RBI&apos;s Account Aggregator network, which collects them from CAMS and KFin for mutual
          funds and NSDL and CDSL for stocks. Those systems intermittently fail to return data, and there is nothing
          on this screen that can hurry them.
        </Text>
        <Text style={styles.foot}>
          Still checking in the background · {minutes}m {seconds}s since the request went out.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: QodeSpace[5],
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[5],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 20,
    color: QodeColor.cream,
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[3],
  },
  meterTrack: {
    height: 5,
    borderRadius: QodeRadius.pill,
    backgroundColor: QodeColor.surfaceRaised,
    overflow: 'hidden',
    marginTop: QodeSpace[4],
  },
  meterIndeterminate: {
    width: '40%',
    height: '100%',
    borderRadius: QodeRadius.pill,
    backgroundColor: QodeColor.accent,
  },
  meterFill: {
    height: '100%',
    borderRadius: QodeRadius.pill,
    backgroundColor: QodeColor.accent,
  },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: QodeSpace[2],
    marginTop: QodeSpace[2],
  },
  stage: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textSecondary,
  },
  elapsed: {
    fontFamily: QodeFont.ui,
    fontSize: 12,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[2],
  },
  foot: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    lineHeight: 17,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[4],
  },
  whatsappButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: QodeSpace[4],
  },
  whatsappButtonText: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textOnAccent,
  },
  // Quieter than the WhatsApp button — that one is the primary action for
  // "our own request is stuck," this one is for "let me try a different
  // account instead," a real but secondary path out.
  linkAgainButton: {
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: QodeSpace[2],
  },
  linkAgainButtonText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13.5,
    color: QodeColor.textSecondary,
  },
  explain: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[4],
    paddingTop: QodeSpace[3],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
});
