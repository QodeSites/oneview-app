import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CountryCodePicker, DEFAULT_COUNTRY } from '@/components/auth/CountryCodePicker';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { phoneLengthFor, type Country } from '@/data/countries';

export interface PhoneEntryFormProps {
  /** Called with the full, normalized international number (e.g. "+14155550132") on a valid submit. */
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
 * The country code is picked separately (CountryCodePicker), so this only
 * validates the national number typed alongside it — against the
 * SELECTED country's own numbering plan (`phoneLengthFor`), not one
 * flat worldwide rule. A generic "4 to 12 digits, any country" let a
 * 6-digit number through with India selected, which is simply wrong: a
 * real Indian mobile number is 10 digits, always.
 *
 * India additionally gets the real leading-digit rule (6-9) — the same
 * one qode-oneview's own backend enforces (src/lib/otp.ts) — since it's
 * both cheap and the one country most of Qode's customers are actually
 * in; other countries stay length-only rather than encoding every
 * numbering plan's mobile-prefix quirks.
 */
function normaliseLocalNumber(raw: string, country: Country): string | null {
  const digits = raw.replace(/\D/g, '');
  const [min, max] = phoneLengthFor(country.iso2);
  if (digits.length < min || digits.length > max) return null;
  if (country.iso2 === 'IN' && !/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

/**
 * Styled to match qode-oneview's `.field` / `.btn.btn--primary` (see
 * src/components/ui.css there) — same colors, spacing and radius, ported
 * rather than reinvented. Gold is the primary CTA here because this is
 * the one action on this screen, per the Curtain's own rule for where
 * gold is allowed.
 */
export function PhoneEntryForm({ onSubmit, busy = false, cooldownLabel = null }: PhoneEntryFormProps) {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [minLength, maxLength] = phoneLengthFor(country.iso2);
  const localDigits = normaliseLocalNumber(value, country);
  const isValid = localDigits !== null;
  const showError = value.length > 0 && !isValid;
  const disabled = !isValid || busy || !!cooldownLabel;
  const lengthHint = minLength === maxLength ? `${minLength}-digit` : `${minLength}-${maxLength} digit`;

  /**
   * Core RN `Animated`, not Reanimated — deliberately (see OtpEntryForm's
   * own comment on why). Proven safe throughout this screen's rebuild;
   * kept to that one library rather than reaching for a second.
   */
  const buttonScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <CountryCodePicker
          value={country}
          onChange={(c) => {
            setCountry(c);
            // A number valid for the old country is almost never valid
            // for the new one (different length, different rules) — start
            // clean rather than leave a stale, silently-wrong value sitting
            // in the field, or truncate it against the new max length.
            setValue('');
          }}
        />
        <TextInput
          style={[styles.input, focused && styles.inputFocused]}
          placeholder="Phone number"
          placeholderTextColor={QodeColor.textMuted}
          keyboardType="phone-pad"
          autoComplete="tel"
          value={value}
          // Filtered as it's typed, not just validated after the fact —
          // a pasted or hardware-keyboard-typed letter should never sit
          // in a phone field even for a moment.
          onChangeText={(v) => setValue(v.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={maxLength}
          editable={!busy}
        />
      </View>
      {showError ? <Text style={styles.error}>Enter a valid {lengthHint} phone number.</Text> : null}
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
          onSubmit(`+${country.dialCode}${localDigits}`);
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
  row: {
    flexDirection: 'row',
    gap: QodeSpace[2],
  },
  input: {
    flex: 1,
    // Without this, React Native Web renders `flex: 1` with the browser's
    // own implicit `min-width: auto` on flex items — a TextInput then
    // refuses to shrink below its unconstrained/placeholder content width,
    // so on a narrow screen the row (this + the country picker) overflows
    // the screen's own padding instead of this field giving up space
    // first, pushing its rounded edge past the visible screen (reported at
    // 375px width, 15 Sep). Native iOS/Android don't share this quirk —
    // Yoga has no such default — so it only ever showed on web.
    minWidth: 0,
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
