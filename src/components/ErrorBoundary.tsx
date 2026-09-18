import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Component, type ReactNode } from 'react';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useAuth } from '@/lib/auth';

interface Props {
  children: ReactNode;
  /** Signs out and returns to `/login` — a class component can't call
   * `useAuth()`/`useRouter()` itself (no hooks in class components), so
   * the exported `ErrorBoundary` function component below supplies this
   * as a prop instead. */
  onSignOut: () => Promise<void>;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defence against an unexpected render-time crash — a
 * malformed field from a real account's data the rest of the app didn't
 * anticipate, not the two known chart bugs already guarded individually
 * (Donut.tsx, NavChart.tsx). React unmounts the whole tree below whichever
 * component throws unless something catches it; without this, that reads
 * to the person holding the phone as the app itself abruptly closing, with
 * no way back short of force-quitting and reopening.
 *
 * Deliberately a single boundary wrapping the whole app (in `_layout.tsx`)
 * rather than one per screen: this app's screens don't have enough
 * independent surface area from each other (shared tab bar, shared auth
 * state) for a per-screen boundary to keep the REST of the screen usable
 * the way it would on a page built from many small independent widgets.
 * "Try again" (a plain state reset) is enough for anything transient —
 * e.g. a bad response for THIS load that a retry re-fetches cleanly;
 * "Restart app" reaches for `DevSettings.reload()` (the same call the dev
 * menu's own "Reload" uses, available in Expo Go and dev-client builds
 * alike) for anything that isn't.
 *
 * "Sign out and start over" (added 16 Sep, an audit finding, not a
 * reported crash) is the one path that survives a DETERMINISTIC crash in
 * production: a malformed field in one real account's data that some
 * screen doesn't guard defensively against (`reviewApi.ts`'s own comment
 * already flags this as a real, anticipated risk, not hypothetical) would
 * throw again immediately every time "Try again" remounts the same
 * screen, and "Restart app" is a documented no-op outside Expo Go/a dev
 * client — leaving production users with literally no recovery except an
 * undocumented OS force-quit. Signing out and landing on `/login` mounts
 * an entirely different screen, clear of whatever crashed, which is a
 * genuine escape a same-screen retry can't be for this specific case.
 */
class ErrorBoundaryImpl extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] caught a render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            This screen ran into a problem. Your account and data are fine — try again, or restart the app if it
            keeps happening.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => this.setState({ error: null })}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.buttonSecondary, pressed && styles.pressed]}
            onPress={() => {
              // Only present in dev / a dev-client build — absent (and a
              // no-op via the guard) in a production release, where
              // "Try again" above is the only recovery offered.
              DevSettings.reload?.();
            }}>
            <Text style={styles.buttonSecondaryText}>Restart app</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.buttonSecondary, pressed && styles.pressed]}
            onPress={() => {
              // Reset error state IN THE SAME action, not after — leaving
              // `error` set would keep this fallback rendering forever
              // regardless of which route `/login` navigates to, since
              // this boundary's own `render()` shows it ahead of
              // `children` (the whole `<Stack>`, /login included) whenever
              // `error` is non-null.
              this.setState({ error: null });
              void this.props.onSignOut();
            }}>
            <Text style={styles.buttonSecondaryText}>Sign out and start over</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }
}

/** Thin function-component wrapper — supplies `onSignOut` from hooks
 * (`useAuth`/`useRouter`) to the class component above, which can't call
 * either itself. Sits inside `AuthProvider` in `_layout.tsx` (deliberately
 * — "a screen crashing and recovering via 'Try again' should not also
 * cost the reader their session"), so `useAuth()` here is always safe. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <ErrorBoundaryImpl
      onSignOut={async () => {
        await signOut();
        router.replace('/login');
      }}>
      {children}
    </ErrorBoundaryImpl>
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
    maxWidth: 360,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[5],
    gap: QodeSpace[3],
    alignItems: 'center',
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 20,
    color: QodeColor.cream,
    textAlign: 'center',
  },
  message: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: QodeColor.textSecondary,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: QodeSpace[2],
  },
  buttonText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textOnAccent,
  },
  buttonSecondary: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
    textDecorationLine: 'underline',
  },
});
