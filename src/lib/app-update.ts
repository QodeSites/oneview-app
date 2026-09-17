import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

import { fetchWithTimeout, getApiBaseUrl } from '@/lib/api';
import { getStorageItem, setStorageItem } from '@/lib/storage';
import { compareVersions } from '@/lib/version';

/**
 * "A new version is available" — the app side of qode-oneview's
 * `GET /api/mobile/app-version` (src/features/mobile/app-release.ts there).
 *
 * The installed version is the native one (app.json `version`), so a store
 * release must bump `version` for this to notice it; EAS's build-number
 * auto-increment alone doesn't.
 */

export interface AppRelease {
  latestVersion: string;
  minimumVersion: string;
  releaseNotes: string[];
  storeUrl: { ios: string | null; android: string };
}

export type UpdateStatus =
  | { kind: 'none' }
  | { kind: 'available'; latest: string; notes: string[] }
  | { kind: 'required'; latest: string; notes: string[] };

const DISMISSED_KEY = 'qode.update.dismissed';
// Same identifier on both stores (app.json ios.bundleIdentifier / android.package).
const APP_ID = 'com.qodeinvest.oneview';

let lastRelease: AppRelease | null = null;

export function installedVersion(): string | null {
  return Application.nativeApplicationVersion;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const current = installedVersion();
  if (Platform.OS === 'web' || !current) return { kind: 'none' };

  let release: AppRelease;
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/mobile/app-version`, { method: 'GET' });
    if (!res.ok) return { kind: 'none' };
    release = (await res.json()) as AppRelease;
    if (typeof release.latestVersion !== 'string' || typeof release.minimumVersion !== 'string') {
      return { kind: 'none' };
    }
  } catch {
    return { kind: 'none' };
  }
  lastRelease = release;
  const notes = Array.isArray(release.releaseNotes) ? release.releaseNotes : [];

  if (compareVersions(current, release.minimumVersion) < 0) {
    return { kind: 'required', latest: release.latestVersion, notes };
  }
  if (compareVersions(current, release.latestVersion) < 0) {
    // "Later" hides the card for that release only; the next one shows again.
    const dismissed = await getStorageItem(DISMISSED_KEY).catch(() => null);
    if (dismissed === release.latestVersion) return { kind: 'none' };
    return { kind: 'available', latest: release.latestVersion, notes };
  }
  return { kind: 'none' };
}

export async function dismissUpdate(version: string): Promise<void> {
  await setStorageItem(DISMISSED_KEY, version).catch(() => {});
}

/** Apple's own lookup by bundle id — used until the App Store URL is configured server-side. */
async function lookupIosStoreUrl(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/lookup?bundleId=${APP_ID}&country=in`,
      { method: 'GET' },
    );
    const data = (await res.json()) as { results?: { trackViewUrl?: string }[] };
    return data.results?.[0]?.trackViewUrl ?? null;
  } catch {
    return null;
  }
}

export async function openStore(): Promise<void> {
  if (Platform.OS === 'android') {
    const url = lastRelease?.storeUrl.android ?? `https://play.google.com/store/apps/details?id=${APP_ID}`;
    // The market:// scheme opens the Play Store app directly; the https URL is the fallback.
    const pkg = Application.applicationId ?? APP_ID;
    await Linking.openURL(`market://details?id=${pkg}`).catch(() => Linking.openURL(url));
    return;
  }
  const url = lastRelease?.storeUrl.ios ?? (await lookupIosStoreUrl());
  if (url) await Linking.openURL(url).catch(() => {});
}
