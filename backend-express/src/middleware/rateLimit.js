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

/**
 * Signup / OTP send-otp limiter — a COARSE anti-abuse backstop only.
 *
 * WARNING (learned the hard way, vc128): this is keyed by IP, and `send-otp` is
 * the FIRST step of BOTH email registration AND email OTP-login. The previous
 * `max: 3` per hour blocked legitimate users almost immediately:
 *   • a single user tapping "resend" or bouncing back into the screen re-fires
 *     send-otp, so one honest sign-in easily costs 2-3 requests;
 *   • many real users share one IP (office / campus Wi-Fi, and especially mobile
 *     carrier CGNAT where thousands egress through a handful of addresses) — they
 *     all draw from the SAME per-IP budget, so 3/hr is exhausted by a few people.
 * Google / Apple sign-in never hits send-otp, so ONLY email users were affected —
 * which is exactly the "email signup/login is broken but social login is fine"
 * report this fixes.
 *
 * The precise per-account control is the per-email 30s cooldown inside the
 * send-otp handler (routes/auth.js) — that, plus the requirement to receive the
 * emailed code, is what actually stops per-address spam. This IP limiter exists
 * only to cap a script fan-out (one IP cycling many addresses / email-bombing),
 * so it can be generous: 100/hr/IP is far above any real human or shared-IP use
 * yet still trips on runaway automation.
 */
const signupLimiter = createLimiter({
  windowMs: HOUR,
  max: 100,
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
