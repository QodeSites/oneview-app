# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Testing over mobile data (not the same Wi-Fi as this machine)

This app talks to a separate backend, **qode-oneview**, running locally on
`localhost:3171`. On the same Wi-Fi, `npx expo start` finds it automatically
— nothing below applies. If your phone is on mobile data (or a different
network) instead, you need `--tunnel` for Metro itself, **and** a second,
separate tunnel just for qode-oneview, since Expo's own tunnel only proxies
Metro's bundler port, not other ports on this machine.

### One-time setup already done

`mobile-app/.env` (gitignored, not committed) holds
`EXPO_PUBLIC_API_BASE_URL` — the URL the app calls instead of
auto-detecting a LAN IP. `src/lib/api.ts`'s `getApiBaseUrl()` reads this
first, before anything else.

### Every time you restart the qode-oneview tunnel (the URL is ephemeral)

The tunnel below is a Cloudflare "quick tunnel" — free, no account, but a
**brand new random URL every time the process restarts**, including if
your machine sleeps/reboots or you close the terminal it's running in.
When that happens the app can't reach qode-oneview and shows "Could not
reach the server" even though qode-oneview itself is fine.

**1. Make sure qode-oneview is actually running:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3171/
```
Expect `200`. If not, start it first (`npm run dev` in `qode-oneview/`).

**2. Start a fresh tunnel to it**, in its own terminal (leave it running):
```bash
npx cloudflared tunnel --url http://localhost:3171
```
Wait for a box in the output containing a URL like:
```
https://<random-words>.trycloudflare.com
```

**3. Put that URL in `mobile-app/.env`:**
```
EXPO_PUBLIC_API_BASE_URL=https://<random-words>.trycloudflare.com
```
(Overwrite the old value — it's dead now.)

**4. Restart Metro** (`npx expo start --tunnel`) — env vars are read once at
bundler startup, so a hot reload won't pick up the new value; a full
restart of the Expo process is required. Then reload the app on your phone.

Skip all of this — and delete `.env` entirely — once you're back on the
same Wi-Fi as this machine; `getApiBaseUrl()` finds the LAN IP on its own
with no tunnel needed at all.

## Analytics and error tracking

Release builds report to the self-hosted PostHog (product analytics) and Sentry (errors). Keys are set
per build profile in `eas.json`; nothing is sent from development builds. Events, identity, privacy
rules and how to send a test event: [docs/analytics.md](docs/analytics.md).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
