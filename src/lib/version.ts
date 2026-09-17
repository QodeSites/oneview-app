/**
 * Compares dotted version strings ("1.2.10" vs "1.10.0") numerically, part by
 * part; missing parts count as 0, so "1.2" equals "1.2.0". Anything that is
 * not a number is treated as 0 rather than throwing — a malformed version
 * from the server must never crash the update check.
 *
 * Returns a negative number when `a < b`, 0 when equal, positive when `a > b`.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
