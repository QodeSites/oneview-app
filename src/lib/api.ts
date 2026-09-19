import Constants from 'expo-constants';

import { isDemoActive } from '@/lib/demo';
import { notifySessionExpired } from '@/lib/session-events';

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
 * `EXPO_PUBLIC_API_BASE_URL` (set in `.env`, or in `eas.json`'s own
 * `build.<profile>.env` for a cloud build — .env is gitignored and never
 * reaches EAS) wins when present — required for a real device, since
 * "localhost" from a phone means the phone itself, not the dev machine.
 *
 * Failing that, this reuses whatever LAN host Metro itself is already
 * bound to (`Constants.expoConfig.hostUri`, e.g. "192.168.1.50:8081") and
 * swaps in qode-oneview's own port — the phone is already talking to that
 * exact machine to load the app, so this needs no separate configuration
 * in the common case of "both dev servers running on the same laptop."
 *
 * Last resort — production, not `localhost`. `hostUri` is only ever set
 * inside a live Metro/dev-client session; a standalone build (TestFlight,
 * a shared preview .apk/.app) never has one, so a build that somehow
 * shipped without its `env` block baked in used to fall all the way
 * through to `http://localhost:3171` — the *device's own* loopback, with
 * nothing listening on it, guaranteed to fail every request with "Could
 * not reach the server" and no way to tell why (reported 18 Sep, on an
 * iOS Simulator build that turned out to predate `eas.json` gaining its
 * `preview` profile's `env` block — commit b53f486, 17 Sep). A build
 * genuinely missing its own config should still reach something real.
 */
const QODE_ONEVIEW_PORT = 3171;
const PRODUCTION_API_BASE_URL = 'https://oneview.qodeinvest.com';

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

  return PRODUCTION_API_BASE_URL;
}

/**
 * A phone that can't reach qode-oneview at all (wrong Wi-Fi, a firewall
 * silently dropping the connection, the dev server not running) doesn't
 * get a fast "connection refused" — the OS just leaves the TCP handshake
 * pending, which without an explicit deadline means `fetch` never resolves
 * or rejects. Every caller below is awaited from a button's `busy` state
 * (`sending`, `signOut`, pull-to-refresh), so an unreachable server would
 * otherwise spin that button forever with no error ever surfacing. This
 * caps every request so a network problem always becomes a visible error
 * within a bounded time instead of a silent, permanent hang.
 */
const REQUEST_TIMEOUT_MS = 12000;

/**
 * Longer deadlines for the statement-recovery routes below (`uploadCas
 * Statement`, `startDematFetch`, `verifyDematOtp`, `requestCamsStatement`).
 * These proxy to qode360's real PDF parser or to CDSL itself, which
 * qode-oneview's own routes declare generous `maxDuration`s for — 120s for
 * `cas/upload` and `demat/verify` (reading and parsing a whole statement),
 * 90s for `demat/fetch` (CDSL's captcha solve, "about 20 seconds" typically
 * but not guaranteed), 60s for `cas/generate` (filling the camsonline
 * form). Forcing the short `REQUEST_TIMEOUT_MS` deadline onto a route whose
 * own server explicitly expects to run that long would abort a request
 * that was still genuinely working, turning a real eventual success into a
 * false "check your connection" error.
 */
const CAS_GENERATE_TIMEOUT_MS = 45000;
const DEMAT_FETCH_TIMEOUT_MS = 75000;
const DEMAT_VERIFY_TIMEOUT_MS = 100000;
const CAS_UPLOAD_TIMEOUT_MS = 100000;
// No documented `maxDuration` on the real route (checked directly against
// its source) — it isn't flagged as a slow route the way the CAS/demat
// routes explicitly are, but it does two DB reads plus a full PDF render
// on every request, never cached, so this still gets a generous timeout
// rather than the 12s default.
const REPORT_PDF_TIMEOUT_MS = 45000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A friendly fallback for an HTTP failure that came back with no `error`
 * field of its own — a route that threw before it could compose a JSON
 * body (DB down, an uncaught exception, a proxy/gateway timeout) rather
 * than one that deliberately rejected the request. Every route that DOES
 * reject on purpose already sends its own specific `error` text (checked
 * directly against qode-oneview's route source — e.g. `/api/auth/send`'s
 * real rate limiter says "Too many requests. Try again after 5 minutes.")
 * and that always wins over this; this is only what a reader sees when
 * the server gave nothing more specific to show.
 */
export function describeHttpError(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return 'That could not be found.';
  if (status === 429) return 'Too many requests. Try again after 5 minutes.';
  if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return 'Something went wrong. Please try again.';
}

async function postJson<T extends { error?: string }>(
  path: string,
  body: unknown,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<{ status: number; data: Partial<T> }> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${getApiBaseUrl()}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch {
    return {
      status: 0,
      data: { error: 'Could not reach the server. Check your connection and try again.' } as Partial<T>,
    };
  }
  const data = (await res.json().catch(() => ({}))) as Partial<T>;
  // A 401 on an authenticated call (webview-handoff, strategy-answers —
  // send/verify/register are never authenticated, so never hit this) means
  // the real server-side session is gone even though this device's local
  // `session` flag still says signed-in. See session-events.ts.
  if (res.status === 401) notifySessionExpired();
  return { status: res.status, data };
}

/**
 * `retryAfterSeconds` is present only on a 429 (the OTP-send rate limit) —
 * `/api/auth/send`'s own real limiter response carries it (added 16 Sep,
 * alongside a real `Retry-After` header the fetch-based client here never
 * read). Without it, the "too many attempts" error had no way to know when
 * it should stop being true, and just sat on screen forever (reported 16
 * Sep) — this is what `login.tsx` now uses to clear it automatically once
 * the real window has actually passed, instead of only on a manual retry.
 */
export type SendOtpResult = { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

/** Real call to `POST /api/auth/send` — sends a real SMS via 2Factor. */
export async function sendOtp(phone: string): Promise<SendOtpResult> {
  const { status, data } = await postJson<{ ok?: boolean; error?: string; retryAfterSeconds?: number }>(
    '/api/auth/send',
    { phone },
  );
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? describeHttpError(status), retryAfterSeconds: data.retryAfterSeconds };
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
  const { status, data } = await postJson<{ ok?: boolean; registered?: boolean; error?: string }>(
    '/api/auth/verify',
    { otp },
  );
  if (data.ok) return { status: 'ok', registered: !!data.registered };
  // A genuine HTTP-level failure (rate limit, server error, expired
  // challenge session) gets its status-appropriate message; a 200 with no
  // error text is the one case that really does just mean a wrong code.
  const message = data.error ?? (status >= 400 ? describeHttpError(status) : 'That code did not match. Check the SMS and try again.');
  return { status: 'wrong', message };
}

export type RegisterResult = { ok: true } | { ok: false; error: string };

/** Real call to `POST /api/auth/register` — needs the session cookie `verify` already set. */
export async function registerAccount(name: string, email: string): Promise<RegisterResult> {
  const { status, data } = await postJson<{ ok?: boolean; error?: string }>('/api/auth/register', { name, email });
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? describeHttpError(status) };
}

/** Real call to `POST /api/auth/logout` — clears the real session cookie server-side. */
export async function logout(): Promise<void> {
  try {
    await fetchWithTimeout(`${getApiBaseUrl()}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Best-effort: the local session (src/lib/auth.tsx) is cleared regardless.
  }
}

export type HandoffResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Real call to `POST /api/mobile/webview-handoff` (SPEC-mobile-linking.md's
 * "cookie bridge") — mints a one-time, ~60s code identifying the already
 * signed-in customer, so the WebView that runs the real FinVU `/link` flow
 * can authenticate without ever putting the long-lived session cookie or a
 * bearer token in a URL the WebView loads (which would sit in WebView
 * history/logs). See src/app/link.tsx.
 */
export async function requestLinkHandoff(): Promise<HandoffResult> {
  const { status, data } = await postJson<{ handoffCode?: string; error?: string }>('/api/mobile/webview-handoff', {});
  if (data.handoffCode) return { ok: true, code: data.handoffCode };
  return { ok: false, error: data.error ?? describeHttpError(status) };
}

/**
 * The URL the WebView actually loads: `GET /api/mobile/link-entry`, which
 * consumes the handoff code, sets the same session cookie a normal web
 * sign-in would, and redirects into qode-oneview's real, unmodified `/link`
 * page — from that point on it's an ordinary `/link`-in-a-browser session.
 *
 * `force` passes straight through the handoff route's own passthrough
 * (see its comment) onto `/link?force=1` — the same re-entry flag qode-
 * oneview's web `NothingYet` uses for "link ANOTHER account" when consent
 * already exists but reported no holdings, rather than reusing the same
 * consent that just came back empty.
 */
export function getLinkEntryUrl(code: string, options?: { force?: boolean }): string {
  const base = `${getApiBaseUrl()}/api/mobile/link-entry?handoff=${encodeURIComponent(code)}`;
  return options?.force ? `${base}&force=1` : base;
}

/**
 * Real, best-effort call to `POST /api/review/strategy-answers` — the same
 * existing, unmodified route the web `PersonalizedRecommendation` component
 * posts to after computing a recommendation. Auth is the session cookie
 * (`requireSession()` there), same as every other route in this file; no new
 * qode-oneview file was needed for this one. A failed save costs a
 * re-answer next visit, never an error in front of the recommendation —
 * matching the web component's own comment on this call.
 */
export async function saveStrategyAnswers(answers: number[]): Promise<void> {
  try {
    await fetchWithTimeout(`${getApiBaseUrl()}/api/review/strategy-answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ answers }),
    });
  } catch {
    // Best-effort, see comment above.
  }
}

/**
 * Real calls to qode-oneview's own self-serve statement-recovery routes —
 * `/api/cas/upload`, `/api/cas/generate`, `/api/demat/fetch`,
 * `/api/demat/verify`, `/api/inbound-address`, `/api/review/completeness`
 * — the same routes `src/components/review/CasUpload.tsx` calls on the web
 * app, unmodified. Every one of them authenticates via `requireSession()`
 * off the same `oneview_session` cookie every other call in this file
 * relies on; identity always comes from that session, never from anything
 * this file sends in a request body (confirmed against each route's own
 * source — see the comment on each function below for the exact contract).
 *
 * See src/app/upload-statement.tsx for the screen these back. Whether the
 * feature should even be offered (`casUploadEnabled`) and which of the two
 * registrar families are actually missing (`have.funds`/`have.shares`)
 * both already come back on `GET /api/mobile/holdings` — see
 * `HoldingsPayload` in reviewApi.ts — so there is no separate gate call
 * here; the screen reads those two fields off the same `getHoldingsData()`
 * every other holdings-aware screen already calls.
 */

export type SimpleApiResult = { ok: true } | { ok: false; error: string };

export interface CasUploadInput {
  /** The picked file's local URI (from `expo-document-picker`), e.g. `file:///...`. */
  uri: string;
  name: string;
  /** Optional password, usually the customer's PAN in capitals. */
  password?: string;
}

/**
 * Real call to `POST /api/cas/upload` — a manual CAS/demat PDF upload,
 * multipart, so this can't reuse `postJson` (JSON-only). Mirrors the web
 * `UploadForm`'s own request exactly: a `file` field and an optional
 * `password` field, no explicit `Content-Type` header (see below).
 *
 * React Native's `FormData` accepts a plain `{ uri, name, type }` object in
 * place of a real browser `File`/`Blob` for a file field — its own
 * networking layer reads the file at `uri` and streams it as the
 * multipart part. This is the documented RN-specific shape, not a bug
 * worked around here.
 *
 * No `Content-Type` header is set on the request itself: `fetch` needs to
 * compute its own multipart boundary from the `FormData` body, and a
 * hand-set `multipart/form-data` header (without that boundary parameter)
 * would leave the server unable to parse the body at all.
 *
 * The server's own failure messages already distinguish a bad password
 * from an unreadable file from "no holdings found" (see `cas/upload`'s
 * route comment) — that specific text is surfaced as-is; only a
 * status-with-no-body or a network failure falls back to a generic
 * message here.
 */
/**
 * Every real write action on upload-statement.tsx (this one included) needs
 * a real, signed-in custId to save a result against — unlike a plain read
 * (getInboundAddress's own fix), there's no fake response that would mean
 * anything here, the way "Link another account" also can't be simulated in
 * demo mode. Short-circuiting before the network call, rather than letting
 * it go out for real and 401, avoids the same confusing "session expired"
 * bounce that call used to cause (reported 19 Sep, once getInboundAddress
 * was already fixed — this is the same gap, one step further in).
 */
const DEMO_ACTION_ERROR = 'Not available in demo mode — this needs a real signed-in account.';

export async function uploadCasStatement(input: CasUploadInput): Promise<SimpleApiResult> {
  if (isDemoActive()) return { ok: false, error: DEMO_ACTION_ERROR };
  const form = new FormData();
  form.append('file', { uri: input.uri, name: input.name, type: 'application/pdf' } as unknown as Blob);
  if (input.password) form.append('password', input.password);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${getApiBaseUrl()}/api/cas/upload`,
      { method: 'POST', credentials: 'include', body: form },
      CAS_UPLOAD_TIMEOUT_MS,
    );
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (res.status === 401) notifySessionExpired();
  if (res.ok && data.ok) return { ok: true };
  return { ok: false, error: data.error ?? describeHttpError(res.status) };
}

/**
 * Real call to `POST /api/cas/generate` — asks CAMS+KFintech to mail the
 * customer a Detailed CAS via the camsonline.com form, filled server-side.
 * The password is the customer's own choice, reused later to open the
 * mailed PDF through `uploadCasStatement` — never sent anywhere else.
 * Fire-and-forget on CAMS's end: a 200 here just means the request was
 * accepted, not that the email has arrived yet.
 */
export async function requestCamsStatement(email: string, password: string): Promise<SimpleApiResult> {
  if (isDemoActive()) return { ok: false, error: DEMO_ACTION_ERROR };
  const { status, data } = await postJson<{ ok?: boolean; error?: string }>(
    '/api/cas/generate',
    { email, password },
    CAS_GENERATE_TIMEOUT_MS,
  );
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? describeHttpError(status) };
}

export type DematFetchResult = { ok: true; sessionId: string } | { ok: false; error: string };

/**
 * Real call to `POST /api/demat/fetch` — stage 1 of the in-app CDSL fetch:
 * BO ID + PAN + date of birth in, a `sessionId` back once CDSL has agreed
 * to send an OTP. `dob` must already be `YYYY-MM-DD` (the route's own
 * regex check rejects anything else); the screen's date picker is
 * responsible for that shape, not this function.
 */
export async function startDematFetch(input: { pan: string; boId: string; dob: string }): Promise<DematFetchResult> {
  if (isDemoActive()) return { ok: false, error: DEMO_ACTION_ERROR };
  const { status, data } = await postJson<{ ok?: boolean; sessionId?: string; error?: string }>(
    '/api/demat/fetch',
    input,
    DEMAT_FETCH_TIMEOUT_MS,
  );
  if (data.sessionId) return { ok: true, sessionId: data.sessionId };
  return { ok: false, error: data.error ?? describeHttpError(status) };
}

/**
 * Real call to `POST /api/demat/verify` — stage 2: the OTP CDSL sent,
 * plus the same `sessionId` and `pan` from stage 1. `pan` is included
 * (not just `sessionId`/`otp`) because qode-oneview's own route retries
 * the parse once with the PAN as a password when a CDSL statement turns
 * out to be protected — matching the web `CdslFetch` component's own
 * request body exactly. This can run long (the server proxies a real
 * fetch-and-parse), hence `DEMAT_VERIFY_TIMEOUT_MS`.
 */
export async function verifyDematOtp(input: {
  sessionId: string;
  otp: string;
  pan: string;
}): Promise<SimpleApiResult> {
  if (isDemoActive()) return { ok: false, error: DEMO_ACTION_ERROR };
  const { status, data } = await postJson<{ ok?: boolean; error?: string }>(
    '/api/demat/verify',
    input,
    DEMAT_VERIFY_TIMEOUT_MS,
  );
  if (data.ok) return { ok: true };
  return { ok: false, error: data.error ?? describeHttpError(status) };
}

export type InboundAddressResult = { ok: true; address: string } | { ok: false; error: string };

/**
 * Real call to `GET /api/inbound-address` — the signed-in customer's own
 * personal forwarding address (minted on first ask), so they can forward
 * any CAS they receive by email instead of using any of the other flows.
 * The route itself returns `{ ok: false }` with a 200 status (not an
 * error) when no address could be minted; callers should treat that the
 * same as any other failure to fetch one — quietly not offering the
 * forward-by-email section, never as a scary error banner, since this is
 * the least essential of the four recovery paths.
 */
/** Demo mode has no real customer to mint a real forwarding address for. */
const DEMO_INBOUND_ADDRESS = 'demo-portfolio@inbound.qodeinvest.com';

export async function getInboundAddress(): Promise<InboundAddressResult> {
  // Every other getXxx in reviewApi.ts branches on isDemoActive() before
  // ever calling the network; this one didn't, so it was the one call
  // upload-statement.tsx makes that still went out for real under a demo
  // session — no real cookie, so a real 401, which the app's global
  // session-expiry handler (session-events.ts) correctly treated as "the
  // real session died," signing out and bouncing to login (reported 19
  // Sep, from both the fetch-failed demo screen AND the pre-existing
  // "View demo" button's own Upload holdings entry — not new to either).
  if (isDemoActive()) return { ok: true, address: DEMO_INBOUND_ADDRESS };
  let res: Response;
  try {
    res = await fetchWithTimeout(`${getApiBaseUrl()}/api/inbound-address`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; address?: string; error?: string };
  if (res.status === 401) notifySessionExpired();
  if (res.ok && data.ok && data.address) return { ok: true, address: data.address };
  return { ok: false, error: data.error ?? describeHttpError(res.status) };
}

/**
 * Real, best-effort call to `POST /api/review/completeness` with
 * `{ answer: "uploaded" }` — same pattern as `saveStrategyAnswers` above:
 * qode-oneview's own route always returns `{ ok: true }` even internally
 * (see its own comment — a malformed/failed write there still means "they
 * pressed the button"), and by the time this fires the reader has already
 * gotten their real result (a successful upload/fetch). A failed save here
 * should never block navigating back to the dashboard.
 */
export async function markReviewUploaded(): Promise<void> {
  try {
    await fetchWithTimeout(`${getApiBaseUrl()}/api/review/completeness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ answer: 'uploaded' }),
    });
  } catch {
    // Best-effort, see comment above.
  }
}

export type ReportPdfResult = { ok: true; base64: string } | { ok: false; error: string };

/**
 * Real call to `GET /api/review/report.pdf` — the exact same PDF web's own
 * "Download report" button opens (confirmed against `Reports.tsx`: a
 * plain `<a href="/api/review/report.pdf" target="_blank">`, letting the
 * browser's native PDF viewer handle saving it — there is no separate
 * mobile format or route). Session-cookie-scoped to the signed-in
 * customer exactly like every other call in this file; no cookie bridge
 * needed the way `/link`'s WebView flow needs one, since this is a plain
 * `fetch` carrying the same session every other call here already does.
 *
 * Read via `Response.blob()` + `FileReader.readAsDataURL`, not
 * `.arrayBuffer()` — RN's `FileReader` already produces a base64 data URL
 * directly, exactly the shape `expo-file-system`'s `writeAsStringAsync`
 * needs to write it back out as a real file; hand-rolling an ArrayBuffer-
 * to-base64 conversion would just reimplement what `FileReader` already
 * does correctly.
 */
export async function fetchReportPdf(): Promise<ReportPdfResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${getApiBaseUrl()}/api/review/report.pdf`,
      { method: 'GET', credentials: 'include' },
      REPORT_PDF_TIMEOUT_MS,
    );
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
  if (res.status === 401) {
    notifySessionExpired();
    return { ok: false, error: describeHttpError(401) };
  }
  if (!res.ok) {
    return { ok: false, error: describeHttpError(res.status) };
  }
  const blob = await res.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the downloaded report.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      // `readAsDataURL` yields "data:application/pdf;base64,<the bytes>" —
      // only the part after the comma is the base64 payload itself.
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(blob);
  }).catch(() => '');
  if (!base64) return { ok: false, error: 'Could not read the report. Try again.' };
  return { ok: true, base64 };
}
