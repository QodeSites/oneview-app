import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout — a bare Stack so non-tab screens (e.g. `login`) have an
 * outlet to render into. The (tabs) group supplies its own NativeTabs
 * layout (src/app/(tabs)/_layout.tsx); this Stack just hosts it as one
 * screen among siblings.
 *
 * Previously this returned <AppTabs /> directly, which left any route file
 * outside the tab set (like login.tsx) with nowhere to render — Expo's
 * static export produced byte-identical output for `/` and `/login`.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
