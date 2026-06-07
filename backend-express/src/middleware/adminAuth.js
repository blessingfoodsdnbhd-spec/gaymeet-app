const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

/**
 * Admin authorization — shared by every /api/admin/* route.
 *
 * Accepted credentials (any one grants access):
 *   1. X-Admin-Token header == process.env.ADMIN_TOKEN  (machine / curl path,
 *      the original gate — unchanged for backward compat).
 *   2. A valid Bearer JWT for an official account (user.isOfficial === true),
 *      so Meyou 官方 / meyou-bot can manage announcements from the app.
 *   3. A valid Bearer JWT whose user.email is in ADMIN_EMAILS  (backup human
 *      admins, so the announcement manager works from the phone with no token).
 *
 * ADMIN_EMAILS is a comma-separated allowlist, compared case-insensitively:
 *   ADMIN_EMAILS=blessingfoodsdnbhd@gmail.com,someone@else.com
 */

/** Parsed, lowercased admin email allowlist (recomputed each call so env
 *  changes on the platform take effect without a code redeploy). */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True if the user may access admin routes. Either:
 *   - the account is an official account (isOfficial === true), so Meyou 官方
 *     (meyou-bot) can post announcements without being in the email allowlist; OR
 *   - the user's email is in the ADMIN_EMAILS allowlist (backup human admins).
 */
function isAdminUser(user) {
  if (!user) return false;
  if (user.isOfficial === true) return true;
  const email = (user.email || '').trim().toLowerCase();
  if (!email) return false;
  return adminEmails().includes(email);
}

/**
 * Express middleware. Passes if EITHER the admin token matches OR the request
 * carries a valid JWT for an allowlisted admin email. On the JWT path it
 * attaches req.user so downstream handlers can use it.
 */
async function requireAdminAuth(req, res, next) {
  // ── Path 1: machine token ───────────────────────────────────────────────
  const token = req.headers['x-admin-token'];
  if (token) {
    if (!process.env.ADMIN_TOKEN) {
      return res
        .status(503)
        .json({ error: 'Admin endpoint disabled — ADMIN_TOKEN env var not set' });
    }
    if (token === process.env.ADMIN_TOKEN) return next();
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── Path 2: admin-email JWT ─────────────────────────────────────────────
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    let payload;
    try {
      payload = jwt.verify(header.slice(7), env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const user = await User.findById(payload.sub).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!isAdminUser(user)) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    return next();
  }

  // Neither credential present.
  return res.status(401).json({ error: 'Admin auth required' });
}

module.exports = { requireAdminAuth, isAdminUser, adminEmails };
