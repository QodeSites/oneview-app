# Analytics and error tracking

Qode OneView (iOS + Android) reports to the company's self-hosted tools, following the shared
integration standard:

| Tool | What for | Where |
|---|---|---|
| PostHog | Product analytics (events, screens, funnels) | https://posthog.qodeinvest.com — shared project |
| Sentry | Crashes and errors | https://sentry.qodeinvest.com — org `sentry`, project `qode-app` |

Separately, and unchanged: EAS Insights (no code) and `src/lib/analytics.ts`, which posts
`app_install` / `app_open` / `page_view` to qode-oneview's own `events` table for its
`/internal/metrics` page. Both run alongside PostHog until the dashboards move over.

## Where it lives

- `src/lib/telemetry.ts` — the only module that talks to either SDK: initialisation, the typed
  event list (`TelemetryEvents`), `track()`, `reportError()`, identity and the `useTelemetry()` hook.
- `src/lib/telemetry-scrub.ts` — strips personal/financial data from everything bound for Sentry
  (unit-tested in `telemetry-scrub.test.ts`).
- `src/app/_layout.tsx` — calls `initTelemetry()` at module load (before the first render; guarded
  against double init on fast refresh), wraps the root in `Sentry.wrap`, and mounts
  `useTelemetry()`.
- `src/components/ErrorBoundary.tsx` — reports caught render errors to Sentry. Unhandled JS errors,
  promise rejections and native crashes are captured by the Sentry SDK itself.
- `metro.config.js` + the `@sentry/react-native` plugin in `app.json` — debug IDs and source-map /
  dSYM upload at build time.

**Nothing is sent from development builds (`__DEV__`) or from web.** Every call is wrapped and
fire-and-forget, so the app works normally when either server is unreachable.

## Configuration

Set per EAS build profile in `eas.json` (`preview`, `production`; `preview-simulator` inherits
`preview`). The PostHog key and the Sentry DSN are public client identifiers — they only allow
sending data in — so they live in `eas.json`, never in source.

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_POSTHOG_KEY` | shared PostHog project key |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://posthog.qodeinvest.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | the `qode-app` DSN |
| `EXPO_PUBLIC_APP_ENV` | `production` / `preview` → Sentry `environment` and the PostHog `environment` property |
| `SENTRY_DISABLE_AUTO_UPLOAD` | `true` for now — see *Source maps* |
| `SENTRY_AUTH_TOKEN` | **secret**, EAS secret only — never in the repo |
| `EXPO_PUBLIC_TELEMETRY_SELFTEST` | `1` only in the `telemetry-selftest` profile — see *Sending a test event* |

**Release.** Sentry's release and dist come from the native app: `com.qodeinvest.oneview@<version>+<build number>`,
the same value the build tags uploaded source maps with, so an error names the exact TestFlight/Play build.

### Source maps (readable stack traces)

Wired but switched off, because without a token the Android build fails the upload step.
To turn it on, once:

1. In Sentry: User settings → Auth Tokens → create one with `project:releases`, `project:read`, `org:read`.
2. `npx eas-cli secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>` (for local
   builds, export `SENTRY_AUTH_TOKEN` in the shell instead).
3. Delete `SENTRY_DISABLE_AUTO_UPLOAD` from both profiles in `eas.json`.

## Events

Every event carries `app` (`qode-oneview-app`), `platform` (`ios`/`android`), `app_version` and
`environment` (registered once as PostHog super-properties).

Automatic: PostHog's `Application Installed` / `Opened` / `Backgrounded` / `Updated`, and a
`$screen` for every route change (the route path, e.g. `/holdings` — never data).

From the shared naming standard:

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `signup_started` | The registration screen opens | `method: phone_otp` | `useTelemetry` (route `/register`) |
| `signup_completed` | A session starts while on the registration screen | `method` | `useTelemetry` |
| `login_succeeded` | A session starts (not a restore at launch) | `method` | `useTelemetry` |
| `portfolio_viewed` | The Performance dashboard is shown to a signed-in customer | — | `useTelemetry` (route `/performance`) |
| `risk_profile_completed` | The risk questionnaire is submitted | `risk_band`: top recommended strategy (`QAW`/`QTF`/`QGF`) | `risk-profile.tsx` |
| `factsheet_downloaded` | The portfolio review PDF is saved/shared | `product: portfolio_review` | `reports.tsx` |
| `support_contacted` | A WhatsApp contact is opened (incl. "Book a call") | `channel: whatsapp` | `reports.tsx`, `BuildingReview.tsx` |

Not sent, because the app has no such flow: `kyc_*`, `product_viewed`, `call_booked` (the "Book a
call" button only opens WhatsApp, so it's `support_contacted`), `lead_submitted`, `investment_*`,
`sip_started`, `withdrawal_requested`.

Login/signup events are derived from the auth session and the route, so no authentication code was
changed to send them.

### Adding an event

1. Add it to `TelemetryEvents` in `src/lib/telemetry.ts` with its properties — `track()` won't
   compile for unknown names or wrong properties.
2. Call `track('event_name', { ... })` where it happens. Use the shared standard's name if one fits;
   don't invent names without agreeing them with the analytics owner.
3. Never put PAN, Aadhaar, bank/card numbers, phone, email, names or portfolio values in properties.
4. Add a row to the table above.

## Identifying users

The backend keys customers by phone (`custId = "<phone>@finvu"`), which must never be an analytics
ID. Instead qode-oneview's `GET /api/mobile/identity` returns `{ data: { analyticsId } }` — an HMAC
of the customer ID with a server-side secret (`ANALYTICS_ID_SECRET`): stable, not reversible, and
the same ID other Qode apps can use.

- On login and when a saved session is restored at launch: fetch it, then `posthog.identify(id)` and
  Sentry `setUser({ id })` — id only, no person properties yet.
- On sign-out: `posthog.reset()` and Sentry `setUser(null)`.
- If the endpoint isn't live (or returns no ID), the user simply stays anonymous — nothing breaks.
- Demo mode is never identified.
- Sentry events are tagged `posthog_distinct_id`, so an error can be traced to the person's activity.

## Privacy

- Sentry: `sendDefaultPii: false`; request bodies, cookies and query strings are dropped; headers,
  extras, breadcrumbs and messages are scrubbed of PAN, Aadhaar, card/account/phone numbers,
  emails, ₹ amounts and any key naming credentials, identity or portfolio data; the device's own
  name is removed; the user context keeps its `id` only.
- PostHog: touch autocapture is **off** (it would record on-screen text such as holdings and
  values) and session replay is **off**.
- Deleting a person's data on request: delete the person in PostHog (Persons → the analytics ID →
  Delete person and events) and in Sentry (the user's issues/events by `user.id`). Look up the
  analytics ID via qode-oneview (`analyticsIdFor(custId)`).

## Sending a test event

Build the `telemetry-selftest` profile (an iOS simulator release build with
`EXPO_PUBLIC_TELEMETRY_SELFTEST=1`; EAS only reads build variables from the profile, not the shell):

```sh
npx eas-cli build -p ios --profile telemetry-selftest --local --output telemetry-test.tar.gz
tar xzf telemetry-test.tar.gz && xcrun simctl install booted QodeOneView.app && xcrun simctl launch booted com.qodeinvest.oneview
```

Within a few seconds of launch it sends:

- PostHog: `telemetry_test_sent` (Activity view; filter `app = qode-oneview-app`)
- Sentry: an error "Telemetry test error (qode-oneview-app) — safe to ignore" in project `qode-app`

Never ship a store build with the self-test on.
