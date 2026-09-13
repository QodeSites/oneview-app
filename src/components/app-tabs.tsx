import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoldingsIcon, MfXrayIcon, MoreIcon, PerformanceIcon, SegmentsIcon } from './TabIcons';

import { QodeColor } from '@/constants/qode-theme';

/**
 * "Floating Pill" — picked from the four options reviewed as an artifact
 * (tab-bar-options.html) over the earlier full-width bar. Icons only, no
 * labels; the bar itself lifts off the screen edges into a rounded
 * capsule; the active tab gets a filled cream circle behind its icon
 * rather than a shared indicator sliding between cells. That last part
 * simplifies this file too — each cell now animates only itself, so there
 * is no cross-cell shared value to coordinate (contrast the old
 * `activeIndex` SharedValue threaded through every TabCell).
 *
 * `TAB_BAR_PILL_HEIGHT`/`FLOATING_MARGIN` are duplicated (as documented
 * constants, not an import) in `hooks/use-tab-bar-height.ts`, which every
 * tab screen uses to reserve enough bottom clearance — same relationship
 * that file's comment already had with this one's old chrome height.
 *
 * iOS: `GlassView` renders real Liquid Glass via UIVisualEffectView on iOS
 * 26+ and is a plain View everywhere else (confirmed in
 * expo-glass-effect's own source — GlassView.js is `<View {...props} />`
 * with no iOS-only guard needed here), so it's used unconditionally rather
 * than branched. Android gets its own flat rail-bg fallback color, since
 * the glass tint is iOS-only.
 */
const TABS = [
  { name: 'performance', href: '/performance', label: 'Performance', Icon: PerformanceIcon },
  { name: 'segments', href: '/segments', label: 'Segments', Icon: SegmentsIcon },
  { name: 'mf-xray', href: '/mf-xray', label: 'MF X-Ray', Icon: MfXrayIcon },
  { name: 'holdings', href: '/holdings', label: 'Holdings', Icon: HoldingsIcon },
  { name: 'more', href: '/more', label: 'More', Icon: MoreIcon },
] as const;

const FLOATING_MARGIN = 16;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BottomBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              {/* Icons only now — `label` still named on TABS (and passed
                  to TabTrigger's own `name`/accessibility wiring via
                  expo-router/ui) even though TabCell no longer renders
                  it visually; screen readers still get it. */}
              <TabCell Icon={tab.Icon} />
            </TabTrigger>
          ))}
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function TabCell({
  Icon,
  isFocused,
  onPress,
  ...props
}: TabTriggerSlotProps & {
  Icon: (p: { color: string; size?: number; filled?: boolean }) => React.JSX.Element;
}) {
  // Local to this cell — the old version needed a single SharedValue
  // shared across every cell to slide one indicator between them; a
  // circle that only ever appears behind ITS OWN icon has nothing to
  // coordinate with its siblings.
  const scale = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [isFocused, scale]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  // Dark icon ON the cream circle when active, matching the "selection is
  // cream, not gold" rule (gold stays reserved for the primary CTA, the
  // user's own chart line, progress, and focus — not tab selection).
  const color = isFocused ? QodeColor.greenDeep : QodeColor.textMuted;

  return (
    <Pressable
      {...props}
      onPress={(e) => {
        // Skip the tick for a re-tap of the already-active tab — nothing
        // changed, so nothing should buzz.
        if (!isFocused) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      android_ripple={{ color: QodeColor.surfaceRaised, borderless: true, radius: 26 }}
      style={styles.cell}>
      <Animated.View style={[styles.activeCircle, circleStyle]} />
      <Icon color={color} size={19} filled={isFocused} />
    </Pressable>
  );
}

function BottomBar({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={QodeColor.greenDeep}
      style={[styles.bar, Platform.OS !== 'ios' && styles.barFallback, { bottom: insets.bottom + FLOATING_MARGIN }]}>
      <View style={styles.row}>{children}</View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: FLOATING_MARGIN,
    right: FLOATING_MARGIN,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    // Android: a raised Material surface (elevation) rather than a
    // CSS-style shadow. iOS gets its separation from the glass effect
    // itself plus this same border.
    ...Platform.select({
      android: { elevation: 10 },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      default: {},
    }),
  },
  barFallback: {
    // GlassView is a plain View outside iOS — give it the flat rail
    // background the bar always had, since there's no glass tint to fall
    // back on.
    backgroundColor: QodeColor.railBg,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: QodeColor.cream,
  },
});
