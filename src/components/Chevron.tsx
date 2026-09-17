import { StyleSheet, View } from 'react-native';

import { QodeColor, QodeSpace } from '@/constants/qode-theme';

/**
 * A drawn chevron (two bordered edges of a square, rotated), not a text
 * glyph or a bigger copy of the same Unicode triangle — a hollow "v"/"^"
 * outline reads as a clearer, more deliberate expand affordance than an
 * enlarged filled triangle, and doesn't depend on how any given device's
 * font renders a small glyph. Rotates the same way web's own caret does:
 * 90° from pointing right (collapsed) to pointing down (open).
 *
 * Shared by Performance's cap-band legend and MF X-Ray's fund cards — both
 * are tap-to-expand rows where web leans on hover/cursor affordances this
 * app has no touch equivalent for, so both needed the same fix
 * independently (Performance: reported 16 Sep, too small to notice; MF
 * X-Ray: reported 16 Sep, no acknowledgement at all that a fund card is
 * tappable). Extracted here once MF X-Ray needed the identical drawing a
 * second time, rather than a second inline copy.
 */
export function Chevron({ open }: { open: boolean }) {
  return <View style={[styles.chevron, open && styles.chevronOpen]} />;
}

const styles = StyleSheet.create({
  // Gold, not muted grey — this is a tap target, and the app's own
  // convention reserves gold for exactly that (focus/actionable elements).
  chevron: {
    width: 9,
    height: 9,
    marginLeft: QodeSpace[1],
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: QodeColor.accent,
    transform: [{ rotate: '-45deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '45deg' }],
  },
});
