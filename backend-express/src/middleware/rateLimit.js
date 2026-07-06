/**
 * Simple in-memory rate limiter (no external deps).
 * Keyed by IP address by default; a custom keyGenerator (e.g. per-user) can be
 * supplied. Each limiter namespaces its keys with `prefix` so independent
 * limiters never collide in the shared store. Resets after windowMs ms.
 *
 * Note: the store is per-process/in-memory. On a single Render instance this is
 * exact; if the backend is ever scaled to multiple instances the effective
 * limit becomes max × instances (still fine as a coarse anti-spam guard). Swap
 * in a Redis-backed store here if strict cross-instance limits are needed.
 */

const store = new Map(); // key → { count, resetAt }

/** Real client IP behind Cloudflare/Render. */
function clientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function createLimiter({ windowMs, max, message, keyGenerator, prefix = '' }) {
  const genKey = typeof keyGenerator === 'function' ? keyGenerator : clientIp;
  return function rateLimit(req, res, next) {
    const key = prefix + genKey(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message || 'Too many requests' });
    }

    next();
  };
}

const HOUR = 60 * 60 * 1000;

// ── Pre-built limiters ────────────────────────────────────────────────────────

/** Global: 10000 requests per 15 minutes */
const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: 'Too many requests, please try again later.',
});

/** Auth routes: 10000 attempts per 15 minutes */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: 'Too many login attempts, please try again in 15 minutes.',
});

/** Signup / OTP: 3 send-otp requests per IP per hour (anti mass-account bots). */
const signupLimiter = createLimiter({
  windowMs: HOUR,
  max: 3,
  prefix: 'signup:',
  message: '注册请求过频，请稍后再试 / Too many signup attempts, please wait an hour.',
});

// Vote-creation limits are enforced in the route handler itself (1/day per user,
// 5/day per IP → auto-ban), not via a generic hourly limiter — see routes/votes.js.

module.exports = {
  globalLimiter,
  authLimiter,
  signupLimiter,
  createLimiter,
};
