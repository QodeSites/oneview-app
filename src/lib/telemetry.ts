import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';
import PostHog from 'posthog-react-native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { fetchWithTimeout, getApiBaseUrl } from '@/lib/api';
import { useAuth, type Session } from '@/lib/auth';
import { scrubSentryEvent, scrubText } from '@/lib/telemetry-scrub';

/**
 * Product analytics (self-hosted PostHog) and error tracking (self-hosted
 * Sentry), per the company-wide integration standard — docs/analytics.md
 * has the full picture: every event, where it fires, how users are
 * identified, and how to send a test event.
 *
 * Separate from `analytics.ts`, which keeps posting the app's own
 * install/open/page_view events to qode-oneview's `events` ledger — both
 * run side by side until the dashboards move over.
 *
 * Nothing here may ever break the app: every call is fire-and-forget and
 * wrapped, the app works with posthog/sentry.qodeinvest.com unreachable,
 * and nothing is sent from development builds or web.
 */

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
/** Set per EAS build profile in eas.json ("production", "preview"); dev builds never report. */
const ENVIRONMENT = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

const APP_NAME = 'qode-oneview-app';
const enabled = !__DEV__ && Platform.OS !== 'web';

/** The shared event standard (the rows this app can actually produce), with each event's own properties. */
export interface TelemetryEvents {
  signup_started: { method: 'phone_otp' };
  signup_completed: { method: 'phone_otp' };
  login_succeeded: { method: 'phone_otp' };
  risk_profile_completed: { risk_band: string };
  factsheet_downloaded: { product: string };
  portfolio_viewed: Record<string, never>;
  support_contacted: { channel: 'whatsapp' };
}

let posthog: PostHog | null = null;
let initialised = false;

/** The shared PostHog client (null in dev/web or when unconfigured) — for feature flags (remote-flags.ts). */
export function getPostHog(): PostHog | null {
  return posthog;
}

function linkSentryToPostHog(): void {
  try {
    if (posthog) Sentry.setTag('posthog_distinct_id', posthog.getDistinctId());
  } catch {
    // Linking is a nicety; never let it throw.
  }
}

/** Starts both SDKs once. Safe to call repeatedly (fast refresh re-runs module code). */
export function initTelemetry(): void {
  if (initialised) return;
  initialised = true;
  if (!enabled) return;

  if (SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        // Release/dist default to "<bundle id>@<version>+<build number>" from the native app,
        // the same value the build's source-map upload tags — see docs/analytics.md.
        sendDefaultPii: false,
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.2,
        beforeSend: (event) => scrubSentryEvent(event),
        // An OTA update changes the JS without changing the release, so the
        // update id is what says which code actually threw.
        initialScope: { tags: { expo_update_id: Updates.updateId ?? 'embedded' } },
        beforeBreadcrumb: (crumb) => {
          if (crumb.message) crumb.message = scrubText(crumb.message);
          if (crumb.data) crumb.data = scrubSentryEvent({ extra: crumb.data }).extra;
          return crumb;
        },
      });
    } catch {
      // Error tracking unavailable; the app carries on.
    }
  }

  if (POSTHOG_KEY && POSTHOG_HOST) {
    try {
      posthog = new PostHog(POSTHOG_KEY, {
        host: POSTHOG_HOST,
        // Application Installed / Opened / Backgrounded / Updated.
        captureAppLifecycleEvents: true,
        // Touch autocapture would record on-screen text (holdings, values); off by policy.
        // Session replay likewise stays off (no masking review done for portfolio screens).
        enableSessionReplay: false,
      });
      void posthog.register({
        app: APP_NAME,
        platform: Platform.OS,
        app_version: Application.nativeApplicationVersion ?? 'unknown',
        environment: ENVIRONMENT,
        // Which OTA update is running — 'embedded' until one lands (docs/releasing.md).
        update_id: Updates.updateId ?? 'embedded',
      });
      linkSentryToPostHog();
    } catch {
      posthog = null;
    }
  }

  // Build-time switch for checking the pipes end to end (docs/analytics.md):
  // EXPO_PUBLIC_TELEMETRY_SELFTEST=1 sends one test event + one test error at launch.
  if (process.env.EXPO_PUBLIC_TELEMETRY_SELFTEST === '1') setTimeout(sendTelemetryTest, 3000);
}

/** Sends one standard event. Unknown names don't compile — add them to `TelemetryEvents` first. */
export function track<E extends keyof TelemetryEvents>(event: E, ...props: TelemetryEvents[E] extends Record<string, never> ? [] : [TelemetryEvents[E]]): void {
  try {
    posthog?.capture(event, (props[0] ?? {}) as Record<string, string>);
  } catch {
    // Analytics never surfaces an error.
  }
}

/** Reports an error caught by our own boundaries/handlers. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}

/**
 * Sends one test event and one test error — the documented way to check the
 * pipes end to end (docs/analytics.md). Callable from a release build's
 * dev tools; does nothing in development builds, where nothing is sent.
 */
export function sendTelemetryTest(): void {
  try {
    posthog?.capture('telemetry_test_sent', {});
    void posthog?.flush();
    Sentry.captureException(new Error('Telemetry test error (qode-oneview-app) — safe to ignore'));
  } catch {
    // ignore
  }
}

/**
 * The opaque analytics ID from qode-oneview (`GET /api/mobile/identity`,
 * an HMAC of the customer id — never the phone). `null` when the endpoint
 * isn't deployed yet or the server has no secret: the user then stays
 * anonymous, which is safe.
 */
async function fetchAnalyticsId(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/mobile/identity`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { data?: { analyticsId?: unknown } } | null;
    const id = body?.data?.analyticsId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function identify(id: string): void {
  try {
    posthog?.identify(id);
    Sentry.setUser({ id });
    linkSentryToPostHog();
  } catch {
    // ignore
  }
}

function resetIdentity(): void {
  try {
    posthog?.reset();
    Sentry.setUser(null);
    linkSentryToPostHog();
  } catch {
    // ignore
  }
}

const isCustomer = (s: Session | null | undefined): s is Session => !!s && !s.demo;

/**
 * Mount once at the root. Screens, login/logout and identity — all derived
 * from the router and the auth session, so no login/auth code had to change:
 *   - screen views on every route change; `portfolio_viewed` on the dashboard
 *   - `signup_started` when the registration screen opens
 *   - a session starting (not a restore) → `login_succeeded`, plus
 *     `signup_completed` when it starts on the registration screen
 *   - identify on login and on session restore; reset on logout
 */
export function useTelemetry(): void {
  const { session } = useAuth();
  const pathname = usePathname();
  const prevSession = useRef<Session | null | undefined>(undefined);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (!enabled || !pathname) return;
    try {
      void posthog?.screen(pathname);
    } catch {
      // ignore
    }
    if (pathname === '/register') track('signup_started', { method: 'phone_otp' });
    if (pathname === '/performance' && isCustomer(session)) track('portfolio_viewed');
    // Screen views only; session is read, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const before = prevSession.current;
    prevSession.current = session;
    if (!enabled || session === undefined) return;

    if (isCustomer(session)) {
      // `before === null` = signed out → signed in this run; `undefined` = restored at launch.
      if (before === null) {
        const onRegister = pathnameRef.current === '/register';
        if (onRegister) track('signup_completed', { method: 'phone_otp' });
        track('login_succeeded', { method: 'phone_otp' });
      }
      void fetchAnalyticsId().then((id) => {
        if (id) identify(id);
      });
    } else if (isCustomer(before) && session === null) {
      resetIdentity();
    }
  }, [session]);
}
