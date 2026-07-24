/**
 * Dotted-numeric version compare (no semver dep). Handles "3.1.16" vs "3.1.9"
 * correctly (9 < 16), tolerates differing segment counts and junk segments.
 *
 *   compareVersions('3.1.9', '3.1.16')  // -1  (a < b)
 *   compareVersions('3.2',   '3.1.16')  //  1  (a > b)
 *   compareVersions('3.1.16','3.1.16')  //  0
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** true when a is strictly older than b. */
export const isOlder = (a: string, b: string) => compareVersions(a, b) < 0;
