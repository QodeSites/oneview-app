import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { Circle, Polyline, Svg } from 'react-native-svg';

/**
 * Build-in motion for the welcome cards: charts that draw themselves,
 * a donut that fills slice by slice, bars that grow and figures that
 * count up.
 *
 * Everything plays once, from empty, when its card mounts with
 * `playing` set. The welcome screen remounts a card each time its page
 * comes into view, so the build replays on every visit. `still` (Reduce
 * Motion) shows everything finished. Core `Animated` only: the native
 * driver for views, the JS driver for SVG props, which it can't drive
 * natively.
 */

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

const PlayContext = createContext({ playing: false, still: false });

export function PlayProvider({ playing, still, children }: { playing: boolean; still: boolean; children: ReactNode }) {
  return <PlayContext.Provider value={{ playing, still }}>{children}</PlayContext.Provider>;
}

/** 0 → 1 over `duration` once the card is playing. */
function useProgress(duration: number, delay: number, native: boolean) {
  const { playing, still } = useContext(PlayContext);
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) {
      value.setValue(1);
      return;
    }
    if (!playing) return;
    const anim = Animated.timing(value, {
      toValue: 1,
      duration,
      delay,
      easing: EASE_OUT,
      useNativeDriver: native,
    });
    anim.start();
    return () => anim.stop();
  }, [playing, still, value, duration, delay, native]);
  return value;
}

/** Fades and lifts its children in. */
export function FadeIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const p = useProgress(500, delay, true);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  return <Animated.View style={[style, { opacity: p, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** A bar that grows from its left edge. */
export function GrowX({ delay = 0, duration = 900, style }: { delay?: number; duration?: number; style: StyleProp<ViewStyle> }) {
  const p = useProgress(duration, delay, true);
  const scaleX = p.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] });
  return <Animated.View style={[style, { transformOrigin: 'left center', transform: [{ scaleX }] }]} />;
}

/* -- Counting figures -------------------------------------------------- */

const NUMBER = /^([+−₹]*)([\d,]+)(\.\d+)?(%?)$/;

/** Indian digit grouping: 7,03,679. */
function groupIN(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
}

export function formatLike(target: string, t: number): string {
  const m = NUMBER.exec(target);
  if (!m) return target;
  const [, prefix, whole, fraction = '', suffix] = m;
  const decimals = Math.max(fraction.length - 1, 0);
  const full = Number(whole.replace(/,/g, '') + fraction);
  const now = full * t;
  const fixed = now.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const intText = whole.includes(',') ? groupIN(Number(int)) : int;
  return `${prefix}${intText}${dec !== undefined ? `.${dec}` : ''}${suffix}`;
}

/**
 * A figure that counts up from zero to `value`, keeping its sign, ₹, commas
 * and decimals. Text that isn't a plain figure ("7 Sept 2026") shows as is.
 */
export function CountUp({
  value,
  delay = 0,
  duration = 1100,
  TextComponent,
  ...textProps
}: TextProps & {
  value: string;
  delay?: number;
  duration?: number;
  TextComponent: (props: TextProps) => ReactNode;
}) {
  const { playing, still } = useContext(PlayContext);
  const [t, setT] = useState(0);
  const counts = NUMBER.test(value);

  useEffect(() => {
    if (!playing || still || !counts) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const raw = Math.min(Math.max((now - start) / duration, 0), 1);
      // Ease out cubic: fast at first, settling on the figure.
      setT(1 - (1 - raw) ** 3);
      if (raw < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, still, counts, delay, duration]);

  const shown = !counts || still ? value : formatLike(value, t);
  return <TextComponent {...textProps}>{shown}</TextComponent>;
}

/* -- SVG --------------------------------------------------------------- */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

function pathLength(points: [number, number][]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return length;
}

/** A polyline that draws itself from its first point to its last. */
export function DrawLine({
  points,
  stroke,
  strokeWidth,
  delay = 0,
  duration = 1500,
}: {
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
  delay?: number;
  duration?: number;
}) {
  const p = useProgress(duration, delay, false);
  const length = pathLength(points);
  // The gap is longer than the line, so an undrawn line shows nothing at all.
  const offset = p.interpolate({ inputRange: [0, 1], outputRange: [length + 1, 0] });
  return (
    <AnimatedPolyline
      points={points.map(([x, y]) => `${x},${y}`).join(' ')}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={`${length} ${length + 2}`}
      strokeDashoffset={offset}
    />
  );
}

/** The "live" end of a line: a dot that appears once it's drawn, with a pulsing halo. */
export function PulseDot({ cx, cy, color, delay = 0 }: { cx: number; cy: number; color: string; delay?: number }) {
  const { playing, still } = useContext(PlayContext);
  const appear = useProgress(300, delay, false);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!playing || still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: EASE_IN_OUT, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
        Animated.delay(500),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [playing, still, pulse, delay]);

  return (
    <>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={pulse.interpolate({ inputRange: [0, 1], outputRange: [3.5, 11] })}
        fill={color}
        // Hidden until the dot itself has appeared.
        opacity={Animated.multiply(appear, pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }))}
      />
      <AnimatedCircle cx={cx} cy={cy} r={3.5} fill={color} opacity={appear} />
    </>
  );
}

/** A donut whose slices fill in order, clockwise from 12 o'clock. */
export function GrowingDonut({
  size,
  thickness,
  slices,
  delay = 0,
  duration = 1300,
  trackColor,
}: {
  size: number;
  thickness: number;
  slices: { label: string; percent: number; color: string }[];
  delay?: number;
  duration?: number;
  trackColor: string;
}) {
  const p = useProgress(duration, delay, false);
  const spin = useProgress(duration, delay, true);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.percent, 0) || 1;
  const c = size / 2;

  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((a, x) => a + x.percent, 0);
    const start = before / total;
    const end = (before + s.percent) / total;
    const length = Math.max((s.percent / total) * circ - 1.5, 1);
    return { ...s, start, end, length };
  });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
        {arcs.map((a) => (
          <AnimatedCircle
            key={a.label}
            cx={c}
            cy={c}
            r={r}
            stroke={a.color}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${a.length} ${circ}`}
            strokeDashoffset={p.interpolate({
              inputRange: [a.start, a.end],
              outputRange: [a.length, 0],
              extrapolate: 'clamp',
            })}
            rotation={-90 + a.start * 360}
            origin={`${c}, ${c}`}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

