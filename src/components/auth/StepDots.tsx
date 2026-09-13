import { StyleSheet, View } from 'react-native';

import { QodeColor } from '@/constants/qode-theme';

/**
 * A quiet progress affirmation for the sign-in funnel (phone -> code),
 * not a stepper anyone is meant to tap. Plain Views, no animation
 * library — this component sits directly above the phone field in
 * login.tsx, and the one real bug this screen hit traced back to
 * Reanimated/worklets misbehaving on-device, so the sign-in flow keeps
 * it out entirely rather than re-litigating which specific usage was
 * safe.
 */
export function StepDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 22,
    backgroundColor: QodeColor.accent,
  },
  dotInactive: {
    width: 4,
    backgroundColor: QodeColor.surfaceBorder,
  },
});
