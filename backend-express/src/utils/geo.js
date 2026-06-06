/** Great-circle distance in meters between two [lng, lat] pairs, or null. */
function haversineMeters(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return null;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  if (lat1 === 0 && lng1 === 0) return null; // unset origin
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Human display string for a distance in meters, or null. */
function formatDist(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

module.exports = { haversineMeters, formatDist };
