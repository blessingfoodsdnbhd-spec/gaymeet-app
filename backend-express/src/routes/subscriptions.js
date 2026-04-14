const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// All prices in MYR
const PLANS = {
  weekly:    { days: 7,   price: 9.90,  currency: 'MYR', label: 'Weekly'    },
  monthly:   { days: 30,  price: 19.90, currency: 'MYR', label: 'Monthly'   },
  yearly:    { days: 365, price: 99.90, currency: 'MYR', label: 'Yearly'    },
};

// ── GET /api/subscriptions/plans ──────────────────────────────────────────────
router.get('/plans', (req, res) => {
  const plans = Object.entries(PLANS).map(([id, p]) => ({
    id,
    ...p,
    perMonth: id === 'yearly'
      ? `RM ${(p.price / 12).toFixed(2)} / mo`
      : id === 'weekly'
      ? 'Try it out'
      : null,
    savingsLabel: id === 'yearly' ? 'Save 58%' : null,
    popular: id === 'monthly',
  }));
  ok(res, plans);
});

// ── POST /api/subscriptions/purchase ─────────────────────────────────────────
// In production: verify receipt with Apple/Google before granting premium.
router.post('/purchase', auth, async (req, res, next) => {
  try {
    const { plan, receipt } = req.body;

    if (!plan || !PLANS[plan]) {
      return err(res, `plan must be one of: ${Object.keys(PLANS).join(', ')}`);
    }

    const { days } = PLANS[plan];
    const now = new Date();

    // Extend existing subscription if still active
    const base = req.user.isPremium && req.user.premiumExpiresAt && req.user.premiumExpiresAt > now
      ? req.user.premiumExpiresAt
      : now;

    const expiresAt = new Date(base.getTime() + days * 86400000);

    await User.findByIdAndUpdate(req.user._id, {
      isPremium: true,
      premiumExpiresAt: expiresAt,
    });

    ok(res, {
      success: true,
      plan,
      isPremium: true,
      premiumExpiresAt: expiresAt.toISOString(),
      ...PLANS[plan],
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/subscriptions/status ─────────────────────────────────────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const user = req.user;

    let isPremium = user.isPremium;
    if (isPremium && user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
      isPremium = false;
      await User.findByIdAndUpdate(user._id, { isPremium: false });
    }

    ok(res, {
      isPremium,
      premiumExpiresAt: user.premiumExpiresAt ?? null,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
