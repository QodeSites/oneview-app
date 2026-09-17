import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';

import { QodeColor } from '@/constants/qode-theme';
import { useAuth } from '@/lib/auth';
import { hasSeenWelcome } from '@/lib/welcome';

/**
 * The app's real entry point. Now that AuthProvider (src/lib/auth.tsx)
 * persists a session, this branches on it instead of always sending
 * everyone to `/login` — a customer who verified an OTP and closed the
 * app should not have to do that again on every open.
 *
 * `session` is `undefined` for one tick while SecureStore is read
 * (genuinely async, not a loading-state affectation) — rendering nothing
 * but the Curtain background for that tick is preferable to a flash of
 * the login screen for an already-signed-in customer.
 */
export default function Index() {
  const { session } = useAuth();
  // First-run welcome slides (welcome.tsx) — only for someone not signed
  // in, so existing customers updating the app never see them.
  const [seenWelcome, setSeenWelcome] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    void hasSeenWelcome().then(setSeenWelcome);
  }, []);

  if (session === undefined || seenWelcome === undefined) {
    return <LinearGradient colors={[QodeColor.gradientStart, QodeColor.gradientEnd]} style={{ flex: 1 }} />;
  }

  if (session) return <Redirect href="/performance" />;
  return <Redirect href={seenWelcome ? '/login' : '/welcome'} />;
}
