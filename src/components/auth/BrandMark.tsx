import { StyleSheet, Text, View } from 'react-native';
import { Circle, Defs, Path, RadialGradient, Stop, Svg } from 'react-native-svg';

import { QodeColor, QodeFont } from '@/constants/qode-theme';

/**
 * "The Aperture" — ported verbatim from qode-oneview's own
 * src/components/Brand.tsx (same viewBox, same four paths, same strategy
 * colors). A customer handed between the web app and this one should see
 * the same mark, not a lookalike redrawn for React Native.
 *
 * `glow` used to be a native `shadow*`/`elevation` style — that's a CSS
 * box-shadow on web (where it showed up fine) but on native it's two
 * different, unreliable APIs: `shadow*` is iOS-only and needs an opaque
 * shape to cast against (a transparent-background View casts little to
 * nothing), while Android's `elevation` draws its own grey/black drop
 * shadow, not a colored one, on most devices/RN versions — reported as
 * "glow shows on web, not on mobile" (15 Sep). Replaced with an SVG radial
 * gradient painted BEHIND the mark instead: `react-native-svg` renders the
 * same way on iOS, Android and web, so the halo now looks identical
 * everywhere rather than depending on a platform's shadow support.
 */
export function BrandMark({
  size = 30,
  showWordmark = true,
  glow = false,
}: {
  size?: number;
  showWordmark?: boolean;
  /** A soft gold halo behind the mark — the one "hero" placement gets it, list/header uses don't. */
  glow?: boolean;
}) {
  const haloSize = size * 3.4;

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { width: size, height: size }]}>
        {glow ? (
          <Svg
            width={haloSize}
            height={haloSize}
            viewBox="0 0 100 100"
            style={[styles.halo, { width: haloSize, height: haloSize, left: -(haloSize - size) / 2, top: -(haloSize - size) / 2 }]}
            pointerEvents="none">
            <Defs>
              <RadialGradient id="brandGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={QodeColor.gold} stopOpacity={0.5} />
                <Stop offset="55%" stopColor={QodeColor.gold} stopOpacity={0.16} />
                <Stop offset="100%" stopColor={QodeColor.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#brandGlow)" />
          </Svg>
        ) : null}
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
      {showWordmark ? <Text style={[styles.word, { fontSize: size * 0.6 }]}>OneView</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  word: {
    fontFamily: QodeFont.displayBold,
    color: QodeColor.cream,
    letterSpacing: -0.2,
  },
});
