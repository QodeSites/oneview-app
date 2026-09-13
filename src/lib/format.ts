/**
 * Ported from qode-oneview/src/features/review/format.ts — same en-IN
 * grouping, same "undefined is null, never zero" rule (every function takes
 * `number | null` and renders DASH for null, never a fabricated 0).
 */

const GROUPED = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const DASH = '—';

/** Full rupees, no paise: ₹92,31,847 */
export function rupees(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return `₹${GROUPED.format(Math.round(n))}`;
}

/** Money, written out in full — same as rupees() here (no lakh/crore shorthand). */
export function money(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  const r = Math.round(n);
  return `${r < 0 ? '−' : ''}₹${GROUPED.format(Math.abs(r))}`;
}

/** Percent with a forced sign: +25.17% · −9.52% */
export function signedPct(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}%`;
}

/** Percent without a forced sign: 16.89% */
export function pct(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return `${n.toFixed(digits)}%`;
}

/** "7 Sept 2026" — same en-GB day/short-month/year format as the web app. */
export function dayLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Sept 25" — chart x-axis tick, same as qode-oneview's monthLabel. */
export function monthLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${String(d.getUTCFullYear()).slice(2)}`;
}

/**
 * A y-axis tick — grouped en-IN digits above 1,000 (rupees), plain below
 * (rebased-to-100 index points, where grouping would be nonsense). Same
 * split as qode-oneview's own axisTick.
 */
const AXIS_GROUPED = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export function axisTick(v: number): string {
  if (Math.abs(v) < 1e3) return String(Math.round(v));
  return AXIS_GROUPED.format(Math.round(v));
}

/** Rounds a [min, max] span to ~`count` evenly-spaced "nice" tick values. */
export function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min || 1;
  const raw = span / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= max + step * 0.5; v += step) out.push(Number(v.toFixed(4)));
  return out;
}
