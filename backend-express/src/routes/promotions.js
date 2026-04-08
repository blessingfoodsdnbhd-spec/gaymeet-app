const router = require('express').Router();
const Promotion = require('../models/Promotion');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── GET /api/promotions ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    ok(res, promotions);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
