import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhoneEntryForm } from '@/components/auth/PhoneEntryForm';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Screen 1, step 1 (phone entry) — see SPEC-mobile-auth.md.
 *
 * `onSubmit` is not wired to `POST /api/auth/send` yet: that backend module
 * isn't built. This screen owns the eventual network call once it exists;
 * for now it's a stub so the UI slice stands on its own, matching
 * tasks/plan.md's Task 3 scope.
 */
export default function LoginScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Sign in to OneView
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Enter the phone number you use on qodeinvest.com.
        </ThemedText>
        <PhoneEntryForm
          onSubmit={(phone) => {
            // TODO: call POST /api/auth/send once mobile-auth is built
            // (SPEC-mobile-auth.md) and navigate to the OTP step.
            console.log('submitted phone:', phone);
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
});
