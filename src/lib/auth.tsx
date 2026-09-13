import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { logout as apiLogout } from '@/lib/api';
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
 * The mobile side of "am I signed in" — a real, persisted session, not a
 * screen-to-screen prop. Login now calls qode-oneview's real
 * `/api/auth/send` and `/verify` (src/lib/api.ts), which mint a REAL
 * session cookie server-side; this is a separate, local-only flag layered
 * on top, used purely for the app's own routing (index.tsx: dashboard vs.
 * login) so it survives an app restart without needing to ping the server
 * first, and so Profile/More has something concrete to sign out of.
 *
 * Storage (src/lib/storage.ts) is SecureStore (Keychain/Keystore-backed)
 * on iOS/Android rather than AsyncStorage — SPEC-mobile-auth.md's Open
 * Question #4 recommends exactly this for wherever a bearer token would
 * land, and a phone number is exactly as sensitive as that token would be.
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
        // Real call to `POST /api/auth/logout` (src/lib/api.ts), clearing
        // the actual session cookie server-side — best-effort, since the
        // local session below is cleared regardless of whether it succeeds.
        await apiLogout();
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
