import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

const SESSION_KEY = 'qode.session.phone';

export interface Session {
  /** The verified phone number, in whatever international form the reader typed it (see PhoneEntryForm). */
  phone: string;
}

interface AuthContextValue {
  /**
   * `undefined` while the stored session is still being read — SecureStore
   * is async, so there is a real gap between "app opened" and "we know
   * whether this device has a session." Nothing should redirect on that
   * value; `index.tsx` renders nothing until it resolves.
   */
  session: Session | null | undefined;
  signIn: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * `expo-secure-store`'s own `.web.js` (as of 57.0.4) is a literal empty
 * stub — `export default {}` — not a working localStorage-backed
 * implementation the way its docs/changelog imply. Calling
 * `setItemAsync` there throws "setValueWithKeyAsync is not a function"
 * (found the hard way: it crashed the OTP step on web). So web gets its
 * own small branch here instead of trusting the package to handle it.
 *
 * `localStorage` itself is wrapped in try/catch and backed by an
 * in-memory Map as a last resort — some embedded/sandboxed web preview
 * contexts block storage access entirely; a session that doesn't survive
 * a reload there is a much smaller problem than a crash.
 */
const memoryStore = new Map<string, string>();

async function readSession(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeSession(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function clearSession(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * The mobile side of SPEC-mobile-auth.md's "working model" — a real,
 * persisted session, not a screen-to-screen prop. There is no backend yet
 * (qode-oneview's own dual-mode bearer-token routes described in that spec
 * aren't built), so this is intentionally local-only: verifying an OTP
 * writes a session that survives an app restart, and Profile can actually
 * sign out of it, rather than "you're logged in because you're on this
 * screen" with nothing to sign out of.
 *
 * SecureStore (Keychain/Keystore-backed) on iOS/Android rather than
 * AsyncStorage — the spec's own Open Question #4 recommends exactly this
 * for wherever the eventual bearer token lands, and a phone number is
 * exactly as sensitive as that token will be. Web falls back to
 * `localStorage` (see the comment above) since SecureStore has no real
 * web implementation to defer to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    readSession(SESSION_KEY)
      .then((phone) => setSession(phone ? { phone } : null))
      .catch(() => setSession(null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async signIn(phone: string) {
        await writeSession(SESSION_KEY, phone);
        setSession({ phone });
      },
      async signOut() {
        await clearSession(SESSION_KEY);
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
