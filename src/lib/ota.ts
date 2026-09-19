import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Over-the-air (EAS Update) fixes for JS/asset-only changes — see
 * docs/releasing.md. expo-updates already checks on every cold start
 * (app.json `updates.checkAutomatically: ON_LOAD`, no launch wait) and
 * applies what it downloads on the NEXT start. This adds the same check when
 * the app returns from the background after a while, so someone who never
 * force-quits still picks a fix up promptly. A downloaded update is applied
 * at the next cold start — never mid-session, so nobody loses their place.
 *
 * Off in development and web (Updates.isEnabled is false there).
 */
const FOREGROUND_CHECK_GAP_MS = 30 * 60 * 1000;

async function fetchIfAvailable(): Promise<void> {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline, or the update server is down — the embedded/current bundle keeps running.
  }
}

export function useOtaUpdates(): void {
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= FOREGROUND_CHECK_GAP_MS) void fetchIfAvailable();
      }
    });
    return () => sub.remove();
  }, []);
}
