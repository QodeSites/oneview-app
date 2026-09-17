import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useAuth } from '@/lib/auth';
import { getProfileData } from '@/lib/reviewApi';

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
  const profile = useRemoteData(getProfileData);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      {/* `edges={['top']}` — the sign-out bar below already reserves the
          bottom inset (as part of useTabBarHeight). */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
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
              <Pressable accessibilityRole="button" onPress={profile.reload} hitSlop={8}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
