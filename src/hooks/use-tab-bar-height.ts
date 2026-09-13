import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The floating pill bar's own visual height (app-tabs.tsx's `row`
 * paddingVertical*2 + `cell` height), NOT counting the device's bottom
 * safe-area inset or the margin the pill floats above it.
 */
const TAB_BAR_PILL_HEIGHT = 64;

/**
 * The gap between the pill's bottom edge and the safe-area inset below
 * it (app-tabs.tsx's `FLOATING_MARGIN` — duplicated here as a documented
 * constant, not an import, same relationship this file already had with
 * the bar's chrome height before it became a floating pill).
 */
const TAB_BAR_FLOATING_MARGIN = 16;

/**
 * How much bottom clearance a tab screen needs to reserve so its last
 * row/card doesn't sit underneath the floating bar (app-tabs.tsx's
 * `BottomBar` is `position: absolute`, overlaying screen content rather
 * than sharing the flex layout with it).
 *
 * Reads the real per-device safe-area inset via `useSafeAreaInsets`
 * rather than baking in a fixed guess — a phone with a tall home-
 * indicator/gesture-bar inset needs more clearance than one without, and
 * a flat constant can't track that.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_PILL_HEIGHT + TAB_BAR_FLOATING_MARGIN + insets.bottom;
}
