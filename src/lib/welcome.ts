import { getStorageItem, setStorageItem } from '@/lib/storage';

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
