import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { fetchWithTimeout, getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getStorageItem, setStorageItem } from '@/lib/storage';

/**
 * App usage analytics, two layers:
 *
 * 1. EAS Insights (`expo-insights`, no code) — Expo's own dashboard on
 *    expo.dev (project → Insights): unique users per platform and app
 *    version, from release builds only.
 * 2. First-party events into qode-oneview's `events` ledger, shown on its
 *    /internal/metrics page next to the web funnel:
 *      app_install  — first launch on this device
 *      app_open     — a cold start, or a return after APP_OPEN_GAP_MS away
 *      page_view    — screen views for signed-in customers (the same event
 *                     the web dashboard already posts, page prefixed "app:")
 *
 * A device is identified by a random id generated here and kept in secure
 * storage — no hardware identifiers. Nothing is sent from dev builds (they
 * talk to the same production database) or from web.
 */

const INSTALL_ID_KEY = 'qode.analytics.installId';
const APP_OPEN_GAP_MS = 30 * 60 * 1000;

const enabled = !__DEV__ && Platform.OS !== 'web';

function randomId(): string {
  // RFC 4122 v4 shape; Math.random is plenty for an analytics id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    // Analytics never surfaces an error.
  }
}

async function sendAppEvent(name: 'app_install' | 'app_open', installId: string): Promise<void> {
  await post('/api/mobile/events', {
    name,
    props: {
      installId,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appVersion: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
      device: Device.modelName,
    },
  });
}

/** Records the install (once) and each app open. Mount once, at the root. */
export function useAppAnalytics(): void {
  const { session } = useAuth();
  const pathname = usePathname();
  const installIdRef = useRef<string | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      let id = await getStorageItem(INSTALL_ID_KEY).catch(() => null);
      const firstLaunch = !id;
      if (!id) {
        id = randomId();
        await setStorageItem(INSTALL_ID_KEY, id).catch(() => {});
      }
      if (cancelled) return;
      installIdRef.current = id;
      await sendAppEvent(firstLaunch ? 'app_install' : 'app_open', id);
    })();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAtRef.current = Date.now();
      } else if (state === 'active' && backgroundedAtRef.current !== null) {
        const away = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (away >= APP_OPEN_GAP_MS && installIdRef.current) {
          void sendAppEvent('app_open', installIdRef.current);
        }
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // Screen views, for real signed-in customers only (the review/demo
  // account has no data of its own worth counting).
  const trackPages = enabled && !!session && !session.demo;
  useEffect(() => {
    if (!trackPages || !pathname) return;
    void post('/api/track', { name: 'page_view', props: { page: `app:${pathname}` } });
  }, [trackPages, pathname]);
}
