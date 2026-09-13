import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QodeColor, QodeFont, QodeSpace } from '@/constants/qode-theme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

export interface ScreenPlaceholderProps {
  title: string;
  note: string;
}

/**
 * Shared shell for a tab screen whose real data source isn't built yet
 * (see SPEC-mobile-dashboard.md — these need new backend endpoints that
 * don't exist). Deliberately shows an explanation, not fake numbers or an
 * empty chart frame — the same "undefined is null, never 0" principle
 * qode-oneview's own README states for this exact situation.
 */
export function ScreenPlaceholder({ title, note }: ScreenPlaceholderProps) {
  const tabBarHeight = useTabBarHeight();

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      {/* `edges={['top']}` — the explicit paddingBottom below already
          covers the bottom inset (useTabBarHeight includes it), so the
          default all-edges SafeAreaView would double it. */}
      <SafeAreaView style={[styles.safeArea, { paddingBottom: tabBarHeight + QodeSpace[3] }]} edges={['top']}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <Text style={styles.note}>{note}</Text>
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
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[6],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    color: QodeColor.cream,
    marginBottom: QodeSpace[5],
  },
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: 16,
    padding: QodeSpace[5],
  },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    lineHeight: 21,
    color: QodeColor.textMuted,
  },
});
