import { deleteStorageItem, getStorageItem, setStorageItem } from '@/lib/storage';

/** Whether this device has been through the welcome slides (src/app/welcome.tsx). */
const WELCOME_KEY = 'qode.welcome.seen';

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await getStorageItem(WELCOME_KEY)) === '1';
  } catch {
    // Unreadable storage: don't trap the reader in onboarding.
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  await setStorageItem(WELCOME_KEY, '1').catch(() => {});
}

/**
 * For the More screen's hidden "tap the version number" reset (QA only —
 * see more.tsx). Needed because this flag lives in SecureStore, which on
 * iOS is Keychain-backed and — unlike the app's own file sandbox —
 * survives an uninstall/reinstall by design. A tester who deletes and
 * reinstalls a TestFlight build still has this flag set from their last
 * install, so the welcome screens never reappear even though the app
 * itself is "fresh" (reported 18 Sep). A genuinely new customer's device
 * has no such leftover, so this never affects them.
 */
export async function resetWelcomeSeen(): Promise<void> {
  await deleteStorageItem(WELCOME_KEY).catch(() => {});
}
