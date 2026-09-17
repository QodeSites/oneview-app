import { mockReviewData } from '@/lib/mock-data';
import type {
  CapAnalysisPayload,
  HoldingsPayload,
  PerformancePayload,
  PresenceSummary,
  RealProfileData,
  ReviewPayload,
} from '@/lib/reviewApi';

/**
 * A local, no-network "demo mode" — dev-only equivalent of qode-oneview's
 * own QA impersonate feature (`/internal/qa/impersonate`, gated behind
 * `CRON_SECRET`). That mechanism mints a REAL session cookie for a REAL
 * seeded account by checking a shared server secret — replicating it here
 * would mean shipping that production secret inside the mobile app's
 * bundle, a real leak (anyone can extract strings from an APK/IPA). qode-
 * oneview already has the right pattern for a client-side, no-secrets
 * preview: `src/features/review/demo.ts`'s `demoReview()`, a static,
 * synthetic dataset with zero backend dependency, used to power its own
 * public `/sample` marketing page. This module is that same idea, reusing
 * mobile-app's own pre-existing `mock-data.ts` (already shaped to mirror
 * qode-oneview's real contract, and already what every screen rendered
 * before this project was wired to real data) rather than re-deriving
 * qode-oneview's invented holdings from scratch.
 *
 * Entry point: a `__DEV__`-only "View demo" link on the login screen
 * (src/app/login.tsx) — never reachable in a production build, matching
 * the real feature's own internal-only posture.
 */

let active = false;

export function isDemoActive(): boolean {
  return active;
}

export function setDemoActive(value: boolean): void {
  active = value;
}

export const DEMO_PRESENCE: PresenceSummary = {
  isEmpty: false,
  hasConsent: true,
  everDelivered: true,
};

export const DEMO_REVIEW_PAYLOAD: ReviewPayload = {
  data: mockReviewData,
  presence: DEMO_PRESENCE,
  building: null,
};

export const DEMO_PERFORMANCE_PAYLOAD: PerformancePayload = {
  data: mockReviewData,
  // The Journey chart's real data — qode-oneview's `recommendedMixSeries`,
  // 3 legs (client/strategy/benchmark). `mockReviewData.mixBlend` (a
  // Sleeve[] percentage blend) was wrongly used here before `mix`'s real
  // shape was confirmed (reported 15 Sep) — that field answers a different
  // question entirely and was never what the chart reads.
  mix: mockReviewData.performance?.journey ?? null,
  gap: mockReviewData.gap,
  calculating: false,
  savedAnswers: null,
  todayValue: mockReviewData.totals.portfolio,
  outcome: null,
  alerts: mockReviewData.alerts,
};

export const DEMO_CAP_ANALYSIS_PAYLOAD: CapAnalysisPayload = {
  data: mockReviewData,
  calculating: false,
};

export const DEMO_HOLDINGS_PAYLOAD: HoldingsPayload = {
  data: mockReviewData,
  casUploadEnabled: true,
  have: { funds: true, shares: true },
};

export const DEMO_PROFILE_DATA: RealProfileData = {
  name: mockReviewData.profile.name,
  phone: mockReviewData.profile.phone,
  panMasked: mockReviewData.profile.panMasked,
  email: mockReviewData.profile.email,
  whatsappOptIn: true,
  source: 'demo',
  memberSince: mockReviewData.profile.memberSince,
  sources: mockReviewData.profile.sources.map((s) => ({ ...s })),
  holdingsCount: mockReviewData.profile.holdingsCount,
  bankAccountCount: mockReviewData.profile.bankAccountCount,
  analysisAt: mockReviewData.profile.analysisAt,
  riskProfileAt: mockReviewData.profile.riskProfileAt,
  deletionRequestedAt: null,
};

/**
 * Six plausible answers (1-5 each) rather than reusing `mock-data.ts`'s own
 * `riskProfile.underFiveCr`/`fiveCrPlus` — those are hand-fabricated final
 * allocation percentages, not the raw answer array qode-oneview's real
 * `getStrategyAnswers` returns. Feeding these through the app's own real,
 * ported `calculateScores`/`calculateTopTwo` (src/lib/strategy-scoring.ts)
 * produces a genuine allocation split the same way a real saved answer set
 * would, rather than a second, disconnected set of invented percentages.
 */
export const DEMO_RISK_PROFILE_ANSWERS: number[] = [4, 3, 2, 4, 3, 3];
