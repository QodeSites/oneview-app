import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { getLinkEntryUrl, requestLinkHandoff } from '@/lib/api';

type Phase = 'starting' | 'loading' | 'ready' | 'already-linked' | 'error';

/**
 * Screen 2 — link accounts. Per SPEC-mobile-linking.md: this wraps
 * qode-oneview's real, unmodified `/link` flow in a WebView rather than
 * reimplementing anything FinVU-related — no native FinVU SDK exists on
 * any platform, and account-linking consent has exactly ONE owner across
 * every Qode system (two systems creating AA consents for the same
 * customer race the same FIP and have been observed to return FEWER
 * accounts on overlapping retries). Reusing `/link` verbatim means mobile
 * is the same owner OneView-web already is, not a second one.
 *
 * The only native-side logic here is the "cookie bridge" the spec calls
 * for: trade the app's own session for a one-time code
 * (`requestLinkHandoff`), then load `/api/mobile/link-entry?handoff=...`,
 * which sets the ordinary web session cookie and redirects into `/link`.
 * From that point on this is a completely normal browser session running
 * the real FinVU journey unchanged — nothing FinVU-related is touched
 * here, by design (see the spec's "Never do" list).
 *
 * Two real bugs fixed here 16 Sep, found by tracing qode-oneview's actual
 * source rather than guessing from symptoms alone:
 *
 * 1. `phase: 'ready'` was declared in the type above but never actually
 *    set anywhere — so the "took too long to start" check a few lines
 *    down, guarded on `phase === 'loading'`, stayed armed for the
 *    WebView's ENTIRE lifetime, not just its initial handoff. A LATER,
 *    perfectly normal bounce through a URL matching `/login` deep in the
 *    real FinVU journey (unrelated to this app's own handoff code) would
 *    misreport as the handoff itself timing out. Now set once the WebView
 *    genuinely reaches `/link` (not `/login`) for the first time, and the
 *    timeout check only fires before that ever happens.
 * 2. Confirmed against `/link/page.tsx`'s own source: an account whose
 *    `custId` has EVER had a single row in `aa_consents` — from this test
 *    session or any earlier one — gets redirected straight to `/review`
 *    on ANY visit that doesn't explicitly pass `force=1`, without the
 *    FinVU journey ever rendering at all. `more.tsx`'s "Link accounts"
 *    entry never passes `force=1`, so for an account that's ever
 *    completed linking before, EVERY future tap reproduces this
 *    deterministically — not an intermittent failure. Since a failed
 *    `link-entry` call (the "took too long" `/login` outcome) never calls
 *    `setSessionCookie` and can't have created a consent, this is a
 *    SEPARATE situation from bug 1, not the same one two ways. Silently
 *    forwarding to Performance here read as "no direction, nothing
 *    happened" (reported 16 Sep) — now shown as its own explicit
 *    "already linked" state, with a real way to link ANOTHER account
 *    (re-running the same handoff with `force=1`, which `/link/page.tsx`'s
 *    gate already honors — no qode-oneview change needed).
 *
 * A third, reported again after both fixes above (16 Sep): the FIRST tap
 * on "Link accounts" always failed with "took too long to start," and an
 * immediate second tap always worked — a deterministic pattern, not a real
 * intermittent timeout. Traced (research agent, tracing the actual
 * request lifecycle rather than guessing) to `webview-handoff.ts`'s
 * one-time code being deliberately single-use — correct against two
 * genuinely concurrent callers, but unable to tell that apart from the
 * SAME request getting duplicated somewhere between the WebView and the
 * server (a cold dev-server compile plus a Cloudflare quick tunnel's own
 * retry-on-slow-origin behavior, in the environment this was reproduced
 * in — a real duplicate-delivery condition, not a mobile code bug, and
 * not something `webview-handoff.ts`'s consume logic did wrong). One
 * request's delivery wins and sets the cookie; the orphaned duplicate
 * finds the code already consumed and bounces to `/login`, and whichever
 * of the two the WebView happens to report determines what this screen
 * sees. Fixed on the mobile side, since that's what's editable here: the
 * `/login` branch below now mints an entirely fresh handoff code and
 * retries silently ONCE before showing any error — the same fix the user
 * was already doing by hand (tapping again), just automatic. Only a
 * second failure within the same attempt is shown as a real error.
 */
export default function LinkAccountsScreen() {
  const router = useRouter();
  const { force } = useLocalSearchParams<{ force?: string }>();
  const [phase, setPhase] = useState<Phase>('starting');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A local, settable copy of the route's own `force` param, not the
  // param itself — "Link another account" (the already-linked state's own
  // action) needs to flip this to `true` and re-run `start`, and a route
  // param isn't something this screen can rewrite in place.
  const [forceLink, setForceLink] = useState(force === '1');
  const webviewRef = useRef<WebView>(null);
  // Whether the silent auto-retry (see `handleNavigation`'s `/login`
  // branch) has already fired for the current attempt — a ref, not state,
  // since it's read/written from an event handler and must never itself
  // trigger a re-render.
  const retriedRef = useRef(false);

  // Split from `start` below so the mount effect's own trigger (right
  // underneath) only ever calls the pure-fetch half, not the synchronous
  // UI reset — a smaller improvement than it might look like: `use-remote-
  // data.ts`'s own `useEffect(() => { load(false); }, [load])` (the fetch-
  // on-mount hook every other screen in this app already uses) trips the
  // exact same `react-hooks/set-state-in-effect` finding this file did,
  // confirmed by running eslint on it directly. That's a codebase-wide,
  // already-tolerated shape of this pattern, not something this file
  // introduced or can fix in isolation without changing how every screen
  // fetches on mount — left as the same standing, tolerated finding.
  const load = useCallback(async () => {
    const result = await requestLinkHandoff();
    if (!result.ok) {
      setError(result.error);
      setPhase('error');
      return;
    }
    setUrl(getLinkEntryUrl(result.code, { force: forceLink }));
    setPhase('loading');
  }, [forceLink]);

  // Re-runs automatically whenever `forceLink` flips — `load` is recreated
  // (it closes over `forceLink`), which this effect depends on. Covers
  // both the very first mount and "Link another account" with the same
  // effect, rather than two separate triggers that could double-fire.
  useEffect(() => {
    void load();
  }, [load]);

  // The synchronous, user-event-triggered version — resets visible state
  // immediately (a Pressable's `onPress` running this is a normal event
  // handler, not an effect body, so setState here is exactly what React
  // expects) then kicks off the same `load()` the mount effect uses.
  const start = useCallback(() => {
    retriedRef.current = false;
    setPhase('starting');
    setError(null);
    setUrl(null);
    void load();
  }, [load]);

  /**
   * SPEC-mobile-linking.md's Open Question #1 originally guessed the web
   * journey would land on `/link/done` once finished, and watched for that.
   * It doesn't: `/link/done` is dead code on the real happy path — it's
   * only FinVU's own declared fallback redirect target, used if their SDK
   * ever bounces out to its own hosted screens (confirmed by reading
   * `src/app/link/done/page.tsx`'s own comment and `LinkFlow.tsx` directly).
   * The actual journey (`src/components/journey/LinkFlow.tsx`) finishes
   * with `window.location.replace("/review")` once the post-consent fetch
   * settles — a FULL browser navigation onto qode-oneview's real dashboard,
   * complete with its OWN responsive nav (`MobileNav`'s `rv-tabs`). Watching
   * for the wrong URL meant this screen never closed: the WebView just sat
   * there showing that dashboard and its own tab bar UNDER this app's own
   * tab bar — "tabs on tabs" (reported 15 Sep).
   */
  function handleNavigation(nav: WebViewNavigation) {
    const isReview = /\/review(?:[/?]|$)/.test(nav.url) || nav.url.includes('/link/done');
    if (isReview) {
      if (phase === 'ready') {
        // A genuinely completed journey — this WebView actually showed
        // the FinVU steps before landing here.
        router.replace('/performance');
      } else {
        // Landed on /review WITHOUT ever passing through the journey —
        // `/link/page.tsx`'s own "already has a live consent" gate (see
        // this file's top comment) skipping straight past it, not a just-
        // finished flow.
        setPhase('already-linked');
      }
      return;
    }

    // The one real "the handoff worked, we're past /login" signal —
    // reaching `/link` itself (not `/login`) for the first time. Arms
    // `ready` so a LATER, legitimate bounce through `/login` deep in the
    // real journey is never mistaken for the handoff timing out (see this
    // file's top comment, bug 1).
    // `!nav.loading`: only once `/link` has finished loading. `/link`
    // redirects an already-consented account on to `/review`, and the
    // WebView reports `/link` for a moment on the way — counting that as
    // the journey starting made the `/review` that followed look like a
    // finished journey and sent the reader to Performance (17 Sep).
    if (phase === 'loading' && !nav.loading && /\/link(?:[/?]|$)/.test(nav.url) && !/\/login(\?|$)/.test(nav.url)) {
      setPhase('ready');
      return;
    }

    if (phase === 'loading' && /\/login(\?|$)/.test(nav.url)) {
      // A one-time handoff code is deliberately single-use (`webview-
      // handoff.ts`'s own comment: "so a caller that somehow fires twice
      // concurrently cannot both win") — correct against two genuine
      // concurrent callers, but it can't tell that apart from a SINGLE
      // request getting duplicated somewhere between here and the server
      // (confirmed 16 Sep: reproduces as "first tap always fails, second
      // tap immediately after always works," which is exactly the
      // signature of an orphaned retry finding the code already consumed
      // by the delivery that actually succeeded — not a real timeout).
      // Minting an entirely fresh code and trying again, silently, once,
      // is the same fix the user was already doing by hand (tap again);
      // this just does it automatically instead of surfacing an error for
      // a condition that self-resolves on the very next attempt. Only a
      // SECOND failure in the same attempt (the retry itself also landing
      // on /login) is treated as a real failure worth showing.
      if (!retriedRef.current) {
        retriedRef.current = true;
        // Also back to 'starting', not just clearing `url` — otherwise
        // the brief gap between tearing down this WebView and the retry's
        // fresh `url` landing has nothing to render (the spinner view only
        // shows for 'starting'/'error'/'already-linked', the WebView only
        // for a set `url`), so the screen would flash blank for a beat.
        setPhase('starting');
        setUrl(null);
        void load();
        return;
      }
      setError('Linking took too long to start — try again.');
      setPhase('error');
      setUrl(null);
    }
  }

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Link your accounts</Text>
          {/* Deliberately just "Close", not a back arrow — the WebView's
              own multi-step FinVU journey has its own internal navigation
              (Open Question #3 in the spec); this native chrome should not
              also offer a "back" that fights it. */}
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {phase === 'starting' || phase === 'error' || phase === 'already-linked' ? (
          <View style={styles.centered}>
            {phase === 'starting' ? (
              <ActivityIndicator color={QodeColor.accent} />
            ) : phase === 'already-linked' ? (
              <>
                <Text style={styles.message}>
                  This phone is already linked. Head back to your dashboard, or link another account.
                </Text>
                <Pressable style={styles.retryButton} onPress={() => router.replace('/performance')}>
                  <Text style={styles.retryText}>Go to dashboard</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    // A fresh attempt gets its own chance at the silent
                    // auto-retry above — otherwise a "Link another
                    // account" run that also happened to hit the same
                    // duplicate-request condition would skip straight to
                    // the hard error with no retry at all, since the flag
                    // would still be set from whatever attempt led here.
                    retriedRef.current = false;
                    setForceLink(true);
                  }}>
                  <Text style={styles.linkAnother}>Link another account</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={() => void start()}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {/* Hidden once `already-linked` is decided, not just left to sit
            underneath — `url` is still set (the load that got us here
            genuinely succeeded), and this is the exact "WebView showing a
            real qode-oneview page under this app's own chrome" shape the
            top comment's "tabs on tabs" bug already happened once from. */}
        {url && phase !== 'already-linked' ? (
          <WebView
            ref={webviewRef}
            source={{ uri: url }}
            style={styles.webview}
            onNavigationStateChange={handleNavigation}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator color={QodeColor.accent} />
              </View>
            )}
          />
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: QodeSpace[5],
    paddingVertical: QodeSpace[3],
    borderBottomWidth: 1,
    borderBottomColor: QodeColor.divider,
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 17,
    color: QodeColor.cream,
  },
  close: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.accent,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[4],
    paddingHorizontal: QodeSpace[5],
  },
  errorText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.error,
    textAlign: 'center',
  },
  message: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textSecondary,
    textAlign: 'center',
  },
  linkAnother: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.accent,
    textDecorationLine: 'underline',
    marginTop: QodeSpace[1],
  },
  retryButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryText: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textOnAccent,
  },
  webview: {
    flex: 1,
    backgroundColor: QodeColor.background,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: QodeColor.background,
  },
});
