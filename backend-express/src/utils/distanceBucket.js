/**
 * Coarse distance buckets — Apple Guideline 5.1.2(i).
 *
 * Meyou never returns a precise distance (and never returns raw coordinates)
 * for another user. Every user-facing distance is collapsed into one of four
 * wide buckets before it leaves the server, so an API response can't be
 * trilaterated back into a location the way a metre-accurate value can.
 *
 * The bucket KEY is the contract the v2 client renders (localised in the app);
 * the label is a plain-ASCII fallback so older shipped clients — which print
 * `distance` / `distanceLabel` verbatim — also show a coarse value rather than
 * a precise one. Both must stay in sync.
 *
 * See docs/apple-review-nearby-response.md.
 */

/** Bucket boundaries in metres. Ascending, last bucket is unbounded. */
const BUCKETS = [
  { key: 'lt1', maxMeters: 1000, label: '< 1 km' },
  { key: '1to5', maxMeters: 5000, label: '1-5 km' },
  { key: '5to10', maxMeters: 10000, label: '5-10 km' },
  { key: 'gt10', maxMeters: Infinity, label: '> 10 km' },
];

/**
 * @param {number|null|undefined} meters
 * @returns {'lt1'|'1to5'|'5to10'|'gt10'|null}
 */
function distanceBucket(meters) {
  if (meters == null || Number.isNaN(meters)) return null;
  return BUCKETS.find((b) => meters < b.maxMeters).key;
}

/**
 * Human-readable coarse label. Used for the legacy `distance` /
 * `distanceLabel` string fields that already-shipped clients render as-is.
 * @param {number|null|undefined} meters
 * @returns {string|null}
 */
function distanceBucketLabel(meters) {
  if (meters == null || Number.isNaN(meters)) return null;
  return BUCKETS.find((b) => meters < b.maxMeters).label;
}

/**
 * Quantized metre value for the `distanceM` field the list screens sort on
 * (Friends / Viewers / 想认识你 / Matches). Those lists sort client-side, so the
 * server has to hand over *something* ordered — but a true metre value there is
 * the same trilateration leak the buckets exist to close, just on a different
 * endpoint. Collapsing to one representative value per bucket keeps
 * nearest-first ordering at bucket granularity and leaks nothing finer.
 * Ordering within a bucket becomes arbitrary, which is the intended trade.
 * @param {number|null|undefined} meters
 * @returns {number|null}
 */
const BUCKET_SORT_METERS = { lt1: 500, '1to5': 3000, '5to10': 7500, gt10: 15000 };
function bucketSortMeters(meters) {
  const key = distanceBucket(meters);
  return key == null ? null : BUCKET_SORT_METERS[key];
}

module.exports = {
  distanceBucket,
  distanceBucketLabel,
  bucketSortMeters,
  BUCKETS,
};
