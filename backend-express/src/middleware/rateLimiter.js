const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for auth endpoints (login / register).
 * 200 attempts per 15 minutes per IP/user.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many attempts — please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => (req.user && req.user.id) ? `user_${req.user.id}` : req.ip,
});

/**
 * General API limiter — guards all /api routes.
 * 200 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests — please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for sensitive write operations
 * (coin purchase, gift send, subscription purchase).
 * 20 requests per minute per IP.
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded — please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, strictLimiter };
