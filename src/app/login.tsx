import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
 * the real database and says whether the number has an account. Note this
 * means: qode-oneview's own `normalisePhone` only accepts a 10-digit Indian
 * mobile number, so PhoneEntryForm's worldwide country picker will get a
 * real "Enter a 10-digit Indian mobile number" error back from the server
 * for anywhere else — shown as-is (see `sendError` below) rather than
 * papered over, since that is a real, current constraint of the backend,
 * not a bug in this screen.
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
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function requestCode(p: string) {
    setSending(true);
    setSendError(null);
    try {
      const result = await sendOtp(p);
      if (result.ok) {
        setPhone(p);
        setStep('otp');
      } else {
        setSendError(result.error);
      }
    } finally {
      setSending(false);
    }
  }

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
   * A one-time "opening" flourish for the brand mark only — NOT a wrapper
   * around the form. An earlier version used Reanimated's `entering` layout
   * animation around the whole step (form included), which left the phone
   * field untappable: `entering`/`exiting` drive Fabric's layout-animation
   * snapshot machinery, which has known touch/focus interference with a
   * TextInput it hosts. Core RN `Animated` only ever writes opacity/transform
   * style props — no layout snapshotting, no touch interception — so it's
   * safe to use even here, but it's still kept off the interactive blocks
   * on principle: the door should never be the thing animating in.
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
          keyboardShouldPersistTaps="handled">
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

            {/* Step content below is deliberately NOT wrapped in an entrance
                animation — see the comment on heroAnim above. */}
            {step === 'phone' ? (
              <View style={styles.stepBlock}>
                <Text style={styles.title}>Sign in to OneView</Text>
                <Text style={styles.subtitle}>
                  Everything you linked — stocks, funds, deposits and your bank — read back to you in one place.
                </Text>
                <PhoneEntryForm onSubmit={requestCode} busy={sending} />
                {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
                <Text style={styles.helper}>
                  We send a one-time code to your phone. It&apos;s the same number you used when you linked your
                  accounts.
                </Text>

                <TrustBadges />
              </View>
            ) : null}

            {step === 'otp' ? (
              <View style={styles.stepBlock}>
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
              </View>
            ) : null}

            {step === 'no-account' ? (
              <View style={styles.stepBlock}>
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
              </View>
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
