const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');
const CallLog = require('../models/CallLog');

// ── GET /api/calls/history ────────────────────────────────────────────────────
router.get('/history', auth, async (req, res, next) => {
  try {
    const logs = await CallLog.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('caller', 'nickname avatarUrl')
      .populate('receiver', 'nickname avatarUrl')
      .lean();

    const result = logs.map((log) => {
      const isOutgoing = log.caller._id.toString() === req.user._id.toString();
      const other = isOutgoing ? log.receiver : log.caller;
      return {
        ...log,
        isOutgoing,
        otherUser: other,
      };
    });

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
