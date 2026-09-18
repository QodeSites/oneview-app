import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import type { PresenceSummary } from '@/lib/reviewApi';

/**
 * Ported from qode-oneview's `src/components/review/NothingYet.tsx` — the
 * dedicated empty state its `/review` layout shows INSTEAD of the dashboard
 * for a customer who has never linked anything, rather than rendering
 * Performance/Segments/Holdings/MF X-Ray against zeros (a donut with no
 * slices, "₹0" everywhere, a wealth-gap card comparing nothing to nothing).
 * `/api/mobile/performance` etc. inherit none of that gating on their own
 * (see that route's comment) — this is shown by `app-tabs.tsx` ahead of all
 * four dashboard tabs instead, mirroring the web layout's own gate.
 *
 * Two states, matching the real copy's own reasoning: "we were never given
 * permission to look" (`!hasConsent`) is a fact about consent, not about the
 * customer's money — the other case ("your institutions replied and found
 * nothing") is a real answer and must not be worded the same way.
 *
 * NOT ported: the CasUpload statement-upload fallback the web version offers
 * alongside "Link another account" — that flow doesn't exist on mobile yet
 * (see PROGRESS.md's `mobile-profile` section).
 */
export function NothingYet({ presence }: { presence: PresenceSummary }) {
  const router = useRouter();
  const neverAsked = !presence.hasConsent;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {neverAsked ? "Let's bring your portfolio in" : 'Your accounts reported no holdings'}
        </Text>
        <Text style={styles.body}>
          {neverAsked
            ? "There is nothing to show yet because your accounts haven't been linked. Linking uses the RBI's Account Aggregator framework — you approve it with your bank or depository, we only ever read, and you can withdraw at any time."
            : 'We read the accounts you linked and they reported no holdings. That is a real answer, not a failure — it happens when the linked accounts are empty, or when the holdings sit with an institution that hasn’t been linked yet.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => {
            if (neverAsked) router.push('/link');
            else router.push({ pathname: '/link', params: { force: '1' } });
          }}>
          <Text style={styles.buttonText}>{neverAsked ? 'Link my accounts' : 'Link another account'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: QodeSpace[5],
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[5],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 20,
    color: QodeColor.cream,
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: QodeColor.textSecondary,
    marginTop: QodeSpace[3],
  },
  button: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: QodeSpace[5],
  },
  buttonText: {
    fontFamily: QodeFont.ui,
    fontSize: 14.5,
    color: QodeColor.textOnAccent,
  },
});
