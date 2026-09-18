import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/auth/BrandMark';
import { StepDots } from '@/components/auth/StepDots';
import { PreviewCard } from '@/components/welcome/PreviewCard';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { markWelcomeSeen } from '@/lib/welcome';

/** One page per review card; `card` indexes PreviewCard's chapters. */
const PAGES: { card: number; eyebrow: string; title: string; body: string }[] = [
  {
    card: 0,
    eyebrow: 'ONEVIEW',
    title: 'See what your portfolio is really doing.',
    body: 'Connect your investments and get a personalised review of your performance, allocation and risk.',
  },
  {
    card: 1,
    eyebrow: 'WHERE THE GAP IS',
    title: 'Same money. A very different story.',
    body: 'What your money grew to, against the market and Qode strategies over the same period.',
  },
  {
    card: 2,
    eyebrow: 'ALLOCATION BY MARKET CAP',
    title: 'See where your risk really sits.',
    body: 'Your large, mid and small cap split, side by side with the matching Qode strategy and its index.',
  },
];

/**
 * First-run welcome — three swipeable pages, each with one of the web
 * sign-in page's review cards (components/welcome/PreviewCard.tsx), shown
 * once per device before sign-in (index.tsx decides). "Skip" and "Get
 * started" both mark it seen and go to sign-in.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  // Counts arrivals on each page. The page in view is keyed by its count,
  // so its card remounts and builds again on every visit; the others sit
  // unbuilt, ready to build when they arrive.
  const [visits, setVisits] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const last = index === PAGES.length - 1;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  function show(i: number) {
    if (i === index) return;
    setIndex(i);
    setVisits((v) => v + 1);
  }

  function finish() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void markWelcomeSeen();
    router.replace('/login');
  }

  function next() {
    if (last) return finish();
    Haptics.selectionAsync().catch(() => {});
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    show(index + 1);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    show(Math.min(Math.max(i, 0), PAGES.length - 1));
  }

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <BrandMark size={24} />
          {!last ? (
            <Pressable accessibilityRole="button" onPress={finish} hitSlop={12}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.container}>
          {PAGES.map((page, i) => (
            // Each page scrolls on its own, so a short phone or large
            // text never cuts the card off.
            <ScrollView
              key={page.title}
              style={{ width }}
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}>
              <View style={styles.pageInner}>
                <Text style={styles.eyebrow}>{page.eyebrow}</Text>
                <Text style={styles.title} maxFontSizeMultiplier={1.4}>
                  {page.title}
                </Text>
                <Text style={styles.body}>{page.body}</Text>
                <View style={styles.cardWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <PreviewCard
                    key={i === index ? `play-${visits}` : 'idle'}
                    index={page.card}
                    playing={i === index}
                    still={reduceMotion}
                  />
                </View>
              </View>
            </ScrollView>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <StepDots count={PAGES.length} activeIndex={index} />
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={next}>
            <Text style={styles.primaryText}>{last ? 'Get started' : 'Next'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
    minHeight: 44,
  },
  skip: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textMuted,
  },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: QodeSpace[5],
    paddingVertical: QodeSpace[4],
  },
  pageInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: QodeSpace[2],
  },
  eyebrow: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    letterSpacing: 1.5,
    color: QodeColor.gold,
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 26,
    lineHeight: 31,
    color: QodeColor.cream,
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: QodeColor.textSecondary,
  },
  cardWrap: {
    marginTop: QodeSpace[3],
  },
  footer: {
    paddingHorizontal: QodeSpace[5],
    paddingBottom: QodeSpace[4],
    paddingTop: QodeSpace[2],
    gap: QodeSpace[4],
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  primary: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  primaryText: {
    fontFamily: QodeFont.ui,
    fontSize: 16,
    color: QodeColor.textOnAccent,
  },
});
