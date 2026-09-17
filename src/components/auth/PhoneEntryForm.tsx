import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';

export interface PhoneEntryFormProps {
  /** Called with the full number, "+91" attached (e.g. "+919876543210"), on a valid submit. */
  onSubmit: (phone: string) => void;
  /** True while the parent is "sending" the code — disables the field and button, swaps the label. */
  busy?: boolean;
  /** Set while the OTP-send rate limit is active (e.g. "Try again in 4:32") —
   * disables the button and replaces its label, same as `busy` but for a
   * cooldown instead of an in-flight request. The rate limit is actually
   * per-phone-number server-side, but this disables the button regardless
   * of what's currently typed — switching to a different number during an
   * active cooldown still has to wait it out, a deliberate simplification
   * rather than plumbing "does the typed number match the limited one"
   * through here for a case that's rare in practice. */
  cooldownLabel?: string | null;
}

/**
 * Indian mobile numbers only, typed without a country code (17 Sep, at the
 * product owner's request — the country picker is gone). qode-oneview's
 * backend (src/lib/otp.ts) only accepts a 10-digit Indian mobile starting
 * 6-9, so this enforces the same rule and attaches "+91" on submit.
 */
const PHONE_LENGTH = 10;

function normaliseLocalNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/**
 * Styled to match qode-oneview's `.field` / `.btn.btn--primary` (see
 * src/components/ui.css there) — same colors, spacing and radius, ported
 * rather than reinvented. Gold is the primary CTA here because this is
 * the one action on this screen, per the Curtain's own rule for where
 * gold is allowed.
 */
export function PhoneEntryForm({ onSubmit, busy = false, cooldownLabel = null }: PhoneEntryFormProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const localDigits = normaliseLocalNumber(value);
  const isValid = localDigits !== null;
  const showError = value.length > 0 && !isValid;
  const disabled = !isValid || busy || !!cooldownLabel;

  /**
   * Core RN `Animated`, not Reanimated — deliberately (see OtpEntryForm's
   * own comment on why). Proven safe throughout this screen's rebuild;
   * kept to that one library rather than reaching for a second.
   */
  const buttonScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder="Phone number"
        placeholderTextColor={QodeColor.textMuted}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={value}
        // Filtered as it's typed, not just validated after the fact — a
        // pasted or hardware-keyboard-typed letter should never sit in a
        // phone field even for a moment.
        onChangeText={(v) => setValue(v.replace(/\D/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={PHONE_LENGTH}
        editable={!busy}
      />
      {showError ? <Text style={styles.error}>Enter a valid {PHONE_LENGTH}-digit phone number.</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        android_ripple={{ color: QodeColor.greenDeep }}
        onPressIn={() => {
          Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPressOut={() => {
          Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
        }}
        onPress={() => {
          if (!localDigits) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onSubmit(`+91${localDigits}`);
        }}>
        <Animated.View
          style={[styles.button, disabled && styles.buttonDisabled, { transform: [{ scale: buttonScale }] }]}>
          <Text style={styles.buttonText}>{cooldownLabel ?? (busy ? 'Sending…' : 'Send code')}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: QodeSpace[4],
  },
  input: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: QodeFont.uiRegular,
    fontSize: 16,
    color: QodeColor.textPrimary,
  },
  inputFocused: {
    borderColor: QodeColor.accent,
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
});
