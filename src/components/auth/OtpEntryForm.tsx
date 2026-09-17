import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';

export type VerifyOutcome = { status: 'ok' } | { status: 'no-account' } | { status: 'wrong'; message?: string };

export interface OtpEntryFormProps {
  /** The phone number the code was sent to, for the masked headline. */
  phone: string;
  /**
   * Checks the code against qode-oneview's real `POST /api/auth/verify`
   * (see login.tsx) and resolves with the outcome — genuinely async now
   * that this is a real network call, not an instant local comparison.
   * `wrong.message` carries the server's own reason (expired challenge,
   * rate limit, attempts remaining) rather than a single generic string.
   */
  onSubmit: (code: string) => Promise<VerifyOutcome>;
  /**
   * Resets the flow to the phone step. Root Stack has `headerShown: false`
   * (see login.tsx), so there's no back button to correct a mistyped
   * number — this is the only way back short of leaving the app.
   */
  onChangeNumber: () => void;
  /** Called when the reader taps "Send another code" — login.tsx re-sends via the real API. */
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

// 30s, matching qode-oneview's real OtpResend.tsx cooldown. Cosmetic only on
// this side — the real gate is the server's own rate limit on
// `/api/auth/send` (3 per 15 minutes, fails closed); this just avoids an
// obviously-premature tap.
const RESEND_COOLDOWN_SECONDS = 30;
const BOX_COUNT = 6;

/**
 * Styled to match `PhoneEntryForm` — same field/button language. `onSubmit`
 * is a real network call now (qode-oneview's `POST /api/auth/verify`, see
 * login.tsx), so this shows a "Verifying…" state and disables input while
 * it's in flight — the old version was instant since it only compared
 * against a locally generated code, but a request over the network can
 * take a moment and a reader needs to see that something is happening.
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
export function OtpEntryForm({ phone, onSubmit, onChangeNumber, onResend }: OtpEntryFormProps) {
  const [otp, setOtp] = useState('');
  const [wrong, setWrong] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [focused, setFocused] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(code: string) {
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await onSubmit(code);
      if (result.status === 'wrong') {
        setWrong(true);
        setErrorMessage(result.message ?? null);
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
    } finally {
      setBusy(false);
    }
  }

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setWrong(false);
    // Sixth digit submits directly, matching the web form's onChange
    // handler — the reader shouldn't also have to find and tap "Sign in".
    if (digits.length === 6) void submit(digits);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enter the code sent to {maskPhone(phone)}</Text>
      <Text style={styles.changeNumber} onPress={onChangeNumber} accessibilityRole="button">
        Change number
      </Text>

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
              <Text style={styles.boxDigit} maxFontSizeMultiplier={1.6}>
                {otp[i] ?? ''}
              </Text>
            </View>
          );
        })}
        {/* The real input: invisible, sized over the boxes, still carrying
            the exact placeholder/value contract the tests query.
            `textContentType="oneTimeCode"` is what turns on iOS's own
            QuickType-bar code suggestion — zero-config, reads the incoming
            SMS as-is. `autoComplete="sms-otp"` is the Android equivalent —
            note NOT `"one-time-code"` (fixed 15 Sep): despite RN's own
            TypeScript types listing `"one-time-code"` as a "cross-platform"
            value, this RN version's actual Android bridge
            (ReactTextInputManager.kt's `REACT_PROPS_AUTOFILL_HINTS_MAP`)
            has no entry for it at all — an unrecognized value falls into
            that map's `else` branch, which explicitly sets
            `IMPORTANT_FOR_AUTOFILL_NO`, actively telling Android's Autofill
            Framework to ignore the field. That silently disabled Android
            autofill entirely regardless of device/keyboard settings, which
            is exactly why nothing ever appeared above the keyboard on
            Android testing. `"sms-otp"` is the one value that actually maps
            to `AUTOFILL_HINT_SMS_OTP` in that same file. Neither prop needs
            a native module or a qode-oneview change — this works standalone
            in Expo Go. Reliability is OS/keyboard-dependent; a more robust
            SMS User Consent-based upgrade was tried and rolled back (see
            MOBILE_BACKEND_CHANGES.md) since it needs a native module that
            can't run in Expo Go, and the priority right now is developing
            and testing inside Expo Go. */}
        <TextInput
          style={styles.hiddenInput}
          placeholder="······"
          placeholderTextColor="transparent"
          selectionColor="transparent"
          caretHidden
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          value={otp}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={6}
          editable={!busy}
          autoFocus
        />
      </Animated.View>

      {wrong ? (
        <Text style={styles.error}>{errorMessage ?? 'That code did not match. Check the SMS and try again.'}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={otp.length !== 6 || busy}
        android_ripple={{ color: QodeColor.greenDeep }}
        onPressIn={() => {
          Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPressOut={() => {
          Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPress={() => void submit(otp)}>
        <Animated.View
          style={[
            styles.button,
            (otp.length !== 6 || busy) && styles.buttonDisabled,
            { transform: [{ scale: buttonScale }] },
          ]}>
          <Text style={styles.buttonText}>{busy ? 'Verifying…' : 'Sign in'}</Text>
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
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    minHeight: 52,
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
