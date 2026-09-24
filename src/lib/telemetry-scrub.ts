/**
 * Strips personal and financial data from everything bound for Sentry
 * (event payloads, request bodies, headers, breadcrumbs), per the company
 * analytics standard and the DPDP Act: PAN, Aadhaar, bank account, card,
 * phone, email, password, tokens/OTPs/cookies, and portfolio values/holdings.
 *
 * Pure functions with no SDK imports, so they're unit-tested directly
 * (telemetry-scrub.test.ts).
 */

export const REDACTED = '[redacted]';

/** Any key containing one of these is dropped wholesale, whatever its value. */
const SENSITIVE_KEY =
  /pan|aadha?ar|account|acct|ifsc|card|cvv|phone|mobile|msisdn|email|password|passwd|pwd|otp|token|secret|cookie|authorization|auth|session|dob|birth|boid|bo_id|folio|demat|holding|portfolio|value|amount|balance|nav|pnl|networth|net_worth|name|address/i;

const PATTERNS: [RegExp, string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[pan]'],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}(?:[ -]?\d{4})?\b/g, '[number]'], // Aadhaar (12) / card (16)
  [/\+?\d[\d -]{8,}\d/g, '[number]'], // phone numbers, account numbers
  [/₹\s?[\d,]+(?:\.\d+)?/g, '[amount]'],
];

export function scrubText(text: string): string {
  return PATTERNS.reduce((s, [re, sub]) => s.replace(re, sub), text);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

interface ScrubbableEvent {
  message?: string;
  request?: { data?: unknown; headers?: unknown; cookies?: unknown; query_string?: unknown; url?: string };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
  user?: { id?: string | number; [k: string]: unknown };
}

/** Returns the same event with sensitive fields removed. The user context keeps its `id` only. */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  try {
    if (event.message) event.message = scrubText(event.message);
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
      if (event.request.headers) event.request.headers = scrubValue(event.request.headers);
      if (event.request.url) event.request.url = scrubText(event.request.url.split('?')[0]);
    }
    if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
    if (event.contexts) {
      // Device/OS/app contexts are debugging gold and not personal — except the
      // device's own name, which is often the owner's ("Sanket's iPhone").
      const device = event.contexts.device as Record<string, unknown> | undefined;
      if (device && 'name' in device) device.name = REDACTED;
      for (const key of Object.keys(event.contexts)) {
        if (!['device', 'os', 'app', 'runtime', 'trace', 'react_native_context', 'expo'].includes(key)) {
          event.contexts[key] = scrubValue(event.contexts[key]);
        }
      }
    }
    event.breadcrumbs?.forEach((b) => {
      if (b.message) b.message = scrubText(b.message);
      if (b.data) b.data = scrubValue(b.data) as Record<string, unknown>;
    });
    event.exception?.values?.forEach((v) => {
      if (v.value) v.value = scrubText(v.value);
    });
    if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  } catch {
    // A scrub failure must not leak the raw event either: drop what can hold user data.
    delete event.request;
    delete event.extra;
    delete event.breadcrumbs;
  }
  return event;
}
