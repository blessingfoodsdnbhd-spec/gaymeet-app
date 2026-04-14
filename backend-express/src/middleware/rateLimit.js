/**
 * Simple in-memory rate limiter (no external deps).
 * Keyed by IP address.  Resets after windowMs milliseconds.
 */

const store = new Map(); // ip → { count, resetAt }

function createLimiter({ windowMs, max, message }) {
  return function rateLimit(req, res, next) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
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

// ── Pre-built limiters ────────────────────────────────────────────────────────

/** Global: 100 requests per 15 minutes */
const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});

/** Auth routes: 5 attempts per 15 minutes */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again in 15 minutes.',
});

module.exports = { globalLimiter, authLimiter, createLimiter };
