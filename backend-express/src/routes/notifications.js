const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── POST /api/notifications/token ─────────────────────────────────────────────
router.post('/token', auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (token) {
      await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
    }
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/notifications/token ──────────────────────────────────────────
router.delete('/token', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notifications/schedule ─────────────────────────────────────────
// Best-effort scheduling endpoint. In production this would queue a job.
router.post('/schedule', auth, async (req, res, next) => {
  try {
    // Acknowledge and ignore — server-side push scheduling not implemented
    ok(res, { queued: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
