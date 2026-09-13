import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';

export interface OtpEntryFormProps {
  /** The phone number the code was sent to, for the masked headline. */
  phone: string;
  /** Checks the code against the mock/eventual backend and returns the outcome synchronously. */
  onSubmit: (code: string) => 'ok' | 'no-account' | 'wrong';
  /**
   * Resets the flow to the phone step. Root Stack has `headerShown: false`
   * (see login.tsx), so there's no back button to correct a mistyped
   * number — this is the only way back short of leaving the app.
   */
  onChangeNumber: () => void;
  /**
   * The code login.tsx actually generated for this phone, shown directly
   * on screen rather than delivered by SMS — there is no SMS provider
   * wired up yet (that needs a backend + provider credentials, well
   * beyond this screen), so this is the honest stand-in: a real generated
   * code, real comparison against what's typed, just not sent over the
   * air yet. Undefined hides the banner entirely, for a future caller
   * that does have real delivery.
   */
  devCode?: string;
  /** Called when the reader taps "Send another code" — login.tsx generates a fresh code and updates `devCode`. */
  onResend?: () => void;
}

/**
 * International-friendly masking: keeps the first two and last two digits
 * visible (a leading "+" survives untouched) and masks whatever's between
 * — the same shape qode-oneview's own 10-digit Indian mask uses
 * (`98XXXXXX06`), generalized to any length rather than assuming 10
 * digits, since Qode's customers dial in from outside India too.
 */
function maskPhone(value: string): string {
  const hasPlus = value.trim().startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (digits.length < 5) return value;
  const visible = 2;
  const hidden = 'X'.repeat(Math.max(digits.length - visible * 2, 0));
  const masked = `${digits.slice(0, visible)}${hidden}${digits.slice(-visible)}`;
  return hasPlus ? `+${masked}` : masked;
}

// 30s, matching qode-oneview's real OtpResend.tsx cooldown. Tapping "Send
// another code" resets this timer AND calls onResend, which has
// login.tsx generate a fresh code (see devCode). The real version also
// gates resending against POST /api/auth/send's own rate limit (3 per 15
// minutes, fails closed) — that belongs in login.tsx once /api/auth/*
// exists, not invented here.
const RESEND_COOLDOWN_SECONDS = 30;
const BOX_COUNT = 6;

/**
 * Styled to match `PhoneEntryForm` — same field/button language. `onSubmit`
 * is synchronous (no fetch, no simulated delay) to match login.tsx's own
 * mock verify(), which resolves 'ok' | 'no-account' | 'wrong' in place —
 * the eventual `POST /api/auth/verify` call belongs in login.tsx, not here,
 * same division of responsibility PhoneEntryForm already has.
 *
 * The 6 boxes are a purely visual read of `otp` — the real capture surface
 * is still one `TextInput` (kept, transparent, on top of them) with the
 * exact placeholder/value/maxLength OtpEntryForm.test.tsx already asserts
 * on, so the segmented look doesn't cost the tested contract.
 *
 * Animation here is core RN `Animated`, not Reanimated — deliberately.
 * This screen only has one job, and the one substantive layout bug this
 * app hit (an untappable phone field) traced back to Reanimated/worklets
 * misbehaving on-device while looking fine in Jest and on web, so it's
 * kept off the sign-in flow entirely rather than debugged component by
 * component.
 */
export function OtpEntryForm({ phone, onSubmit, onChangeNumber, devCode, onResend }: OtpEntryFormProps) {
  const [otp, setOtp] = useState('');
  const [wrong, setWrong] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [focused, setFocused] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function submit(code: string) {
    const result = onSubmit(code);
    if (result === 'wrong') {
      setWrong(true);
      setOtp('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shakeX.setValue(0);
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -8, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 90, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 90, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    // 'ok' / 'no-account': login.tsx switches step or navigates itself.
  }

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setWrong(false);
    // Sixth digit submits directly, matching the web form's onChange
    // handler — the reader shouldn't also have to find and tap "Sign in".
    if (digits.length === 6) submit(digits);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enter the code sent to {maskPhone(phone)}</Text>
      <Text style={styles.changeNumber} onPress={onChangeNumber} accessibilityRole="button">
        Change number
      </Text>

      {devCode ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            No SMS provider connected yet — your code is <Text style={styles.devBannerCode}>{devCode}</Text>
          </Text>
        </View>
      ) : null}

      <Animated.View style={[styles.boxRow, { transform: [{ translateX: shakeX }] }]}>
        {Array.from({ length: BOX_COUNT }).map((_, i) => {
          const filled = i < otp.length;
          const isNext = i === otp.length && focused;
          return (
            <View
              key={i}
              style={[
                styles.box,
                filled && styles.boxFilled,
                isNext && styles.boxActive,
                wrong && styles.boxWrong,
              ]}>
              <Text style={styles.boxDigit}>{otp[i] ?? ''}</Text>
            </View>
          );
        })}
        {/* The real input: invisible, sized over the boxes, still carrying
            the exact placeholder/value contract the tests query. */}
        <TextInput
          style={styles.hiddenInput}
          placeholder="······"
          placeholderTextColor="transparent"
          selectionColor="transparent"
          caretHidden
          keyboardType="number-pad"
          value={otp}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={6}
          autoFocus
        />
      </Animated.View>

      {wrong ? <Text style={styles.error}>That code doesn’t match. Check the SMS and try again.</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={otp.length !== 6}
        android_ripple={{ color: QodeColor.greenDeep }}
        onPressIn={() => {
          Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPressOut={() => {
          Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPress={() => submit(otp)}>
        <Animated.View
          style={[
            styles.button,
            otp.length !== 6 && styles.buttonDisabled,
            { transform: [{ scale: buttonScale }] },
          ]}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Animated.View>
      </Pressable>

      <Text style={styles.resendNote}>
        {cooldown > 0 ? (
          <>Didn&apos;t get it? You can ask for another in {cooldown}s.</>
        ) : (
          <>
            Didn&apos;t get it?{' '}
            <Text
              style={styles.resendLink}
              onPress={() => {
                setCooldown(RESEND_COOLDOWN_SECONDS);
                onResend?.();
              }}
              accessibilityRole="button">
              Send another code
            </Text>
          </>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: QodeSpace[2],
  },
  label: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  changeNumber: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.accent,
    textDecorationLine: 'underline',
    marginBottom: QodeSpace[2],
  },
  devBanner: {
    backgroundColor: QodeColor.warning + '22',
    borderWidth: 1,
    borderColor: QodeColor.warning,
    borderRadius: QodeRadius.md,
    paddingHorizontal: QodeSpace[3],
    paddingVertical: QodeSpace[2],
  },
  devBannerText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: QodeColor.textSecondary,
  },
  devBannerCode: {
    fontFamily: QodeFont.ui,
    color: QodeColor.warning,
    letterSpacing: 1,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    height: 52,
    borderRadius: QodeRadius.md,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    backgroundColor: QodeColor.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: QodeColor.accentBorder,
    backgroundColor: QodeColor.surfaceRaised,
  },
  boxActive: {
    borderColor: QodeColor.accent,
  },
  boxWrong: {
    borderColor: QodeColor.error,
  },
  boxDigit: {
    fontFamily: QodeFont.ui,
    fontSize: 22,
    color: QodeColor.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 22,
  },
  error: {
    fontFamily: QodeFont.uiRegular,
    color: QodeColor.error,
    fontSize: 13,
  },
  button: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: QodeFont.ui,
    color: QodeColor.textOnAccent,
    fontSize: 15,
  },
  resendNote: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: QodeColor.textMuted,
    textAlign: 'center',
    marginTop: QodeSpace[2],
  },
  resendLink: {
    color: QodeColor.accent,
    textDecorationLine: 'underline',
  },
});
