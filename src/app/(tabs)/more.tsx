import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useAuth } from '@/lib/auth';

const ITEMS = [
  { href: '/link' as const, label: 'Link accounts' },
  { href: '/reports' as const, label: 'Reports' },
  { href: '/risk-profile' as const, label: 'Risk Profile' },
  { href: '/profile' as const, label: 'Profile' },
];

// Secondary destinations, matching the "More" sheet in the build guide's
// own navigation map: 4 tabs stay permanently visible, everything else —
// Reports, Risk Profile, Profile — lives here.
export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const tabBarHeight = useTabBarHeight();

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      {/* `edges={['top']}`, not the default all-edges — the explicit
          paddingBottom below already covers the bottom inset (as part of
          useTabBarHeight), so letting SafeAreaView ALSO add it would
          double the bottom gap. */}
      <SafeAreaView style={[styles.safeArea, { paddingBottom: tabBarHeight + QodeSpace[3] }]} edges={['top']}>
        <Text style={styles.title}>More</Text>
        <View style={styles.list}>
          {ITEMS.map((item, i) => (
            <Link key={item.href} href={item.href} asChild>
              {/* Link's asChild clones this via a Slot, which needs a
                  flattened style object — an array style here throws
                  "[expo-router]: You are passing an array of styles to a
                  child of <Slot>." */}
              <Pressable style={StyleSheet.flatten([styles.row, i > 0 && styles.rowDivider])}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            void signOut();
            router.replace('/login');
          }}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[6],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    color: QodeColor.cream,
    marginBottom: QodeSpace[5],
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
  signOutButton: {
    backgroundColor: QodeColor.error,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: QodeSpace[5],
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
