import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { deleteStorageItem, getStorageItem, setStorageItem } from '@/lib/storage';

const ENABLED_KEY = 'qode.applock.enabled';

/**
 * Leaving the app briefly — to the share sheet, the document picker, the
 * bank's consent page in a browser tab — must not lock the reader out on
 * return. Only an absence longer than this locks.
 */
const RELOCK_AFTER_MS = 30 * 1000;

export interface BiometricSupport {
  /**
   * The phone has a biometric sensor AND the owner has enrolled something
   * (fingerprint, face, …). Deliberately not which one: a phone can report
   * face support while its owner only uses a fingerprint, so the UI just
   * says "App lock" and lets the system prompt show whatever the phone uses.
   */
  available: boolean;
}

interface AppLockValue {
  support: BiometricSupport | null;
  /** The reader turned the lock on (this device only). */
  enabled: boolean;
  /** The lock screen is currently covering the app. */
  locked: boolean;
  /**
   * The stored setting hasn't been read yet. A signed-in app stays covered
   * (plain background, no prompt) for that moment, so a locked portfolio
   * never flashes on screen before the lock appears.
   */
  pending: boolean;
  /** Prompts for biometrics; resolves true when the app is unlocked. */
  unlock: () => Promise<boolean>;
  /** Turns the lock on (after a successful prompt) or off. */
  setEnabled: (value: boolean) => Promise<boolean>;
  /** Removes the lock without a prompt — only for signing out from the lock screen. */
  clearLock: () => Promise<void>;
}

const AppLockContext = createContext<AppLockValue | null>(null);

async function detectSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') return { available: false };
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return { available: hasHardware && enrolled };
  } catch {
    return { available: false };
  }
}

async function prompt(message: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Cancel',
      // Falls back to the device passcode/PIN, so a failed face scan (a
      // mask, a wet finger) never locks the owner out of their own app.
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * App lock (fingerprint, face or the phone's PIN — whatever the phone
 * uses). Opt-in from More, stored on the device
 * against the phone number that turned it on — so it applies only while
 * that account is signed in, and a different account signing in on the
 * same phone isn't locked by someone else's setting. When on, the app locks
 * on a cold start and after being away for longer than RELOCK_AFTER_MS.
 *
 * Must sit inside AuthProvider (it reads the session).
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  /** The phone number the lock was turned on for, or null. */
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const backgroundedAtRef = useRef<number | null>(null);
  const prompting = useRef(false);

  useEffect(() => {
    void Promise.all([detectSupport(), getStorageItem(ENABLED_KEY).catch(() => null)]).then(([s, owner]) => {
      setSupport(s);
      setLockOwner(owner);
      // Cold start: lock straight away (the lock screen covers the first
      // paint, so nothing of the portfolio shows before the prompt). Only
      // takes effect if `owner` turns out to be the signed-in account.
      setLocked(!!owner);
      setLoaded(true);
    });
  }, []);

  // A fresh sign-in (signed out → signed in) just proved identity with an
  // SMS code, so it starts unlocked. React's "adjust state on prop change"
  // pattern — set during render, not in an effect. A cold start goes from
  // `undefined`, not `null`, so it keeps its lock.
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    if (prevSession === null && session) setLocked(false);
  }

  const signedIn = !!session;
  const enabled = signedIn && lockOwner !== null && lockOwner === session.phone;
  const active = enabled;

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      // 'background' only — iOS reports 'inactive' while the Face ID sheet
      // itself is up, which must not count as leaving the app.
      if (state === 'background') {
        backgroundedAtRef.current = Date.now();
      } else if (state === 'active' && backgroundedAtRef.current !== null) {
        const away = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (away >= RELOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [active]);

  const unlock = useCallback(async () => {
    if (prompting.current) return false;
    prompting.current = true;
    try {
      const ok = await prompt('Unlock Qode OneView');
      if (ok) setLocked(false);
      return ok;
    } finally {
      prompting.current = false;
    }
  }, []);

  const setEnabled = useCallback(
    async (value: boolean) => {
      if (!value) {
        // Turning it off is a security downgrade — confirm it's the owner.
        const ok = await prompt('Turn off app lock');
        if (!ok) return false;
        await deleteStorageItem(ENABLED_KEY);
        setLockOwner(null);
        return true;
      }
      if (!support?.available || !session) return false;
      const ok = await prompt('Turn on app lock');
      if (!ok) return false;
      await setStorageItem(ENABLED_KEY, session.phone);
      setLockOwner(session.phone);
      setLocked(false);
      return true;
    },
    [support, session],
  );

  const clearLock = useCallback(async () => {
    await deleteStorageItem(ENABLED_KEY);
    setLockOwner(null);
    setLocked(false);
  }, []);

  const value = useMemo<AppLockValue>(
    () => ({
      support,
      enabled,
      locked: loaded && active && locked,
      pending: !loaded && signedIn,
      unlock,
      setEnabled,
      clearLock,
    }),
    [support, enabled, loaded, active, locked, signedIn, unlock, setEnabled, clearLock],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
