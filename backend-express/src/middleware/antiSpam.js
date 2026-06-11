/**
 * Anti-spam Phase 1 — message rate limits, duplicate detection, account-age
 * gradient, and IP-based signup limits. Backed by `lib/rateStore` (Redis when
 * configured, in-memory otherwise).
 *
 * These are NOT express middlewares — they're called inline at the top of a
 * route handler and, when they trip, write the 4xx response and return `true`
 * so the caller can `if (await x(...)) return;`.
 *
 * Limit numbers live in one place (`LIMITS`) so free/premium tiers stay in
 * sync across routes. Premium users get a 2–3x multiplier; premium does NOT
 * relax account-age gates (that would enable a buy-then-spam pattern).
 */

const crypto = require('crypto');
const store = require('../lib/rateStore');
const { isPremiumActive } = require('../utils/premium');

// ── Limit table ───────────────────────────────────────────────────────────────
// Each tier is a list of windows: [keySuffix, max, windowSec]. windowSec=null
// means "no expiry" (lifetime cap — best-effort under the in-memory fallback).
const LIMITS = {
  plazaMsg: {
    free: [['plaza-msg-min', 5, 60], ['plaza-msg-hr', 20, 3600]],
    premium: [['plaza-msg-min', 10, 60], ['plaza-msg-hr', 60, 3600]],
  },
  plazaRoomCreate: {
    free: [['room-create-day', 1, 86400], ['room-create-life', 5, null]],
    premium: [['room-create-day', 3, 86400], ['room-create-life', 30, null]],
  },
  photo: {
    free: [['photo-hr', 3, 3600], ['photo-day', 20, 86400]],
    premium: [['photo-hr', 6, 3600], ['photo-day', 60, 86400]],
  },
  moment: {
    free: [['moment-hr', 3, 3600], ['moment-day', 10, 86400]],
    premium: [['moment-hr', 6, 3600], ['moment-day', 30, 86400]],
  },
  comment: {
    free: [['comment-min', 10, 60], ['comment-hr', 50, 3600]],
    premium: [['comment-min', 20, 60], ['comment-hr', 100, 3600]],
  },
  dm: {
    free: [['dm-min', 30, 60]],
    premium: [['dm-min', 60, 60]],
  },
};

/**
 * Increment+check one Redis-style sliding counter.
 * @returns {{ok:boolean, retryAfter:number, remaining:number}}
 */
async function rateLimit(req, key, max, windowSec) {
  const fullKey = `rl:${req.user._id}:${key}`;
  const count = await store.incr(fullKey);
  if (count === 1 && windowSec != null) await store.expire(fullKey, windowSec);
  if (count > max) {
    const retryAfter = windowSec == null ? -1 : await store.ttl(fullKey);
    return { ok: false, retryAfter: retryAfter < 0 ? windowSec ?? 0 : retryAfter, remaining: 0 };
  }
  return { ok: true, retryAfter: 0, remaining: max - count };
}

/**
 * Apply a feature's full limit set (all windows for the user's tier). On the
 * first window that trips, writes a 429 and returns true.
 *
 * @param {keyof LIMITS} feature
 * @returns {Promise<boolean>} true if the request was rate-limited (response sent)
 */
async function enforceRateLimit(req, res, feature) {
  const spec = LIMITS[feature];
  if (!spec) return false;
  const windows = isPremiumActive(req.user) ? spec.premium : spec.free;
  for (const [key, max, windowSec] of windows) {
    const r = await rateLimit(req, key, max, windowSec);
    if (!r.ok) {
      if (r.retryAfter > 0) res.set('Retry-After', String(r.retryAfter));
      res.status(429).json({ error: 'RATE_LIMITED', code: 'RATE_LIMITED', retryAfter: r.retryAfter });
      return true;
    }
  }
  return false;
}

// ── Duplicate-message detection ────────────────────────────────────────────────
// Hash the last 5 messages per user; reject if the new hash already appears in
// that recent window (spammers re-posting identical content). 5-min memory.
async function enforceNoDuplicate(req, res, content) {
  const text = String(content || '').trim().toLowerCase();
  if (!text) return false;
  const userId = req.user._id.toString();
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  const listKey = `recent:${userId}`;

  const recent = await store.lrange(listKey, 0, 4);
  if (recent.includes(hash)) {
    res.status(429).json({ error: 'DUPLICATE_MESSAGE', code: 'DUPLICATE_MESSAGE' });
    return true;
  }
  await store.lpush(listKey, hash);
  await store.ltrim(listKey, 0, 4);
  await store.expire(listKey, 300);
  return false;
}

// ── Account-age gradient ────────────────────────────────────────────────────────
/** @returns {boolean} true if the account is at least `requiredHours` old. */
function enforceAccountAge(user, requiredHours) {
  if (!user?.createdAt) return true; // be permissive if timestamp is missing
  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  return ageMs >= requiredHours * 3600 * 1000;
}

/**
 * Gate a route behind a minimum account age. On failure writes a 403 with a
 * countdown and returns true. Premium does NOT bypass this.
 * @returns {Promise<boolean>|boolean} true if blocked (response sent)
 */
function enforceAccountAgeOr403(req, res, requiredHours) {
  if (enforceAccountAge(req.user, requiredHours)) return false;
  const ageMs = Date.now() - new Date(req.user.createdAt).getTime();
  const waitHours = Math.ceil((requiredHours * 3600000 - ageMs) / 3600000);
  res.status(403).json({
    error: 'ACCOUNT_TOO_YOUNG',
    code: 'ACCOUNT_TOO_YOUNG',
    requiredAgeHours: requiredHours,
    waitHours,
  });
  return true;
}

// ── IP-based signup limit ───────────────────────────────────────────────────────
// Max 3 signups per IP per 24h. Uses req.ip (Express trust-proxy aware).
const SIGNUP_IP_MAX = 3;
const SIGNUP_IP_WINDOW = 24 * 3600;

async function enforceSignupIpLimit(req, res) {
  const ip =
    (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip || req.socket?.remoteAddress;
  if (!ip) return false; // can't identify IP → don't block legit users
  const ipKey = `signup:ip:${ip}`;
  const count = await store.incr(ipKey);
  if (count === 1) await store.expire(ipKey, SIGNUP_IP_WINDOW);
  if (count > SIGNUP_IP_MAX) {
    const retryAfter = await store.ttl(ipKey);
    res.set('Retry-After', String(retryAfter > 0 ? retryAfter : SIGNUP_IP_WINDOW));
    res.status(429).json({
      error: 'TOO_MANY_SIGNUPS_FROM_IP',
      code: 'TOO_MANY_SIGNUPS_FROM_IP',
      retryAfter: retryAfter > 0 ? retryAfter : SIGNUP_IP_WINDOW,
    });
    return true;
  }
  return false;
}

module.exports = {
  LIMITS,
  rateLimit,
  enforceRateLimit,
  enforceNoDuplicate,
  enforceAccountAge,
  enforceAccountAgeOr403,
  enforceSignupIpLimit,
};
