const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

/**
 * Verifies the Bearer token and attaches req.user (full document).
 */
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await User.findById(payload.sub).select('-password');
  if (!user) return res.status(401).json({ error: 'User not found' });

  // Permanent ban / soft-deletion — freeze the account on every authenticated
  // request. The client treats code:BANNED as a forced logout. Admins are never
  // banned, so this can't lock out moderation. isDeleted is included so a
  // soft-deleted account can no longer act (was able to create votes/spam).
  if (user.isBanned || user.isDeleted) {
    return res.status(403).json({ error: 'Account banned', code: 'BANNED' });
  }

  req.user = user;

  // Throttled liveness for REST-only sessions (socket connect/disconnect also
  // maintains this). Bump lastActiveAt at most ~once per 2 min. Fire-and-forget
  // — must never block or fail the request.
  const STALE_MS = 2 * 60 * 1000;
  if (!user.lastActiveAt || Date.now() - new Date(user.lastActiveAt).getTime() > STALE_MS) {
    User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
  }

  // Daily-login streak (STREAK1) — fire-and-forget; writes at most once/day and
  // never throws, so it can't slow or break the request.
  require('../utils/streak').touchStreak(user).catch(() => {});

  next();
}

/**
 * Lightweight auth that does NOT hit MongoDB — attaches payload only.
 * Use for high-frequency routes where full user doc is not needed.
 */
function authLight(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.userPayload = jwt.verify(header.slice(7), env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { auth, authLight };
