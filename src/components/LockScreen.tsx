import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Path, Rect, Svg } from 'react-native-svg';

import { BrandMark } from '@/components/auth/BrandMark';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useAppLock } from '@/lib/app-lock';
import { useAuth } from '@/lib/auth';

function LockGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={QodeColor.accent} strokeWidth={1.8}>
      <Rect x={4.5} y={10.5} width={15} height={10} rx={2.5} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Covers the whole app while the app lock is engaged
 * (src/lib/app-lock.tsx). Prompts on its own as soon as it appears; the
 * button retries after a cancel. "Sign out" is the way out for someone who
 * can no longer pass the prompt — it removes the lock and the session, so
 * signing back in with an SMS code opens the app unlocked.
 */
export function LockScreen() {
  const { locked, pending, unlock, clearLock } = useAppLock();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  if (!locked && !pending) return null;

  return (
    <LinearGradient
      colors={[QodeColor.gradientStart, QodeColor.gradientEnd]}
      style={StyleSheet.absoluteFill}
      pointerEvents="auto">
      {locked ? (
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <BrandMark size={34} showWordmark={false} glow />
            <Text style={styles.title}>OneView is locked</Text>
            <Text style={styles.body}>Unlock to see your portfolio.</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              onPress={() => void unlock()}>
              <LockGlyph />
              <Text style={styles.primaryText}>Unlock</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}
              onPress={() => {
                setSigningOut(true);
                void clearLock()
                  .then(signOut)
                  .finally(() => {
                    setSigningOut(false);
                    router.replace('/login');
                  });
              }}>
              <Text style={styles.quietText}>{signingOut ? 'Signing out…' : 'Sign out instead'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: QodeSpace[5],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[3],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 24,
    color: QodeColor.cream,
    marginTop: QodeSpace[5],
    textAlign: 'center',
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 15,
    color: QodeColor.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: QodeSpace[2],
    paddingBottom: QodeSpace[5],
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[2],
    borderWidth: 1,
    borderColor: QodeColor.accentBorder,
    backgroundColor: QodeColor.accentSoft,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
  },
  pressed: {
    opacity: 0.85,
  },
  primaryText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.cream,
  },
  quiet: {
    alignItems: 'center',
    paddingVertical: QodeSpace[3],
  },
  quietText: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textMuted,
  },
});
