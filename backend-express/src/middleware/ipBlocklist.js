const BlockedIp = require('../models/BlockedIp');

/**
 * Rejects requests from blocked IPs with 403. Reads `req.clientIp` (set by the
 * recordIp middleware). Results are cached per-IP for 60s to avoid a DB hit on
 * every request. FAILS OPEN: any DB/model error lets the request through rather
 * than taking the whole API down.
 */
const cache = new Map(); // ip → { ts, blocked }
const CACHE_TTL = 60 * 1000;

module.exports = async function ipBlocklist(req, res, next) {
  const ip = req.clientIp || req.ip;
  if (!ip) return next();

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.blocked) return res.status(403).json({ error: 'IP blocked', code: 'IP_BLOCKED' });
    return next();
  }

  try {
    const hit = await BlockedIp.exists({ ip });
    cache.set(ip, { ts: Date.now(), blocked: !!hit });
    if (hit) return res.status(403).json({ error: 'IP blocked', code: 'IP_BLOCKED' });
    return next();
  } catch (_e) {
    // Fail open — never let a blocklist lookup error break the API.
    return next();
  }
};
