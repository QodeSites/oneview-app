import { useEffect, useState } from 'react';

import { getPostHog } from '@/lib/telemetry';

/**
 * Kill switches, served by PostHog feature flags (the PostHog we already run —
 * no separate remote-config service). Turning a flag named `kill_<feature>`
 * ON in PostHog hides that feature for everyone within seconds, no release
 * needed; turning it OFF brings it back. See docs/releasing.md.
 *
 * Fails open: if PostHog is unreachable, flags haven't loaded, or this is a
 * dev build, the feature stays ON. A kill switch must never be the thing that
 * breaks the app.
 */
export type KillSwitch =
  | 'vsi' // the VSI tab's charts
  | 'report_download'; // the review PDF download on Reports

function isKilled(feature: KillSwitch): boolean {
  try {
    return getPostHog()?.isFeatureEnabled(`kill_${feature}`) === true;
  } catch {
    return false;
  }
}

/** `true` while the feature's kill switch is on. Re-renders when flags (re)load. */
export function useKillSwitch(feature: KillSwitch): boolean {
  const [killed, setKilled] = useState(() => isKilled(feature));
  useEffect(() => {
    const posthog = getPostHog();
    if (!posthog) return;
    try {
      return posthog.onFeatureFlags(() => setKilled(isKilled(feature)));
    } catch {
      return undefined;
    }
  }, [feature]);
  return killed;
}
