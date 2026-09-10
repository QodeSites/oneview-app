import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export interface PhoneEntryFormProps {
  /** Called with the normalized 10-digit phone number on a valid submit. */
  onSubmit: (phone: string) => void;
}

/**
 * Mirrors qode-oneview's own `normalisePhone` (src/lib/otp.ts): strip
 * non-digits, keep the last 10, and require an Indian mobile prefix
 * (6-9). Returns null for anything that wouldn't pass the backend's own
 * check either, so the client never accepts what the server would reject.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
}

export function PhoneEntryForm({ onSubmit }: PhoneEntryFormProps) {
  const [value, setValue] = useState('');
  const normalized = normalisePhone(value);
  const isValid = normalized !== null;
  const showError = value.length > 0 && !isValid;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        value={value}
        onChangeText={setValue}
        maxLength={20}
      />
      {showError ? (
        <Text style={styles.error}>Enter a 10-digit Indian mobile number.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!isValid}
        style={[styles.button, !isValid && styles.buttonDisabled]}
        onPress={() => {
          if (normalized) onSubmit(normalized);
        }}>
        <Text style={styles.buttonText}>Send code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
