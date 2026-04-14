const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const PLANS = {
  // Legacy plans (treated as VIP1)
  monthly:   { days: 30,  vipLevel: 1, price: 19.0 },
  quarterly: { days: 90,  vipLevel: 1, price: 49.0 },
  yearly:    { days: 365, vipLevel: 1, price: 99.0 },
  // Tiered VIP plans
  vip1_monthly: { days: 30,  vipLevel: 1, price: 19.0 },
  vip2_monthly: { days: 30,  vipLevel: 2, price: 39.0 },
  vip3_monthly: { days: 30,  vipLevel: 3, price: 69.0 },
  vip1_yearly:  { days: 365, vipLevel: 1, price: 99.0 },
  vip2_yearly:  { days: 365, vipLevel: 2, price: 199.0 },
  vip3_yearly:  { days: 365, vipLevel: 3, price: 349.0 },
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

    const { vipLevel } = PLANS[plan];
    await User.findByIdAndUpdate(req.user._id, {
      isPremium: true,
      premiumExpiresAt: expiresAt,
      vipLevel,
      vipExpiresAt: expiresAt,
    });

    ok(res, {
      success: true,
      plan,
      isPremium: true,
      vipLevel,
      premiumExpiresAt: expiresAt.toISOString(),
      vipExpiresAt: expiresAt.toISOString(),
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
