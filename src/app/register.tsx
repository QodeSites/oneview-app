import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/auth/BrandMark';
import { StepDots } from '@/components/auth/StepDots';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useAuth } from '@/lib/auth';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Registration — the last step of sign-up for a verified phone with no
 * account yet, matching qode-oneview's complete-profile/DetailsForm.tsx
 * (name + email, no PAN here — PAN comes from the AA consent journey
 * itself, per that file's own comment on why it isn't asked twice).
 * Mock/local-state only, no fetch — navigates straight to the tabs.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const nameValid = name.trim().length >= 2;
  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = nameValid && emailValid;

  return (
    <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SafeAreaView edges={['top', 'bottom']}>
            <View style={styles.hero}>
              <BrandMark size={26} showWordmark={false} />
              <StepDots count={2} activeIndex={1} />
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              {phone ? `Signing up with ${phone}. ` : ''}Just your name and email — your PAN comes from linking your
              accounts.
            </Text>

            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor={QodeColor.textMuted}
              value={name}
              onChangeText={(v) => setName(v.replace(/[^\p{L}\s'.-]/gu, ''))}
              maxLength={120}
              autoFocus
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={QodeColor.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => setEmail(v.trim())}
              maxLength={254}
            />

            <Pressable
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                void signIn(phone ?? '');
                router.replace('/performance');
              }}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    // Not `justifyContent: 'center'` — see the comment on login.tsx's
    // identical scroll style. Centering fights the keyboard on a screen
    // with real TextInputs; top-aligned content scrolls predictably.
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[7],
    paddingBottom: QodeSpace[6],
  },
  hero: {
    alignItems: 'center',
    gap: QodeSpace[4],
    marginBottom: QodeSpace[4],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 28,
    color: QodeColor.cream,
    textAlign: 'center',
    marginBottom: QodeSpace[2],
  },
  subtitle: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    lineHeight: 19,
    color: QodeColor.textMuted,
    textAlign: 'center',
    marginBottom: QodeSpace[5],
  },
  label: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: QodeColor.textMuted,
    marginBottom: QodeSpace[1],
  },
  input: {
    width: '100%',
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: QodeFont.uiRegular,
    fontSize: 16,
    color: QodeColor.textPrimary,
    marginBottom: QodeSpace[4],
  },
  button: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: QodeSpace[2],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textOnAccent,
  },
});
