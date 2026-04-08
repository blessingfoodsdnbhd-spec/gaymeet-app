const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const PLANS = {
  monthly: { days: 30, price: 29.9 },
  quarterly: { days: 90, price: 69.9 },
  yearly: { days: 365, price: 199.9 },
};

// ── POST /api/subscriptions/purchase ─────────────────────────────────────────
// In production: verify receipt with Apple/Google. Here we trust the client.
router.post('/purchase', auth, async (req, res, next) => {
  try {
    const { plan, receipt } = req.body;

    if (!plan || !PLANS[plan]) {
      return err(res, `plan must be one of: ${Object.keys(PLANS).join(', ')}`);
    }

    const days = PLANS[plan].days;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 86400000);

    await User.findByIdAndUpdate(req.user._id, {
      isPremium: true,
      premiumExpiresAt: expiresAt,
    });

    ok(res, {
      success: true,
      plan,
      isPremium: true,
      premiumExpiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/subscriptions/status ─────────────────────────────────────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const user = req.user;

    // Auto-expire
    let isPremium = user.isPremium;
    if (isPremium && user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
      isPremium = false;
      await User.findByIdAndUpdate(user._id, { isPremium: false });
    }

    ok(res, {
      isPremium,
      premiumExpiresAt: user.premiumExpiresAt,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
