import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * A tiny key-value persistence layer, extracted out of auth.tsx (which
 * needed exactly this for the session) so a second screen (Risk Profile)
 * doesn't duplicate the same platform branch.
 *
 * `expo-secure-store`'s own `.web.js` (as of 57.0.4) is a literal empty
 * stub — `export default {}` — not a working localStorage-backed
 * implementation the way its docs/changelog imply. Calling `setItemAsync`
 * there throws "setValueWithKeyAsync is not a function" (found the hard
 * way: it crashed the OTP step on web). So web gets its own small branch
 * here instead of trusting the package to handle it.
 *
 * `localStorage` itself is wrapped in try/catch and backed by an
 * in-memory Map as a last resort — some embedded/sandboxed web preview
 * contexts block storage access entirely; data that doesn't survive a
 * reload there is a much smaller problem than a crash.
 */
const memoryStore = new Map<string, string>();

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setStorageItem(key: string, value: string): Promise<void> {
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

export async function deleteStorageItem(key: string): Promise<void> {
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
