import { Lato_400Regular, Lato_700Bold, useFonts as useLatoFonts } from '@expo-google-fonts/lato';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from '@expo-google-fonts/playfair-display';
import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LockScreen } from '@/components/LockScreen';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { QodeColor } from '@/constants/qode-theme';
import { useAppAnalytics } from '@/lib/analytics';
import { AppLockProvider } from '@/lib/app-lock';
import { AuthProvider } from '@/lib/auth';
import { initTelemetry, useTelemetry } from '@/lib/telemetry';

// PostHog + Sentry, before anything renders (guarded against double init on fast refresh).
initTelemetry();

SplashScreen.preventAutoHideAsync();

/** Longest the launch screen waits for the brand fonts. */
const FONT_WAIT_MS = 3000;

/**
 * The root view's background, shown behind/before any screen paints (e.g.
 * during a navigation transition). Matches the Curtain instead of the
 * platform default white/black flash.
 *
 * NOT status/nav bar theming — as of SDK 57, edge-to-edge is enforced by
 * default on Android 15+ (and unconditionally on Android 16), and
 * `expo-status-bar`'s own `StatusBarProps` no longer even has a
 * `backgroundColor` field. System bars are always transparent now; the
 * app's own background shows through them, which is exactly what every
 * screen's <LinearGradient> already provides. All that's left to set is
 * icon/text color (light, since the Curtain is dark) via <StatusBar> below.
 */
SystemUI.setBackgroundColorAsync(QodeColor.greenDeep);

/**
 * Root layout — a bare Stack so non-tab screens (e.g. `login`) have an
 * outlet to render into. The (tabs) group supplies its own NativeTabs
 * layout (src/app/(tabs)/_layout.tsx); this Stack just hosts it as one
 * screen among siblings.
 *
 * Previously this returned <AppTabs /> directly, which left any route file
 * outside the tab set (like login.tsx) with nowhere to render — Expo's
 * static export produced byte-identical output for `/` and `/login`.
 *
 * Waits for the Curtain's brand fonts (see constants/qode-theme.ts) before
 * drawing anything on iOS and Android, while the launch screen is still up.
 * Drawing first meant a label was laid out in the system font and, on
 * Android, not always re-measured once the wider Lato Bold arrived — the
 * welcome screen's "Next" and "Skip" showed as "Nex" and "Ski" (17 Sep).
 * Web doesn't wait: returning null there broke the static export for every
 * route. A font that fails to load, or takes over 3 seconds, doesn't hold
 * the app up; it falls back to the system font.
 */
function RootLayout() {
  const colorScheme = useColorScheme();
  const [playfairLoaded, playfairError] = usePlayfairFonts({ PlayfairDisplay_500Medium, PlayfairDisplay_700Bold });
  const [latoLoaded, latoError] = useLatoFonts({ Lato_400Regular, Lato_700Bold });
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(id);
  }, []);
  const fontsSettled = Boolean((playfairLoaded || playfairError) && (latoLoaded || latoError));
  if (Platform.OS !== 'web' && !fontsSettled && !fontWaitOver) return null;

  return (
    // Required by react-native-screens' native-stack (what expo-router's
    // <Stack> renders on) and by react-native-gesture-handler generally —
    // its own docs call this mandatory at the app root. It was missing
    // here entirely; harmless while the sign-in screen was plain
    // Pressable/TextInput, but once Animated.View (Reanimated) got woven
    // into that same touch chain (the phone field's button, the OTP boxes)
    // its absence let Android's gesture/touch arbitration swallow taps
    // before they reached the TextInput — no crash, no keyboard, exactly
    // the reported symptom, and invisible in Jest/web since neither exercises
    // native touch arbitration.
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <AppLockProvider>
          <AppAnalytics />
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            {/* Light icons/text — every screen's background is the dark Curtain
                gradient, on both platforms, always (not conditioned on
                colorScheme: the app doesn't have a light theme). */}
            <StatusBar style="light" />
            {/* Inside AuthProvider, not outside it — a screen crashing and
                recovering via "Try again" (ErrorBoundary.tsx) should not also
                cost the reader their session. */}
            <ErrorBoundary>
              <Stack screenOptions={{ headerShown: false }} />
            </ErrorBoundary>
            {/* Above every screen: the Face ID / fingerprint lock, then the
                new-release prompt (which waits while the lock is up). */}
            <LockScreen />
            <UpdatePrompt />
          </ThemeProvider>
        </AppLockProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/** Install / app-open analytics (src/lib/analytics.ts), mounted once. */
function AppAnalytics() {
  useAppAnalytics();
  useTelemetry();
  return null;
}

// Sentry's root wrapper: touch/navigation breadcrumbs and a last-resort error boundary.
export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
