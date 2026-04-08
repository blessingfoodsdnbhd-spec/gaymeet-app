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

  req.user = user;
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
