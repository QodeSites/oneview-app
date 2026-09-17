import { Lato_400Regular, Lato_700Bold, useFonts as useLatoFonts } from '@expo-google-fonts/lato';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from '@expo-google-fonts/playfair-display';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QodeColor } from '@/constants/qode-theme';
import { AuthProvider } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

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
 * Kicks off loading the Curtain's brand fonts (see constants/qode-theme.ts)
 * but does NOT block rendering on them — RN falls back to the system font
 * for one frame if a screen renders before they're ready, then re-renders
 * once loaded. Blocking the whole app on this (returning null from the
 * root layout) broke static export for every route, not just the
 * Qode-styled ones, so it isn't worth it for a decorative heading font.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  usePlayfairFonts({ PlayfairDisplay_500Medium, PlayfairDisplay_700Bold });
  useLatoFonts({ Lato_400Regular, Lato_700Bold });

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
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
