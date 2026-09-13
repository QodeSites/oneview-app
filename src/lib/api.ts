import Constants from 'expo-constants';

/**
 * Real calls to qode-oneview's own auth API — `/api/auth/send`, `/verify`,
 * `/register`, `/logout` — used exactly as the web app uses them, unmodified.
 *
 * Deliberately NOT a second backend living inside mobile-app: qode-oneview's
 * dev database is the real production database, and its SMS provider costs
 * real money per message to real customers. Re-implementing that logic here
 * (a second copy of the session secret, the DB connection, the 2Factor key,
 * without qode-oneview's existing rate-limiting) would be new, untested code
 * with direct production access. Calling the existing, already-safety-tested
 * routes over HTTP instead means this file never sees a single secret.
 *
 * The OTP challenge and the session are both plain httpOnly cookies
 * (src/lib/otp-challenge.ts, src/lib/session.ts in qode-oneview), set with
 * `secure: NODE_ENV === "production"` — false in local dev, so they work
 * over plain HTTP. React Native's networking layer (OkHttp on Android,
 * NSURLSession on iOS) persists cookies across requests the same way a
 * browser does, so send -> verify -> register carries the right cookie
 * forward automatically; nothing here manages cookies by hand.
 */

/**
 * Resolves qode-oneview's address for local development.
 *
 * `EXPO_PUBLIC_API_BASE_URL` (set in `.env`, e.g. `http://192.168.1.50:3171`)
 * wins when present — required for a real device, since "localhost" from a
 * phone means the phone itself, not the dev machine.
 *
 * Failing that, this reuses whatever LAN host Metro itself is already
 * bound to (`Constants.expoConfig.hostUri`, e.g. "192.168.1.50:8081") and
 * swaps in qode-oneview's own port — the phone is already talking to that
 * exact machine to load the app, so this needs no separate configuration
 * in the common case of "both dev servers running on the same laptop."
 */
const QODE_ONEVIEW_PORT = 3171;

function resolveDevHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.hostUri ?? null;
  if (!hostUri) return null;
  const withoutPath = hostUri.split('/')[0] ?? '';
  const host = withoutPath.split(':')[0];
  return host || null;
}

export function getApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const host = resolveDevHost();
  if (host) return `http://${host}:${QODE_ONEVIEW_PORT}`;

  return `http://localhost:${QODE_ONEVIEW_PORT}`;
}

async function postJson<T extends { error?: string }>(
  path: string,
  body: unknown,
): Promise<{ status: number; data: Partial<T> }> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: 0,
      data: { error: 'Could not reach the server. Check your connection and try again.' } as Partial<T>,
    };
  }
  const data = (await res.json().catch(() => ({}))) as Partial<T>;
  return { status: res.status, data };
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

/** Real call to `POST /api/auth/send` — sends a real SMS via 2Factor. */
export async function sendOtp(phone: string): Promise<SendOtpResult> {
  const { data } = await postJson<{ ok?: boolean; error?: string }>('/api/auth/send', { phone });
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? 'Something went wrong.' };
}

export type VerifyOtpResult =
  | { status: 'ok'; registered: boolean }
  | { status: 'wrong'; message: string };

/**
 * Real call to `POST /api/auth/verify`. The phone is never sent — it comes
 * from the signed challenge cookie `send` set, exactly like the web app.
 * `registered` decides sign-in vs. the "no account yet" branch; any other
 * failure (wrong code, expired challenge, rate limit, too many attempts)
 * comes back as `status: 'wrong'` with the server's own message, which is
 * more specific than a single generic "that code doesn't match."
 */
export async function verifyOtp(otp: string): Promise<VerifyOtpResult> {
  const { data } = await postJson<{ ok?: boolean; registered?: boolean; error?: string }>('/api/auth/verify', {
    otp,
  });
  if (data.ok) return { status: 'ok', registered: !!data.registered };
  return { status: 'wrong', message: data.error ?? 'That code did not match. Check the SMS and try again.' };
}

export type RegisterResult = { ok: true } | { ok: false; error: string };

/** Real call to `POST /api/auth/register` — needs the session cookie `verify` already set. */
export async function registerAccount(name: string, email: string): Promise<RegisterResult> {
  const { data } = await postJson<{ ok?: boolean; error?: string }>('/api/auth/register', { name, email });
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? 'We could not save that. Try again.' };
}

/** Real call to `POST /api/auth/logout` — clears the real session cookie server-side. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Best-effort: the local session (src/lib/auth.tsx) is cleared regardless.
  }
}
