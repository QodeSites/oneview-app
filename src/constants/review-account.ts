/**
 * The App Store / Play Store review account — hardcoded on purpose.
 *
 * Store reviewers sign in with these on a production build (they go in the
 * "App Review Information" / "App access" notes in each store console).
 * qode-oneview accepts this pair in code (`REVIEW_PHONE`/`REVIEW_CODE` in its
 * src/lib/otp.ts) and never sends an SMS for it. Mirror any change there.
 *
 * The number has no real portfolio behind it, so after sign-in the app shows
 * its built-in demo portfolio (src/lib/demo.ts) — with the "Demo data" badge
 * — instead of an empty dashboard. Nothing here is a secret: the code only
 * ever opens this one number.
 */
export const REVIEW_PHONE = '9999999999';
export const REVIEW_OTP = '123456';

export function isReviewPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').slice(-10) === REVIEW_PHONE;
}
