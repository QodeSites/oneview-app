import { describeHttpError, fetchWithTimeout, getApiBaseUrl } from '@/lib/api';
import {
  DEMO_CAP_ANALYSIS_PAYLOAD,
  DEMO_HOLDINGS_PAYLOAD,
  DEMO_PERFORMANCE_PAYLOAD,
  DEMO_PROFILE_DATA,
  DEMO_RISK_PROFILE_ANSWERS,
  DEMO_REVIEW_FETCH_FAILED_PAYLOAD,
  DEMO_REVIEW_PAYLOAD,
  DEMO_VSI_PAYLOAD,
  getDemoScenario,
  isDemoActive,
} from '@/lib/demo';
import { mockReviewData, type ReviewData, type Series, type WealthGap } from '@/lib/mock-data';
import { notifySessionExpired } from '@/lib/session-events';

/**
 * Real calls to qode-oneview's new, read-only `GET /api/mobile/*` routes
 * (MOBILE_BACKEND_CHANGES.md has the full list and what each one wraps).
 * Every route mirrors the exact composition its corresponding
 * each corresponding `src/app/review/.../page.tsx` already does — this file is a thin JSON
 * client for that, not a second copy of any business logic.
 *
 * Typed loosely against `ReviewData` (mock-data.ts's own type, built to
 * mirror qode-oneview's real contract) rather than qode-oneview's actual
 * TypeScript source — these are two separate projects with no shared
 * types, so exact field-for-field parity isn't guaranteed. Screens should
 * keep reading fields defensively (optional chaining, `DASH` fallbacks —
 * the pattern every screen already uses for a `null` value) rather than
 * assume this type is airtight.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, { method: 'GET', credentials: 'include' });
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  // Every route here requires a real session (qode-oneview's `requireSession()`).
  // A 401 means the server-side session cookie is gone even though this
  // device's local `session` flag still says signed-in — e.g. the server
  // restarted, or the app switched between dev builds with separate cookie
  // jars. Without this, every screen just shows "The server returned an
  // error (401)" with a "Try again" that retries the same dead session
  // forever — the reader's only way out was finding Sign out manually.
  // See session-events.ts / auth.tsx for the automatic recovery.
  if (res.status === 401) notifySessionExpired();
  if (!res.ok || body.error) {
    return { ok: false, error: body.error ?? describeHttpError(res.status) };
  }
  if (body.data === undefined) {
    return { ok: false, error: 'The server did not return any data.' };
  }
  return { ok: true, data: body.data };
}

export interface PerformancePayload {
  data: ReviewData;
  /**
   * The Journey chart's actual data — qode-oneview's `recommendedMixSeries`,
   * up to 3 legs (client "Your portfolio", strategy "Your Qode Mix",
   * benchmark "BSE 500"), confirmed field-for-field identical to
   * mock-data.ts's own `Series` shape by reading the source directly.
   * `data.performance` (the field this was first — wrongly — read from) is
   * permanently hardcoded `null` everywhere in qode-oneview, real accounts
   * and demo alike; it's dead code left over from before the real web
   * Performance screen was rewritten to read this field instead (reported
   * 15 Sep: Journey chart, Three Roads and the Wealth Gap card all
   * silently missing for every account, because that gate could never
   * pass). Matching web's own gate exactly: `mix.length >= 2`.
   */
  mix: Series[] | null;
  /** `qode-oneview`'s real `WealthGap` — confirmed field-for-field identical to mock-data.ts's own `WealthGap` type by reading the source directly. */
  gap: WealthGap | null;
  /**
   * The same "still building the first analysis" state `/api/mobile/review`
   * exposes (`AnalysisState`, below) — securities held, and no stored
   * analysis, a partial one, or one still missing a comparison curve.
   * `null` is not a real case here (the backend always computes it), kept
   * only to match `ReviewPayload.analysis`'s own optional shape.
   *
   * Was a plain `calculating: boolean` (`!payload && analysisPending`),
   * which went false the instant ANY stored row existed, partial or not —
   * so this screen's own "Still building your review" banner disappeared
   * on the next silent refresh while the allocation donut and totals
   * underneath, built from that same partial data, stayed on screen
   * (reported 17 Sep). The screen now gates its ENTIRE dashboard on this
   * field, the same way `app-tabs.tsx`'s top-level gate does — never a
   * banner floating over data that isn't ready yet.
   */
  analysis: AnalysisState | null;
  savedAnswers: unknown;
  todayValue: number;
  outcome: unknown;
  alerts: unknown;
}

export interface CapAnalysisPayload {
  data: ReviewData;
  /** See `PerformancePayload.analysis` — same field, same fix (17 Sep). */
  analysis: AnalysisState | null;
}

export interface HoldingsPayload {
  data: ReviewData;
  casUploadEnabled: boolean;
  have: { funds: boolean; shares: boolean };
}

/**
 * qode-oneview's real `ProfileData` (src/features/review/profile.ts) —
 * copied here field-for-field since mobile-app's own mock `profile` shape
 * (mock-data.ts) drifted from it (e.g. mock has `custId`, the real type
 * doesn't expose one on this endpoint; real has `whatsappOptIn`/`source`/
 * `deletionRequestedAt` the mock never modeled). `null` means "nothing on
 * file yet," not a zero/empty string — pass it through, never invent a
 * placeholder for it.
 */
export interface RealProfileData {
  name: string | null;
  phone: string;
  panMasked: string | null;
  email: string | null;
  whatsappOptIn: boolean;
  source: string;
  memberSince: string | null;
  sources: { label: string; kind: string; count: number; lastSeen: string | null }[];
  holdingsCount: number;
  bankAccountCount: number;
  analysisAt: string | null;
  riskProfileAt: string | null;
  deletionRequestedAt: string | null;
}

/**
 * Whether this customer has ever linked anything, per qode-oneview's own
 * `Presence.isEmpty`/`ConsentFacts` (src/features/presence/types.ts) — the
 * same facts `src/app/review/layout.tsx` gates on to show `NothingYet`
 * instead of a zeroed-out dashboard. Trimmed to just the three booleans
 * the mobile gate needs (`src/components/NothingYet.tsx`), not the full
 * per-asset-class `Presence` object.
 */
export interface PresenceSummary {
  isEmpty: boolean;
  hasConsent: boolean;
  everDelivered: boolean;
}

/**
 * A customer whose consent exists but hasn't delivered yet — mid-fetch, not
 * "never linked" and not "linked, found nothing". qode-oneview's own
 * `review/layout.tsx` sends this customer to `BuildingReview` (a wait
 * screen), never to `NothingYet` — collapsing this into the same
 * `presence.isEmpty` gate as the other two states produced the wrong claim
 * ("your accounts reported no holdings") for someone whose data simply
 * hasn't arrived. `null` outside that state.
 */
export interface BuildingState {
  /** ISO timestamp the wait should measure its elapsed clock against. `null` when neither source has one. */
  startedAt: string | null;
}

/**
 * The first analysis after holdings arrive. While `building` is true the
 * dashboard isn't ready (charts and values still missing), so the app shows
 * "Building your review" instead of the tabs — same rule as web's layout.
 * `done`/`total` are the engine stages finished so far. `null` when the
 * account has no holdings yet.
 */
export interface AnalysisState {
  building: boolean;
  done: number;
  total: number;
  startedAt: string | null;
}

export interface ReviewPayload {
  data: ReviewData;
  presence: PresenceSummary;
  building: BuildingState | null;
  /** Optional: a server without this field never reports a build in progress. */
  analysis?: AnalysisState | null;
}

export function getReview(): Promise<ApiResult<ReviewPayload>> {
  if (isDemoActive()) {
    const payload = getDemoScenario() === 'fetch-failed' ? DEMO_REVIEW_FETCH_FAILED_PAYLOAD : DEMO_REVIEW_PAYLOAD;
    return Promise.resolve({ ok: true, data: payload });
  }
  return getJson<ReviewPayload>('/api/mobile/review');
}

export function getPerformance(): Promise<ApiResult<PerformancePayload>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_PERFORMANCE_PAYLOAD });
  return getJson<PerformancePayload>('/api/mobile/performance');
}

export function getCapAnalysis(): Promise<ApiResult<CapAnalysisPayload>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_CAP_ANALYSIS_PAYLOAD });
  return getJson<CapAnalysisPayload>('/api/mobile/cap-analysis');
}

export function getHoldingsData(): Promise<ApiResult<HoldingsPayload>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_HOLDINGS_PAYLOAD });
  return getJson<HoldingsPayload>('/api/mobile/holdings');
}

export function getMfXrayData(): Promise<ApiResult<ReviewData>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: mockReviewData });
  return getJson<ReviewData>('/api/mobile/mf-xray');
}

export function getReportsData(): Promise<ApiResult<ReviewData>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: mockReviewData });
  return getJson<ReviewData>('/api/mobile/reports');
}

export function getProfileData(): Promise<ApiResult<RealProfileData | null>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_PROFILE_DATA });
  return getJson<RealProfileData | null>('/api/mobile/profile');
}

/**
 * qode-oneview's real `getStrategyAnswers(custId)` — six saved answers (each
 * 1-5, indexing into `strategy-scoring.ts`'s option scale) or `null` when
 * nothing's been saved yet. Confirmed against `src/features/review/
 * strategy-answers.ts` and the route it backs, `/api/mobile/risk-profile`.
 */
export function getRiskProfileData(): Promise<ApiResult<number[] | null>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_RISK_PROFILE_ANSWERS });
  return getJson<number[] | null>('/api/mobile/risk-profile');
}

export interface VsiPoint {
  date: string;
  value: number | null;
}

export interface VsiSeriesEntry {
  segment: string;
  points: VsiPoint[];
}

/**
 * `GET /api/mobile/vsi` — qode-oneview's proxy for qode360's Market Breadth
 * indicator (web's `/review/vsi`, branch `feature/vsi-indicator`). Market-
 * wide, not derived from this customer's own holdings — `notReady` mirrors
 * the upstream service's own "not computed yet for this combination" state,
 * distinct from a real fetch failure (which instead comes back as
 * `ok: false` from `getJson`, same as every other route here).
 */
export interface VsiPayload {
  series: VsiSeriesEntry[];
  notReady: boolean;
}

export function getVsiIndicator(): Promise<ApiResult<VsiPayload>> {
  if (isDemoActive()) return Promise.resolve({ ok: true, data: DEMO_VSI_PAYLOAD });
  return getJson<VsiPayload>('/api/mobile/vsi');
}
