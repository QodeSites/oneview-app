# Shipping fixes fast

Store review takes hours to days. Most fixes shouldn't wait for it. Pick the fastest tool that fits:

| Problem | Fastest fix | Time to users |
|---|---|---|
| A feature is broken or risky | Flip its **kill switch** in PostHog | seconds |
| Wrong data, calculation or copy that comes from the API | **Backend deploy** (qode-oneview) | minutes |
| Bug in the app's JS/TS, styles or images | **OTA update** (EAS Update) | minutes; applies on next app start |
| Native change (new SDK/module, permissions, `app.json` native config, Expo SDK upgrade) | **Store build** — staged rollout, expedited review if critical | hours–days |
| A released build is broken and users must leave it | **Force update** (`minimumBuild`) | at next launch |

## 1. Kill switches (PostHog feature flags)

`src/lib/remote-flags.ts` → `useKillSwitch('<feature>')`. In PostHog → Feature flags, a flag
named `kill_<feature>` switched **on** (100% rollout) hides that feature for everyone within seconds;
switch it off to restore. Fails open: if PostHog is unreachable or flags haven't loaded, the
feature stays on.

Current switches:

| Flag | Hides |
|---|---|
| `kill_vsi` | the VSI tab's charts (shows "temporarily unavailable") |
| `kill_report_download` | the review PDF download on Reports |

Add one: extend the `KillSwitch` type, call `useKillSwitch()` in the screen and render a calm
fallback, create the flag in PostHog (off), and add a row here. Ship new risky features behind one.
Flags can also target a percentage or a cohort (e.g. internal testers first).

Flags work in release builds only (PostHog is off in development builds).

## 2. Push logic to the backend

The app is already mostly a thin client over qode-oneview's `/api/mobile/*`. Anything that can be
computed server-side should be — a backend deploy is minutes, with no review. Known candidates still in
the app: the risk-profile scoring (`src/lib/strategy-scoring.ts`) and the welcome screen's sample
numbers (`src/components/welcome/PreviewCard.tsx`). Prompts for these live in the PR description.

## 3. OTA updates (EAS Update)

Installed builds check for an update on every cold start and when returning after 30+ minutes in the
background (`src/lib/ota.ts`); a downloaded update applies at the **next** start, never mid-session.

**What can ship OTA:** anything in JS/TS, styles, images and fonts bundled by Metro.
**What can't:** native code or config — new native modules, `app.json` native settings, permissions,
Expo SDK upgrades. `runtimeVersion` uses the `fingerprint` policy, so a native change automatically
produces a new runtime and an OTA update can never land on a build it's incompatible with — those
changes simply need a store build.

Apple and Google allow this as long as the update doesn't change the app's primary purpose (App Store
Review Guideline 3.3.1(b)/2.5.2 for interpreted code). Bug fixes and tweaks are fine; don't use OTA to
add major new features that would have needed review.

Publish (from a clean checkout of the commit you want to ship):

```sh
# to the production builds' channel, 10% of users first
npx eas-cli update --channel production --message "Fix VSI tooltip dates" --rollout-percentage 10
# widen after checking Sentry for new errors
npx eas-cli update:edit            # raise the rollout percentage
# roll back
npx eas-cli update:republish       # republish the previous good update
npx eas-cli update:roll-back-to-embedded   # or return everyone to the build's own bundle
```

Channels: `production` (store/TestFlight builds), `preview`, `development` — set per profile in
`eas.json`. Only builds made **after** expo-updates was added can receive updates.

## 4. Web views for volatile screens

Not used yet. Good candidates if they start changing often: onboarding/marketing copy, offers,
content pages. Render them from qode-oneview (`react-native-webview` is already installed) so copy
changes are a backend deploy. Keep anything with portfolio data native.

## 5. Staged rollouts

- **App Store:** App Store Connect → the version → *Phased Release for Automatic Updates* — 1%, 2%,
  5%, 10%, 20%, 50%, 100% over 7 days; pause anytime (up to 30 days).
- **Google Play:** Play Console → Production → Create release → set a rollout percentage (e.g. 10%);
  *Halt rollout* stops it; raise the percentage when Sentry looks clean.
- **OTA:** `--rollout-percentage` above.

Watch Sentry (`qode-app`, filter by release) before widening any of them.

## 6. Expedited review (Apple)

For a critical bug in a live build that OTA can't fix: App Store Connect → Contact Us → *Request an
expedited app review* (https://developer.apple.com/contact/app-store/?topic=expedite). Describe the
user-facing impact concretely. Usually reviewed within hours; use sparingly — Apple tracks frequency.
Google Play reviews for an established app are usually under a day; there is no expedite form.

## 7. Force update

qode-oneview's `GET /api/mobile/app-version` drives the in-app update prompt (`src/lib/app-update.ts`,
`UpdatePrompt.tsx`):

- `latestVersion` — shows a dismissible "update available" card.
- `minimumVersion` — below it, a blocking "update required" screen.
- `minimumBuild: { ios, android }` — below that native build number, the same blocking screen. Use this
  to retire one bad build when the version name hasn't changed.

Only raise the minimum once the fixed build is **live in the store** for that platform, or users are
sent to a store page with nothing newer.
