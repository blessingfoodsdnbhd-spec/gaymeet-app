// Meyou 密友 — client runtime config: the app-version gate.
//
//   GET  /api/config/version    (public)  → { ios, android } gate config
//   PUT  /api/admin/version     (admin)   → update the gate  (mounted in app.js)
//   GET  /api/admin/version     (admin)   → full config incl. timestamps
//
// The public GET is unauthenticated on purpose: the client checks it BEFORE
// login (on cold start) to decide whether to hard-block an ancient build.
const router = require('express').Router();
const AppVersionConfig = require('../models/AppVersionConfig');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');

/** Shape a platform gate for the public payload (drops internal fields). */
function publicGate(g = {}) {
  return {
    minimum: g.minimum || '0.0.0',
    recommended: g.recommended || '0.0.0',
    latest: g.latest || '0.0.0',
    storeUrl: g.storeUrl || '',
    message: g.message || '',
  };
}

// ── GET /api/config/version ─────────────────────────────────────────────────
// Public. Cheap, cache-friendly. The client compares its own build against
// minimum/recommended locally.
router.get('/version', async (_req, res, next) => {
  try {
    const doc = await AppVersionConfig.get();
    res.set('Cache-Control', 'public, max-age=60'); // 1-min edge/client cache
    ok(res, { ios: publicGate(doc.ios), android: publicGate(doc.android) });
  } catch (e) {
    next(e);
  }
});

// ── Admin sub-router (mounted at /api/admin) ────────────────────────────────
const admin = require('express').Router();
admin.use(requireAdminAuth);

// Accept only well-formed dotted-numeric versions ("3.1.16", "3.1", "12").
function isVersion(v) {
  return typeof v === 'string' && /^\d+(\.\d+){0,3}$/.test(v.trim());
}

// Merge a partial platform patch onto the existing gate, validating versions.
function applyGate(target, patch) {
  if (!patch || typeof patch !== 'object') return null;
  for (const field of ['minimum', 'recommended', 'latest']) {
    if (patch[field] !== undefined) {
      if (!isVersion(patch[field])) return `Invalid ${field}: ${patch[field]}`;
      target[field] = String(patch[field]).trim();
    }
  }
  if (patch.storeUrl !== undefined) target.storeUrl = String(patch.storeUrl).trim();
  if (patch.message !== undefined) target.message = String(patch.message);
  return null;
}

admin.get('/version', async (_req, res, next) => {
  try {
    const doc = await AppVersionConfig.get();
    ok(res, {
      ios: publicGate(doc.ios),
      android: publicGate(doc.android),
      updatedAt: doc.updatedAt,
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/admin/version  { ios?: {...}, android?: {...} }  (partial patch)
admin.put('/version', async (req, res, next) => {
  try {
    const doc = await AppVersionConfig.get();
    const { ios, android } = req.body || {};
    if (ios) {
      const e = applyGate(doc.ios, ios);
      if (e) return err(res, e);
    }
    if (android) {
      const e = applyGate(doc.android, android);
      if (e) return err(res, e);
    }
    doc.markModified('ios');
    doc.markModified('android');
    await doc.save();
    ok(res, {
      ios: publicGate(doc.ios),
      android: publicGate(doc.android),
      updatedAt: doc.updatedAt,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.admin = admin;
