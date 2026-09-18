import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';

/** Shared loading/error states for every screen reading `useRemoteData` (src/hooks/use-remote-data.ts). */
export function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={QodeColor.accent} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style — this one covers
  // every screen's "Try again" button at once, since ErrorView is shared.
  pressed: {
    opacity: 0.85,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[4],
    paddingHorizontal: QodeSpace[5],
  },
  message: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textSecondary,
    textAlign: 'center',
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
});
