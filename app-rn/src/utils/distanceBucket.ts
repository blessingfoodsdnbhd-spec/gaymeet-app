import type { TFunction } from 'i18next';

/**
 * Coarse distance buckets — Apple Guideline 5.1.2(i).
 *
 * The server never sends a precise distance for another user; it sends one of
 * these four bucket keys (see backend-express/src/utils/distanceBucket.js).
 * Keys must stay in sync with the backend's BUCKETS table.
 */
export type DistanceBucket = 'lt1' | '1to5' | '5to10' | 'gt10';

const KEYS: readonly DistanceBucket[] = ['lt1', '1to5', '5to10', 'gt10'];

function isBucket(v: unknown): v is DistanceBucket {
  return typeof v === 'string' && (KEYS as readonly string[]).includes(v);
}

/**
 * Localised label for a card's distance.
 *
 * Prefers the structured `distanceBucket` key. Falls back to the server's
 * plain-ASCII `distanceLabel` ("1-5 km") so a client running against an older
 * backend still renders something sane rather than a blank tile — and returns
 * null when there's nothing to show, since callers gate on truthiness.
 */
export function distanceBucketLabel(
  t: TFunction,
  bucket: unknown,
  fallbackLabel?: string | null,
): string | null {
  if (isBucket(bucket)) return t(`discover.distance.${bucket}`);
  return fallbackLabel || null;
}
