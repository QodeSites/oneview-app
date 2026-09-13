/**
 * "The Curtain" — Qode's design system, ported from
 * qode-oneview/src/theme/tokens.css and ui.css. Values are copied
 * verbatim, not reinterpreted — this file exists so the mobile app reads
 * the same brand as the web app, not a lookalike.
 *
 * Nothing outside this file should contain a raw color value for anything
 * Qode-branded. Where the web version uses CSS gradients/opacity math that
 * React Native can't do inline, the equivalent is precomputed below.
 *
 * Where gold is allowed (unchanged from tokens.css): the primary CTA on a
 * screen (one per screen), the user's own data series in a chart, flow
 * progress, and focus state. Everywhere else is cream or quiet.
 */

export const QodeColor = {
  green: '#02422B',
  greenDeep: '#002017',
  cream: '#EFECD3',
  gold: '#DABD38',

  qaw: '#008455',
  qgf: '#0A3452',
  qtf: '#550E0E',

  mint: '#4ADE80',
  coral: '#FF9A9A',
  orange: '#F7A860',
  sky: '#8FBEFF',

  background: '#002017',
  // React Native has no CSS linear-gradient shorthand; use with
  // expo-linear-gradient: colors=[QodeColor.gradientStart, QodeColor.gradientEnd]
  gradientStart: '#02422B',
  gradientEnd: '#002017',

  /** The mobile bottom nav's background, matching qode-oneview's --rail-bg. */
  railBg: 'rgba(0, 24, 17, 0.5)',

  surface: 'rgba(239, 236, 211, 0.055)',
  surfaceRaised: 'rgba(239, 236, 211, 0.1)',
  surfaceBorder: 'rgba(239, 236, 211, 0.14)',
  controlBorder: 'rgba(239, 236, 211, 0.45)',
  divider: 'rgba(239, 236, 211, 0.1)',

  textPrimary: '#EFECD3',
  textSecondary: 'rgba(239, 236, 211, 0.72)',
  textMuted: 'rgba(239, 236, 211, 0.65)',
  textOnAccent: '#002017',

  accent: '#DABD38',
  accentSoft: 'rgba(218, 189, 56, 0.14)',
  accentBorder: 'rgba(218, 189, 56, 0.4)',

  success: '#4ADE80',
  error: '#FF9A9A',
  warning: '#F7A860',
  info: '#8FBEFF',

  /** Chart series roles, matching qode-oneview's --series-* tokens exactly. */
  seriesClient: '#DABD38',
  seriesStrategy: '#4ADE80',
  seriesBenchmark: 'rgba(239, 236, 211, 0.55)',

  /** Cap-band identity colors, matching qode-oneview's --cap-* tokens. */
  capLarge: '#8FC48D',
  capMid: '#DABD38',
  capSmall: '#F7A860',
  capMicro: '#D4703F',
} as const;

/** Strategy donut colors, matching qode-oneview's STRATEGY_COLOR[code].stroke. */
export const StrategyColor: Record<'QAW' | 'QTF' | 'QGF', string> = {
  QAW: '#2FBF87',
  QTF: '#D06A63',
  QGF: '#6BA8DC',
};

export const CapBandColor: Record<'large' | 'mid' | 'small' | 'micro' | 'unclassified', string> = {
  large: QodeColor.capLarge,
  mid: QodeColor.capMid,
  small: QodeColor.capSmall,
  micro: QodeColor.capMicro,
  unclassified: QodeColor.textMuted,
};

export const QodeSpace = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const QodeRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/**
 * Font family names, matching the useFonts() keys loaded in the root
 * layout. Web falls back to Playfair Display / Inter / system fonts when a
 * face hasn't loaded yet (e.g. first paint); native waits for useFonts()
 * before rendering, per Expo's documented pattern.
 */
export const QodeFont = {
  display: 'PlayfairDisplay_500Medium',
  displayBold: 'PlayfairDisplay_700Bold',
  ui: 'Inter_600SemiBold',
  uiRegular: 'Inter_400Regular',
} as const;
