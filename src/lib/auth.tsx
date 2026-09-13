import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deleteStorageItem, getStorageItem, setStorageItem } from '@/lib/storage';

const SESSION_KEY = 'qode.session.phone';

export interface Session {
  /** The verified phone number, in whatever international form the reader typed it (see PhoneEntryForm). */
  phone: string;
}

interface AuthContextValue {
  /**
   * `undefined` while the stored session is still being read — storage
   * access is async, so there is a real gap between "app opened" and "we
   * know whether this device has a session." Nothing should redirect on
   * that value; `index.tsx` renders nothing until it resolves.
   */
  session: Session | null | undefined;
  signIn: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The mobile side of SPEC-mobile-auth.md's "working model" — a real,
 * persisted session, not a screen-to-screen prop. There is no backend yet
 * (qode-oneview's own dual-mode bearer-token routes described in that spec
 * aren't built), so this is intentionally local-only: verifying an OTP
 * writes a session that survives an app restart, and Profile can actually
 * sign out of it, rather than "you're logged in because you're on this
 * screen" with nothing to sign out of.
 *
 * Storage (src/lib/storage.ts) is SecureStore (Keychain/Keystore-backed)
 * on iOS/Android rather than AsyncStorage — the spec's own Open Question
 * #4 recommends exactly this for wherever the eventual bearer token
 * lands, and a phone number is exactly as sensitive as that token will be.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getStorageItem(SESSION_KEY)
      .then((phone) => setSession(phone ? { phone } : null))
      .catch(() => setSession(null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async signIn(phone: string) {
        await setStorageItem(SESSION_KEY, phone);
        setSession({ phone });
      },
      async signOut() {
        await deleteStorageItem(SESSION_KEY);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
