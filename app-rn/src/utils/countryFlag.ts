/**
 * Convert a 2-letter ISO country code (e.g. "MY", "CN", "US") to its emoji
 * flag via regional-indicator symbols. Returns '' for anything that isn't a
 * clean 2-letter code, so callers can safely concatenate.
 */
export function countryCodeToFlag(code?: string | null): string {
  if (!code) return '';
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 'A'.charCodeAt(0)),
  );
}
