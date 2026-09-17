import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isReviewPhone } from '@/constants/review-account';
import { logout as apiLogout } from '@/lib/api';
import { setDemoActive } from '@/lib/demo';
import { subscribeSessionExpired } from '@/lib/session-events';
import { deleteStorageItem, getStorageItem, setStorageItem } from '@/lib/storage';

const SESSION_KEY = 'qode.session.phone';
const DEMO_KEY = 'qode.session.demo';

export interface Session {
  /** The verified phone number, in whatever international form the reader typed it (see PhoneEntryForm). */
  phone: string;
  /**
   * True for the local-only, no-network "demo mode" (src/lib/demo.ts) —
   * entered via the `__DEV__`-only "View demo" link on the login screen,
   * never a real signed-in customer. Kept in its own storage key
   * (`DEMO_KEY`) rather than folded into `phone`'s own format, so a real
   * session's stored shape never has to change to make room for this.
   */
  demo?: boolean;
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
  /** Enters demo mode — see `Session.demo` and `src/lib/demo.ts`. */
  signInDemo: () => Promise<void>;
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
    Promise.all([getStorageItem(SESSION_KEY), getStorageItem(DEMO_KEY)])
      .then(([phone, demoFlag]) => {
        const demo = demoFlag === '1';
        setDemoActive(!!phone && demo);
        setSession(phone ? { phone, demo } : null);
      })
      .catch(() => setSession(null));
  }, []);

  // Kept in a ref (rather than read from the closure) so the subscription
  // below — set up once, for the app's whole lifetime — always sees the
  // CURRENT session, not whatever it was when the effect first ran. Synced
  // via its own effect, not assigned directly in the render body — this
  // project runs the React Compiler (app.json's `reactCompiler` experiment),
  // which treats a ref write during render as a bug (it can be silently
  // dropped or re-run under compiler-driven memoization) and correctly
  // flagged this as one when it was first written that way.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  // Guards against acting twice: the Performance screenshot that prompted
  // this (16 Sep) showed seven back-to-back 401s across one screen's
  // retries before the reader ever saw them, each of which would otherwise
  // fire its own clear-and-redirect.
  const expiredHandledRef = useRef(false);

  useEffect(
    () =>
      // Fired by api.ts/reviewApi.ts on any 401 from an authenticated call
      // (session-events.ts) — the real server-side session cookie is gone
      // even though this device's own local `session` flag still says
      // signed-in (e.g. the dev server restarted, or a cookie jar reset
      // switching between Expo Go and a dev-client build). Previously nothing
      // detected this at all: every screen just showed a generic "server
      // returned an error (401)" with a "Try again" that retried the same
      // dead session forever, and the only way out was finding Sign out
      // under More manually. This clears the local session and sends the
      // reader back to sign in automatically, the same outcome a manual
      // sign-out already reaches. Skips `apiLogout()` (unlike a real
      // sign-out) — there's no point round-tripping a logout call to a
      // session the server has already discarded.
      subscribeSessionExpired(() => {
        if (expiredHandledRef.current || !sessionRef.current) return;
        expiredHandledRef.current = true;
        void deleteStorageItem(SESSION_KEY);
        void deleteStorageItem(DEMO_KEY);
        setDemoActive(false);
        setSession(null);
        router.replace('/login?expired=1');
      }),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async signIn(phone: string) {
        expiredHandledRef.current = false;
        // The store-review account (constants/review-account.ts) has a real
        // server session but no portfolio, so it reads the demo data
        // instead of an empty dashboard.
        const demo = isReviewPhone(phone);
        await setStorageItem(SESSION_KEY, phone);
        if (demo) await setStorageItem(DEMO_KEY, '1');
        else await deleteStorageItem(DEMO_KEY);
        setDemoActive(demo);
        setSession(demo ? { phone, demo } : { phone });
      },
      async signInDemo() {
        expiredHandledRef.current = false;
        await setStorageItem(SESSION_KEY, 'demo');
        await setStorageItem(DEMO_KEY, '1');
        setDemoActive(true);
        setSession({ phone: 'demo', demo: true });
      },
      async signOut() {
        // Real call to `POST /api/auth/logout` (src/lib/api.ts), clearing
        // the actual session cookie server-side — best-effort, since the
        // local session below is cleared regardless of whether it succeeds.
        // Skipped for the dev-only "View demo" session (phone 'demo'): there
        // is no real server-side session to clear. The review account shows
        // demo data too, but it did sign in for real, so it still logs out.
        if (session?.phone !== 'demo') await apiLogout();
        await deleteStorageItem(SESSION_KEY);
        await deleteStorageItem(DEMO_KEY);
        setDemoActive(false);
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
