import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoldingsIcon, MfXrayIcon, MoreIcon, PerformanceIcon, SegmentsIcon } from './TabIcons';
import { AnalysisBuilding, BuildingReview } from './BuildingReview';
import { ErrorView, LoadingView } from './RemoteStateView';
import { NothingYet } from './NothingYet';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useAuth } from '@/lib/auth';
import { isDemoActive } from '@/lib/demo';
import { getReview, type ReviewPayload } from '@/lib/reviewApi';

/**
 * "Floating Pill" — picked from the four options reviewed as an artifact
 * (tab-bar-options.html) over the earlier full-width bar. Icons only, no
 * labels; the bar itself lifts off the screen edges into a rounded
 * capsule; the active tab is marked by a single cream circle that GLIDES
 * between cells — a plain `withTiming` translateX, no spring/bounce —
 * rather than each cell independently popping its own circle in and out
 * (that per-cell spring read as "bubbling"; asked to replace it, 15 Sep).
 * `activeIndex` comes from `usePathname()` matched against `TABS`, since
 * `expo-router/ui`'s `TabTrigger` only tells an individual cell whether
 * IT is focused, not the bar as a whole which index that is.
 *
 * `TAB_BAR_PILL_HEIGHT`/`FLOATING_MARGIN` are duplicated (as documented
 * constants, not an import) in `hooks/use-tab-bar-height.ts`, which every
 * tab screen uses to reserve enough bottom clearance — same relationship
 * that file's comment already had with this one's old chrome height.
 *
 * `GlassView` renders real Liquid Glass on iOS 26+ and is a plain View on
 * Android, so it's used unconditionally. Anywhere Liquid Glass isn't
 * available (Android, or an iPhone on iOS 25 or earlier) the bar gets the
 * flat rail-bg color instead — see `HAS_LIQUID_GLASS`.
 */
const TABS = [
  { name: 'performance', href: '/performance', label: 'Performance', Icon: PerformanceIcon },
  { name: 'segments', href: '/segments', label: 'Segments', Icon: SegmentsIcon },
  { name: 'mf-xray', href: '/mf-xray', label: 'MF X-Ray', Icon: MfXrayIcon },
  { name: 'holdings', href: '/holdings', label: 'Holdings', Icon: HoldingsIcon },
  { name: 'more', href: '/more', label: 'More', Icon: MoreIcon },
] as const;

const FLOATING_MARGIN = 16;

// Liquid Glass only exists on iOS 26+. Older iPhones (and Android) get the
// flat rail color instead of a see-through bar.
const HAS_LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

const WAIT_POLL_MS = 4000;

export default function AppTabs() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.href === pathname),
  );

  // Each cell's real, measured `{x, y, width, height}` relative to `row` —
  // NOT assumed from `rowWidth / TABS.length` (horizontal) or a `top: '50%'`
  // + negative-margin centering trick (vertical). Both assumptions broke on
  // real devices: `cell` is `flex: 1`, which only guarantees equal width
  // once every cell has actually laid out and doesn't account for Yoga's
  // own per-cell pixel rounding (reported 15 Sep, fixed for X only); the
  // percentage trick assumes `top: '50%'` resolves against the same box
  // `cell`'s own height is centered within, which doesn't hold up against
  // `GlassView`'s real Liquid Glass rendering (left the circle visibly
  // above the icon it's meant to sit behind — reported same day). Measuring
  // the ACTUAL cell in both axes is the only way to guarantee the circle
  // lands exactly where that cell's icon actually is, full stop.
  const cellLayoutsRef = useRef<({ x: number; y: number; width: number; height: number } | null)[]>(
    TABS.map(() => null),
  );
  const [layoutVersion, setLayoutVersion] = useState(0);

  // One presence check, shared by the gate below and the tab bar. The tabs
  // only appear once the account's data has actually loaded; until then
  // (loading, error, nothing linked, still fetching) the reader sees a
  // single full screen with no way into the other tabs or Profile.
  const review = useRemoteData(getReview);
  const ready = review.state.status === 'ready' ? review.state.data : null;
  // Still waiting on the aggregator, or on the first analysis.
  const waiting = ready !== null && (ready.building !== null || ready.analysis?.building === true);
  const showTabs = ready !== null && !ready.presence.isEmpty && ready.analysis?.building !== true;

  // Web's wait screen re-checks every 4 seconds; the hook's own 30s re-check
  // is too slow for a build that finishes in a couple of minutes.
  const { revalidate } = review;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(revalidate, WAIT_POLL_MS);
    return () => clearInterval(id);
  }, [waiting, revalidate]);

  return (
    <Tabs>
      <TabsGate review={review} />
      <TabList asChild>
        <BottomBar
          activeIndex={activeIndex}
          cellLayoutsRef={cellLayoutsRef}
          layoutVersion={layoutVersion}
          hidden={!showTabs}>
          {TABS.map((tab, index) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              {/* Icons only now — `label` still named on TABS (and passed
                  to TabTrigger's own `name`/accessibility wiring via
                  expo-router/ui) even though TabCell no longer renders
                  it visually; screen readers still get it. */}
              <TabCell
                Icon={tab.Icon}
                onMeasure={(x, y, width, height) => {
                  cellLayoutsRef.current[index] = { x, y, width, height };
                  setLayoutVersion((v) => v + 1);
                }}
              />
            </TabTrigger>
          ))}
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

/**
 * Gates the four dashboard tabs (Performance/Segments/MF X-Ray/Holdings)
 * behind the same three-way check qode-oneview's own `/review` layout makes
 * before rendering any of them, off `GET /api/mobile/review`'s `presence`/
 * `building` fields:
 *
 *   not empty                    → the real tabs
 *   empty, consent still fetching → `BuildingReview` (a wait screen)
 *   empty, otherwise              → `NothingYet` (never linked, or linked
 *                                    and genuinely found nothing)
 *
 * Collapsing the middle case into `NothingYet` (as an earlier version of
 * this gate did) showed its `hasConsent: true` branch — "your accounts
 * reported no holdings, link another account" — to someone whose data
 * simply hadn't arrived yet, a real claim about their (still unknown)
 * holdings rather than an honest "still waiting" (reported 15 Sep). Without
 * any of this gate, a never-linked customer instead saw all four tabs
 * rendered against zeros (a donut with no slices, "₹0" in the hero, empty
 * tables) with no explanation at all — the original failure mode qode-
 * oneview's own `NothingYet`/`BuildingReview` exist to prevent on web (see
 * each file's own comment).
 *
 * Every tab is gated, More included, and the tab bar is hidden while
 * gated (16 Sep, at the product owner's request): nothing but the link
 * option — or a spinner while loading — until the account's data has
 * loaded. Because More (and its Sign out) is unreachable here, every gate
 * screen carries its own "Sign out" so no one is trapped.
 *
 * A failed presence check shows an error with a retry instead of falling
 * through to the tabs, for the same reason: no dashboard until the data
 * is known to be there.
 */
function TabsGate({ review }: { review: ReturnType<typeof useRemoteData<ReviewPayload>> }) {
  const { state, refreshing, refresh, reload } = review;
  const insets = useSafeAreaInsets();

  if (state.status === 'loading') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }}>
        <LoadingView />
      </LinearGradient>
    );
  }

  if (state.status === 'error') {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ErrorView message={state.message} onRetry={reload} />
          <GateSignOut />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (state.data.presence.isEmpty) {
    // A consent that exists but hasn't delivered yet is mid-fetch, not
    // "never linked" — showing NothingYet's `hasConsent: true` branch there
    // ("your accounts reported no holdings, link another account") was the
    // wrong claim for someone whose data simply hasn't arrived (reported
    // 15 Sep). Check this BEFORE NothingYet, matching the order qode-
    // oneview's own layout checks them in.
    //
    // Both branches below are wrapped in a real `ScrollView`+`RefreshControl`
    // now — `BuildingReview.tsx`'s own copy ("Pull down to check again")
    // and its own doc comment both always assumed this gate would supply
    // that, but it never actually did; the content just sat in a plain
    // `View` with nothing to pull (reported 16 Sep, alongside the `/more`
    // dead-end above — the two were found together).
    if (state.data.building) {
      return (
        <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.gateScroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
            <BuildingReview building={state.data.building} />
            <GateSignOut />
          </ScrollView>
        </LinearGradient>
      );
    }
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.gateScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
          <NothingYet presence={state.data.presence} />
          <GateSignOut />
        </ScrollView>
      </LinearGradient>
    );
  }

  // Holdings are in but the first analysis isn't finished — same gate as
  // web's layout. Showing the tabs now meant the allocation donut beside
  // empty charts and zero fund values (reported 17 Sep).
  if (state.data.analysis?.building) {
    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.gateScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={QodeColor.accent} />}>
          <AnalysisBuilding analysis={state.data.analysis} />
          <GateSignOut />
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TabSlot style={{ height: '100%' }} />
      {isDemoActive() ? (
        <View style={[styles.demoBadge, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={styles.demoBadgeText}>Demo data</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The gate screens' own way out — More (and its Sign out) is hidden here. */
function GateSignOut() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView edges={['bottom']} style={styles.gateSignOutWrap}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        hitSlop={12}
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => router.replace('/login'));
        }}>
        <Text style={styles.gateSignOut}>{busy ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function TabCell({
  Icon,
  isFocused,
  onPress,
  onMeasure,
  ...props
}: TabTriggerSlotProps & {
  Icon: (p: { color: string; size?: number; filled?: boolean }) => React.JSX.Element;
  onMeasure: (x: number, y: number, width: number, height: number) => void;
}) {
  // No animation of its own anymore — the cream circle marking the active
  // tab is a single shared indicator owned by `BottomBar` now, which glides
  // between cells instead of each one popping its own in and out. This
  // cell only has to pick its icon color and report its own real position.
  const color = isFocused ? QodeColor.greenDeep : QodeColor.textMuted;

  return (
    <Pressable
      {...props}
      onLayout={(e: LayoutChangeEvent) => {
        const { x, y, width, height } = e.nativeEvent.layout;
        onMeasure(x, y, width, height);
      }}
      onPress={(e) => {
        // Skip the tick for a re-tap of the already-active tab — nothing
        // changed, so nothing should buzz.
        if (!isFocused) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      android_ripple={{ color: QodeColor.surfaceRaised, borderless: true, radius: 26 }}
      style={styles.cell}>
      <Icon color={color} size={19} filled={isFocused} />
    </Pressable>
  );
}

const INDICATOR_SIZE = 40;
const GLIDE_DURATION = 260;

function BottomBar({
  children,
  activeIndex,
  cellLayoutsRef,
  layoutVersion,
  hidden,
}: {
  children?: React.ReactNode;
  activeIndex: number;
  cellLayoutsRef: React.RefObject<({ x: number; y: number; width: number; height: number } | null)[]>;
  layoutVersion: number;
  /** Hidden with `display: 'none'` rather than unmounted: the `TabTrigger`s
   * inside must stay mounted for expo-router/ui to keep the tab routes. */
  hidden: boolean;
}) {
  const insets = useSafeAreaInsets();
  const indicatorX = useSharedValue(0);
  const indicatorY = useSharedValue(0);
  const hasMeasured = useRef(false);

  // The only place `indicatorX`/`indicatorY` are ever written — first
  // measurement snaps straight to the right spot (no glide-in from 0);
  // every change after that glides horizontally (a plain ease-out
  // `withTiming`, not a spring — a spring's settle-and-wobble is the
  // "bubbling" this replaces). Vertical never animates: every cell is the
  // same height, so the circle's Y is set once and never needs to move
  // again — animating it would just be movement with nothing to explain it.
  // Re-runs on `layoutVersion` too, not just `activeIndex` — the active
  // cell's own measurement can arrive after this effect already ran once
  // (layout is async), and a stale target would leave the circle wherever
  // it first guessed instead of where the active cell actually is.
  useEffect(() => {
    const layout = cellLayoutsRef.current[activeIndex];
    if (!layout) return;
    const targetX = layout.x + (layout.width - INDICATOR_SIZE) / 2;
    const targetY = layout.y + (layout.height - INDICATOR_SIZE) / 2;
    indicatorY.value = targetY;
    if (!hasMeasured.current) {
      indicatorX.value = targetX;
      hasMeasured.current = true;
    } else {
      indicatorX.value = withTiming(targetX, { duration: GLIDE_DURATION, easing: Easing.out(Easing.cubic) });
    }
  }, [activeIndex, layoutVersion, cellLayoutsRef, indicatorX, indicatorY]);

  // Built entirely inside the worklet, deliberately not `style={[styles
  // .activeCircle, indicatorStyle]}` (reanimated's own docs show that array
  // form as the normal pattern). Reported twice (16 Sep) as reanimated's
  // "shared value's .value inside inline style" warning firing on every
  // tab switch, even though re-checking every `useSharedValue`/
  // `useAnimatedStyle` in this app's own source turned up no other place
  // that reads one — this is the only real usage, and the read genuinely
  // only ever happens inside this worklet. Folding the static circle
  // styling into the object this worklet returns removes the "static
  // StyleSheet id + animated style" array shape that several open
  // react-native-reanimated issues report as a false-positive trigger for
  // this exact warning on 3.x/4.x. Not confirmed against a device — if the
  // warning persists after this, it isn't coming from this component.
  const indicatorStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: QodeColor.cream,
    transform: [{ translateX: indicatorX.value }, { translateY: indicatorY.value }],
  }));

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={QodeColor.greenDeep}
      style={[
        styles.bar,
        !HAS_LIQUID_GLASS && styles.barFallback,
        { bottom: insets.bottom + FLOATING_MARGIN },
        hidden && styles.barHidden,
      ]}>
      <View style={styles.row}>
        <Animated.View pointerEvents="none" style={indicatorStyle} />
        {children}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  // `flexGrow`, not `flex` — a `ScrollView`'s `contentContainerStyle` needs
  // the content to be ABLE to grow to fill the viewport (so NothingYet's/
  // BuildingReview's own `justifyContent: 'center'` still centers them
  // vertically when short) while still allowing an actual pull gesture to
  // register, which a fixed `flex: 1` on the content container can starve.
  gateScroll: {
    flexGrow: 1,
  },
  gateSignOutWrap: {
    alignItems: 'center',
    paddingVertical: QodeSpace[5],
  },
  gateSignOut: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textMuted,
    textDecorationLine: 'underline',
  },
  barHidden: {
    display: 'none',
  },
  demoBadge: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: QodeColor.warning,
    borderRadius: QodeRadius.pill,
    paddingHorizontal: QodeSpace[3],
    paddingVertical: 4,
  },
  demoBadgeText: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    color: QodeColor.greenDeep,
    letterSpacing: 0.4,
  },
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
    // Wherever Liquid Glass isn't available (Android, iOS before 26),
    // give the bar the flat rail background, since there's no glass tint.
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
});
