import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/auth/BrandMark';
import { OtpEntryForm, type VerifyOutcome } from '@/components/auth/OtpEntryForm';
import { PhoneEntryForm } from '@/components/auth/PhoneEntryForm';
import { StepDots } from '@/components/auth/StepDots';
import { TrustBadges } from '@/components/auth/TrustBadges';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { sendOtp, verifyOtp } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'phone' | 'otp' | 'no-account';

/**
 * Screen 1 — sign in, matching qode-oneview's LoginForm.tsx state machine
 * (`step: "phone" | "otp"`, plus a `noAccount` flag): phone → OTP → tabs,
 * with a "no account" branch.
 *
 * Real qode-oneview backend now (src/lib/api.ts) — `POST /api/auth/send`
 * genuinely texts a code via 2Factor, `/verify` genuinely checks it against
 * the real database and says whether the number has an account.
 * qode-oneview's own `normalisePhone` only accepts a 10-digit Indian mobile
 * number, which is why PhoneEntryForm takes only that, with no country code.
 *
 * The brand mark, step dots and trust badges are chrome around that same
 * state machine — see qode-oneview's own login page (src/app/login/
 * page.tsx there) for the desktop sibling of this pitch-then-door layout,
 * condensed here into one scrollable column with the door (the form)
 * first, since a phone screen has no room for two columns and the ask is
 * the reason for the visit.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const { signIn, signInDemo } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // When the real rate limit is hit, `sendUntil` is the wall-clock moment
  // (ms) it actually lifts — from the server's own `retryAfterSeconds`,
  // not a guess. Without this, "Too many requests" had no way to know
  // when it stopped being true, and just sat on screen forever even once
  // the real window had long since passed (reported 16 Sep).
  const [sendCooldownUntil, setSendCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  async function requestCode(p: string) {
    setSending(true);
    setSendError(null);
    setSendCooldownUntil(null);
    try {
      const result = await sendOtp(p);
      if (result.ok) {
        setPhone(p);
        setStep('otp');
      } else {
        setSendError(result.error);
        if (result.retryAfterSeconds) {
          setNow(Date.now());
          setSendCooldownUntil(Date.now() + result.retryAfterSeconds * 1000);
        }
      }
    } finally {
      setSending(false);
    }
  }

  // Ticks once a second only while a cooldown is actually running, and
  // clears both the countdown and the stale error the instant it reaches
  // zero — the fix for "the error doesn't go off after some time." Every
  // `setState` here runs inside the timer's own callback, never
  // synchronously in the effect body itself — the callback IS "calling
  // setState in a callback function when external state changes," exactly
  // the shape React's own docs ask for, as opposed to a setState call
  // sitting directly in the effect body (which the compiler flags, and
  // which this deliberately avoids rather than adding to this file's own
  // one already-tolerated, pre-existing finding on a different effect).
  useEffect(() => {
    if (sendCooldownUntil === null) return;
    const delay = Math.min(Math.max(sendCooldownUntil - now, 0), 1000);
    const id = setTimeout(() => {
      const current = Date.now();
      if (current >= sendCooldownUntil) {
        setSendCooldownUntil(null);
        setSendError(null);
      } else {
        setNow(current);
      }
    }, delay);
    return () => clearTimeout(id);
  }, [sendCooldownUntil, now]);

  const cooldownLabel = (() => {
    if (sendCooldownUntil === null) return null;
    const remaining = Math.max(0, Math.ceil((sendCooldownUntil - now) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `Try again in ${m}:${String(s).padStart(2, '0')}`;
  })();

  /**
   * Captured once, not subscribed to resize — this is what lets the
   * screen center vertically without the keyboard fighting it. A plain
   * `justifyContent: 'center'` re-centers around whatever height the
   * container currently has, so when the keyboard opens (or Android's
   * adjustResize shrinks the window) the content jumps to re-center
   * around the smaller box. Centering against a height taken once, before
   * any keyboard exists, means that box never changes size, so there's
   * nothing to jump.
   */
  const [screenHeight] = useState(() => Dimensions.get('window').height);

  /**
   * The "opening" flourish — the brand mark pops in with a spring, then the
   * step's own content (title, subtitle, form, badges) cascades in half a
   * beat behind it as one block, matching the layered "everything coming
   * up" entrance the web login has. Re-runs on every `step` change too, so
   * OTP/no-account each get their own entrance rather than only the very
   * first paint.
   *
   * Both are core RN `Animated`, not Reanimated — deliberately. An earlier
   * version used Reanimated's `entering` layout animation around the whole
   * step (form included), which left the phone field untappable:
   * `entering`/`exiting` drive Fabric's layout-animation snapshot
   * machinery, which has known touch/focus interference with a TextInput it
   * hosts. Core `Animated` only ever writes opacity/transform style props —
   * no layout snapshotting, no touch interception, and a partially-faded
   * view is still fully tappable the instant it renders — so it's safe to
   * wrap the content block in too, not just the mark.
   */
  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 120,
      mass: 0.6,
    }).start();
  }, [heroAnim]);

  const contentAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 420,
      delay: 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, contentAnim]);

  const contentAnimatedStyle = {
    opacity: contentAnim,
    transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };

  /**
   * Android's hardware/gesture back button otherwise pops the OS's own
   * navigation stack — and since login is the entry screen (nothing was
   * pushed to get here from `/`, see index.tsx's <Redirect>), there is
   * nothing under it to pop TO, so back closed the whole app. That's the
   * wrong behaviour mid-flow: from the OTP or no-account step, back
   * should return to the phone step, same as "Change number"/"Try a
   * different number" already do, and only fall through to the OS
   * default (exit) once already back at the phone step itself.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'phone') return false;
      setStep('phone');
      setPhone('');
      return true;
    });
    return () => sub.remove();
  }, [step]);

  async function verify(code: string): Promise<VerifyOutcome> {
    const result = await verifyOtp(code);
    if (result.status === 'wrong') return result;
    if (!result.registered) {
      setStep('no-account');
      return { status: 'no-account' };
    }
    // Fire-and-forget: this is the app's own local "am I signed in"
    // flag (src/lib/auth.tsx), separate from the real session cookie
    // `/api/auth/verify` just set — the write has no reason to block
    // the navigation that follows it.
    void signIn(phone);
    router.replace('/performance');
    return { status: 'ok' };
  }

  const stepIndex = step === 'phone' ? 0 : 1;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { minHeight: screenHeight }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
            <Animated.View
              style={[
                styles.hero,
                {
                  opacity: heroAnim,
                  transform: [
                    { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
                    { scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                  ],
                },
              ]}>
              <BrandMark size={30} glow />
              {step !== 'no-account' ? <StepDots count={2} activeIndex={stepIndex} /> : null}
            </Animated.View>

            {step === 'phone' ? (
              <Animated.View style={[styles.stepBlock, contentAnimatedStyle]}>
                <Text style={styles.title}>Sign in to OneView</Text>
                <Text style={styles.subtitle}>
                  Everything you linked — stocks, funds, deposits and your bank — read back to you in one place.
                </Text>
                {/* Set by auth.tsx's automatic sign-out (session-events.ts)
                    when a 401 means the real server session is gone even
                    though this device still thought it was signed in —
                    without this, a reader landing back here with no
                    explanation would read it as the app randomly signing
                    them out. */}
                {expired ? (
                  <Text style={styles.expiredNotice}>Your session expired. Sign in again to continue.</Text>
                ) : null}
                <PhoneEntryForm onSubmit={requestCode} busy={sending} cooldownLabel={cooldownLabel} />
                {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
                <Text style={styles.helper}>
                  We send a one-time code to your phone. It&apos;s the same number you used when you linked your
                  accounts.
                </Text>

                <TrustBadges />

                {__DEV__ ? (
                  <>
                    <Pressable
                      style={styles.demoLink}
                      onPress={() => {
                        void signInDemo().then(() => router.replace('/performance'));
                      }}>
                      <Text style={styles.demoLinkText}>View demo (populated dummy account, dev only)</Text>
                    </Pressable>
                    {/* The slides only show once per device, so testing them
                        again in Expo Go otherwise means clearing its storage. */}
                    <Pressable style={styles.demoLink} onPress={() => router.push('/welcome')}>
                      <Text style={styles.demoLinkText}>View welcome slides (dev only)</Text>
                    </Pressable>
                  </>
                ) : null}
              </Animated.View>
            ) : null}

            {step === 'otp' ? (
              <Animated.View style={[styles.stepBlock, contentAnimatedStyle]}>
                <Text style={styles.title}>Verify it&apos;s you</Text>
                <OtpEntryForm
                  phone={phone}
                  onSubmit={verify}
                  onResend={() => void requestCode(phone)}
                  onChangeNumber={() => {
                    setStep('phone');
                    setPhone('');
                  }}
                />
              </Animated.View>
            ) : null}

            {step === 'no-account' ? (
              <Animated.View style={[styles.stepBlock, contentAnimatedStyle]}>
                <Text style={styles.title}>Almost there</Text>
                <Text style={styles.noAccountLede}>
                  That number checks out, but there is no OneView account behind it yet.
                </Text>
                <Text style={styles.noAccountBody}>
                  If you filled the form on qodeinvest.com, try the number you used there. Otherwise you can set one
                  up now — it takes a name, your PAN and a couple of minutes.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push({ pathname: '/register', params: { phone } });
                  }}>
                  <Text style={styles.createButtonText}>Create an account</Text>
                </Pressable>
                <Pressable
                  style={styles.quietButton}
                  onPress={() => {
                    setStep('phone');
                    setPhone('');
                  }}>
                  <Text style={styles.quietButtonText}>Try a different number</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: QodeSpace[5],
    paddingVertical: QodeSpace[6],
  },
  safe: {
    gap: QodeSpace[6],
  },
  hero: {
    alignItems: 'center',
    gap: QodeSpace[4],
  },
  stepBlock: {
    gap: QodeSpace[4],
  },
  error: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.error,
    textAlign: 'center',
    marginTop: -QodeSpace[2],
  },
  expiredNotice: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.warning,
    textAlign: 'center',
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 26,
    lineHeight: 32,
    color: QodeColor.cream,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 15,
    lineHeight: 21,
    color: QodeColor.textMuted,
    textAlign: 'center',
    marginTop: -QodeSpace[2],
  },
  helper: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textMuted,
    textAlign: 'center',
  },
  demoLink: {
    alignItems: 'center',
    paddingVertical: QodeSpace[2],
  },
  demoLinkText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textMuted,
    textDecorationLine: 'underline',
  },
  noAccountLede: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textPrimary,
    textAlign: 'center',
  },
  noAccountBody: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textMuted,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createButtonText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textOnAccent,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  quietButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  quietButtonText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
});
