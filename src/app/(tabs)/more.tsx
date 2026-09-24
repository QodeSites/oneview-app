import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useAppLock } from '@/lib/app-lock';
import { installedVersion } from '@/lib/app-update';
import { useAuth } from '@/lib/auth';
import { getProfileData } from '@/lib/reviewApi';
import { resetWelcomeSeen } from '@/lib/welcome';

/** Taps on the version number, within `VERSION_TAP_WINDOW_MS` of each other, that reset the welcome screens. */
const VERSION_TAP_COUNT = 7;
const VERSION_TAP_WINDOW_MS = 2500;

// More is only reachable once the account is linked and its data has loaded
// (see app-tabs.tsx's gate), so linking isn't offered here; "Upload
// holdings" fills in any accounts the linking didn't bring in.
const ITEMS = [
  { href: '/upload-statement' as const, label: 'Upload holdings' },
  { href: '/reports' as const, label: 'Reports' },
  { href: '/risk-profile' as const, label: 'Risk Profile' },
  { href: '/profile' as const, label: 'Profile' },
];

/**
 * Secondary destinations — the four data tabs stay in the bar, everything
 * else lives here. The reader's own details ("Your details", shared with
 * the Profile screen) sit at the top; Sign out is pinned to the bottom,
 * just above the tab bar, rather than trailing the list.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const tabBarHeight = useTabBarHeight();
  // Each tab reopens at its own top — see the hook.
  const scrollRef = useScrollToTopOnFocus();
  const profile = useRemoteData(getProfileData);
  const [signingOut, setSigningOut] = useState(false);

  // The welcome-seen flag lives in SecureStore, which on iOS is
  // Keychain-backed and survives an app uninstall/reinstall by design —
  // a real customer's fresh device never has it set, but a TESTER'S
  // device does, from their last install, so the welcome screens can't
  // be re-tested just by reinstalling (reported 18 Sep). This is that
  // escape hatch: tap the version number seven times, quickly, to clear
  // it and sign out, landing back on the welcome screens next launch.
  const versionTapsRef = useRef<number[]>([]);
  function onVersionTap() {
    const now = Date.now();
    const taps = versionTapsRef.current.filter((t) => now - t < VERSION_TAP_WINDOW_MS);
    taps.push(now);
    versionTapsRef.current = taps;
    if (taps.length < VERSION_TAP_COUNT) return;
    versionTapsRef.current = [];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void Promise.all([resetWelcomeSeen(), signOut()]).then(() => {
      // '/', not '/login' directly — index.tsx re-reads the (now cleared)
      // session and welcome flag and redirects to /welcome itself, so
      // this shows the actual screens right away instead of just
      // promising they will next launch.
      router.replace('/');
    });
  }

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      {/* `edges={['top']}` — the sign-out bar below already reserves the
          bottom inset (as part of useTabBarHeight). */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={profile.refreshing} onRefresh={profile.refresh} tintColor={QodeColor.accent} />
          }>
          <Text style={styles.title}>More</Text>

          {profile.state.status === 'loading' ? (
            <View style={[styles.detailsPlaceholder, styles.centered]}>
              <ActivityIndicator color={QodeColor.accent} />
            </View>
          ) : profile.state.status === 'error' ? (
            <View style={styles.detailsPlaceholder}>
              <Text style={styles.placeholderText}>Couldn&apos;t load your details. {profile.state.message}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={profile.reload}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.placeholderAction}>Try again</Text>
              </Pressable>
            </View>
          ) : profile.state.data ? (
            <ProfileDetailsCard profile={profile.state.data} />
          ) : (
            <View style={styles.detailsPlaceholder}>
              <Text style={styles.placeholderText}>No details on file yet.</Text>
            </View>
          )}

          <SecuritySection />

          <View style={styles.list}>
            {ITEMS.map((item, i) => (
              <MoreRow key={item.href} href={item.href} label={item.label} divider={i > 0} />
            ))}
          </View>
          {installedVersion() ? (
            <Pressable onPress={onVersionTap} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.version}>Version {installedVersion()}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.signOutBar, { paddingBottom: tabBarHeight + QodeSpace[3] }]}>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            style={({ pressed }) => [
              styles.signOutButton,
              (pressed || signingOut) && styles.signOutButtonPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setSigningOut(true);
              // Wait for the stored session to be cleared before leaving,
              // so a quick sign-in straight after can't be undone by this
              // sign-out still finishing in the background.
              void signOut().finally(() => router.replace('/login'));
            }}>
            <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * One row in the destinations list. Pressed state is tracked by hand
 * (`useState` + `onPressIn`/`onPressOut`) rather than `Pressable`'s own
 * `style={(state) => ...}` form, deliberately: `Link`'s `asChild` clones
 * this via a Slot, which merges an incoming `style` by concatenating it
 * into an array — fine for a plain object, but a FUNCTION landed in that
 * array as one of its entries, and React Native's style resolution
 * doesn't know what to do with a function inside a style array, so the
 * entire style silently failed to apply (no row layout, no padding, no
 * divider — reported 18 Sep, immediately after adding the pressed-state
 * feedback this replaces). Same fix as this comment used to warn about
 * for an ARRAY style on a Slot child — a function has the identical
 * problem, just not spelled out there yet. This keeps `style` a plain,
 * already-flattened object, which Slot's array-merge handles correctly.
 */
function MoreRow({ href, label, divider }: { href: Href; label: string; divider: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([styles.row, divider && styles.rowDivider, pressed && styles.pressed])}>
        {/* `rowText` (flex: 1) — SecuritySection's own row below already
            wraps its label the same way so its Switch never gets pushed
            out; this row used to put the label straight in as the flex
            row's other child, unshrinking, so a narrow phone or a larger
            system text size overflowed the row and the chevron was
            clipped by `list`'s own `overflow: hidden` (also reported 18
            Sep, separately from the style-function bug above). */}
        <View style={styles.rowText}>
          <Text style={styles.rowLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
        </View>
        <Text style={styles.chevron} maxFontSizeMultiplier={1.3}>
          ›
        </Text>
      </Pressable>
    </Link>
  );
}

/**
 * App lock (src/lib/app-lock.tsx) — fingerprint, face or phone PIN. Hidden on devices
 * with no enrolled biometrics — unless the lock is already on, so it can
 * always be turned back off.
 */
function SecuritySection() {
  const { support, enabled, setEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);

  if (!support || (!support.available && !enabled)) return null;

  return (
    <View style={styles.list}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>App lock</Text>
          <Text style={styles.rowHint}>Use your fingerprint, face or phone PIN to open the app.</Text>
        </View>
        <Switch
          accessibilityLabel="App lock"
          value={enabled}
          disabled={busy}
          trackColor={{ false: QodeColor.surfaceRaised, true: QodeColor.accent }}
          thumbColor={QodeColor.cream}
          ios_backgroundColor={QodeColor.surfaceRaised}
          onValueChange={(value) => {
            setBusy(true);
            void setEnabled(value)
              .then((ok) => {
                if (ok) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                } else if (value && !support.available) {
                  Alert.alert(
                    'Screen lock not set up',
                    "Add a fingerprint or face unlock in your phone's settings first.",
                  );
                }
              })
              .finally(() => setBusy(false));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[6],
    paddingBottom: QodeSpace[4],
    gap: QodeSpace[4],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    color: QodeColor.cream,
    marginBottom: QodeSpace[1],
  },
  detailsPlaceholder: {
    minHeight: 96,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
    gap: QodeSpace[2],
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  placeholderAction: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.accent,
  },
  list: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: QodeSpace[4],
    paddingHorizontal: QodeSpace[5],
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingRight: QodeSpace[3],
  },
  rowHint: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
  },
  version: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.faint,
    textAlign: 'center',
  },
  rowLabel: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 16,
    color: QodeColor.textPrimary,
  },
  chevron: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 18,
    color: QodeColor.textMuted,
  },
  signOutBar: {
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
  },
  signOutButton: {
    backgroundColor: QodeColor.error,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signOutButtonPressed: {
    opacity: 0.85,
  },
  signOutText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.greenDeep,
  },
});
