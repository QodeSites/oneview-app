import { StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { QodeColor, QodeFont } from '@/constants/qode-theme';

/**
 * "The Aperture" — ported verbatim from qode-oneview's own
 * src/components/Brand.tsx (same viewBox, same four paths, same strategy
 * colors). A customer handed between the web app and this one should see
 * the same mark, not a lookalike redrawn for React Native.
 */
export function BrandMark({
  size = 30,
  showWordmark = true,
  glow = false,
}: {
  size?: number;
  showWordmark?: boolean;
  /** A soft gold shadow behind the mark — the one "hero" placement gets it, list/header uses don't. */
  glow?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={glow ? styles.glow : undefined}>
        <Svg viewBox="0 0 120 120" width={size} height={size}>
          <Path
            d="M 34.277,21.864 A 46,46 0 0 1 85.723,21.864 L 73.980,39.274 A 25,25 0 0 0 46.020,39.274 Z"
            fill="#008455"
          />
          <Path
            d="M 98.136,34.277 A 46,46 0 0 1 98.136,85.723 L 80.726,73.980 A 25,25 0 0 0 80.726,46.020 Z"
            fill="#0A3452"
          />
          <Path
            d="M 85.723,98.136 A 46,46 0 0 1 34.277,98.136 L 46.020,80.726 A 25,25 0 0 0 73.980,80.726 Z"
            fill="#550E0E"
          />
          <Path
            d="M 21.864,85.723 A 46,46 0 0 1 21.864,34.277 L 39.274,46.020 A 25,25 0 0 0 39.274,73.980 Z"
            fill="#DABD38"
          />
        </Svg>
      </View>
      {showWordmark ? <Text style={[styles.word, { fontSize: size * 0.6 }]}>Qode OneView</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  glow: {
    shadowColor: QodeColor.gold,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  word: {
    fontFamily: QodeFont.displayBold,
    color: QodeColor.cream,
    letterSpacing: -0.2,
  },
});
