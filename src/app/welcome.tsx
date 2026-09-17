import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
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
import { WelcomeArt, type WelcomeArtKind } from '@/components/welcome/WelcomeArt';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { markWelcomeSeen } from '@/lib/welcome';

interface Slide {
  art: WelcomeArtKind;
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    art: 'accounts',
    eyebrow: 'WELCOME TO QODE ONEVIEW',
    title: 'All your wealth, in one view',
    body: 'Stocks, mutual funds, ETFs and bank balances from every account you hold — read together, in one place.',
  },
  {
    art: 'link',
    eyebrow: 'SAFE BY DESIGN',
    title: 'Link once. Read-only.',
    body: "Connect your accounts through the RBI's Account Aggregator framework. It's consent-based and read-only — we can never move your money, and you can withdraw consent at any time.",
  },
  {
    art: 'insight',
    eyebrow: 'UNDERSTAND WHAT YOU OWN',
    title: 'See how your portfolio really works',
    body: 'Your performance against the market, your large, mid and small cap mix, and what your mutual funds actually hold.',
  },
  {
    art: 'plan',
    eyebrow: 'A PLAN THAT FITS YOU',
    title: 'Get a strategy made for you',
    body: 'Answer six questions for a Qode strategy recommendation, and download your full portfolio review as a PDF.',
  },
];

/**
 * First-run welcome — four swipeable slides explaining what OneView is,
 * shown once per device before sign-in (index.tsx decides). "Skip" and
 * "Get started" both mark it seen and go to sign-in.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  // Scales with the shorter side, capped so tablets don't get a giant drawing.
  const artSize = Math.min(Math.min(width, height) * 0.58, 280);

  function finish() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void markWelcomeSeen();
    router.replace('/login');
  }

  function next() {
    if (last) return finish();
    Haptics.selectionAsync().catch(() => {});
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(i, 0), SLIDES.length - 1));
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
          {SLIDES.map((slide) => (
            <ScrollView
              key={slide.title}
              style={{ width }}
              contentContainerStyle={styles.slide}
              showsVerticalScrollIndicator={false}>
              <View style={styles.slideInner}>
                <WelcomeArt kind={slide.art} size={artSize} />
                <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
              </View>
            </ScrollView>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <StepDots count={SLIDES.length} activeIndex={index} />
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
  slide: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: QodeSpace[5],
    paddingVertical: QodeSpace[5],
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: QodeSpace[3],
  },
  eyebrow: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    letterSpacing: 1.4,
    color: QodeColor.accent,
    marginTop: QodeSpace[5],
    textAlign: 'center',
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    lineHeight: 34,
    color: QodeColor.cream,
    textAlign: 'center',
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 16,
    lineHeight: 23,
    color: QodeColor.textSecondary,
    textAlign: 'center',
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
