import { Circle, Path, Polyline, Svg } from 'react-native-svg';

/**
 * Ported 1:1 from qode-oneview's src/components/review/MobileNav.tsx
 * (TAB_ICON) — same paths, same viewBox, redrawn with react-native-svg
 * instead of raw <svg>. "Standard glyphs only — a line chart, a donut,
 * layers, a list, dots — nothing invented," per that file's own comment;
 * this keeps that rule rather than picking a lookalike icon set.
 *
 * `filled` shifts stroke weight (and, where the shape has an interior,
 * adds a soft fill wash) on selection — the iOS convention of
 * outline -> filled/bold rather than only a color/tint change. Applied on
 * both platforms rather than forked per-platform: it's a good look on
 * Android too (Material's own outlined/filled icon pairing is the same
 * idea), and a single prop is a lot less code than maintaining a second,
 * SF-Symbols-only icon set for iOS alone.
 */

interface IconProps {
  color: string;
  size?: number;
  /** Selected state — thicker stroke, soft interior fill where the shape has one. */
  filled?: boolean;
}

export function PerformanceIcon({ color, size = 20, filled = false }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={filled ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 16 9 10 13 13 21 5" />
      <Polyline points="15 5 21 5 21 11" />
    </Svg>
  );
}

export function SegmentsIcon({ color, size = 20, filled = false }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={filled ? 2.5 : 1.8}>
      <Circle cx={12} cy={12} r={8.2} fill={filled ? color : 'none'} fillOpacity={filled ? 0.16 : 0} />
      <Path d="M12 3.8v8.2l6 5.4" />
    </Svg>
  );
}

export function MfXrayIcon({ color, size = 20, filled = false }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={filled ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3 3 8l9 5 9-5-9-5z" fill={filled ? color : 'none'} fillOpacity={filled ? 0.16 : 0} />
      <Path d="M3 13l9 5 9-5" />
    </Svg>
  );
}

export function HoldingsIcon({ color, size = 20, filled = false }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={filled ? 2.5 : 1.8} strokeLinecap="round">
      <Path d="M4 6h13M4 12h13M4 18h13" />
      <Circle cx={20} cy={6} r={filled ? 1.1 : 0.9} fill={color} stroke="none" />
      <Circle cx={20} cy={12} r={filled ? 1.1 : 0.9} fill={color} stroke="none" />
      <Circle cx={20} cy={18} r={filled ? 1.1 : 0.9} fill={color} stroke="none" />
    </Svg>
  );
}

export function MoreIcon({ color, size = 20, filled = false }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <Circle cx={5} cy={12} r={filled ? 2.1 : 1.8} />
      <Circle cx={12} cy={12} r={filled ? 2.1 : 1.8} />
      <Circle cx={19} cy={12} r={filled ? 2.1 : 1.8} />
    </Svg>
  );
}
