// Unified content-report endpoint powering auto-hide (services/report.js).
//
//   POST /api/reports { targetType, targetId, reason? }
//     targetType ∈ 'moment' | 'voteEvent' | 'voteEntry'
//
// Idempotent per (reporter, target): reporting the same target twice is silently
// accepted (200) and never double-counts. At 3 UNIQUE reporters the target is
// auto-hidden from public feeds. Returns { reported, hidden } so the client can
// reflect state, but never leaks the raw count.
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { recordContentReport } = require('../services/report');

const VALID_TYPES = ['moment', 'voteEvent', 'voteEntry'];

router.post('/', auth, async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body || {};
    if (!VALID_TYPES.includes(targetType)) {
      return err(res, `targetType must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!targetId) return err(res, 'targetId required');

    const result = await recordContentReport({
      reporterId: req.user._id,
      targetType,
      targetId,
      reason: req.body?.reason,
    });
    // Don't expose the exact count; just whether it's now hidden.
    ok(res, { reported: true, hidden: result.hidden });
  } catch (e) {
    // Invalid id / unknown type → 400 rather than 500.
    if (/Invalid targetId|Unknown report targetType/.test(e.message || '')) {
      return err(res, e.message);
    }
    next(e);
  }
});

module.exports = router;
