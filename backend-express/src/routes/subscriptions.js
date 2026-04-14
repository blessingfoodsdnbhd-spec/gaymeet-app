const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// All prices in MYR
const PLANS = {
  // Simple plans (no VIP tier — treated as VIP1)
  weekly:       { days: 7,   vipLevel: 1, price: 9.90,  currency: 'MYR', label: 'Weekly'       },
  monthly:      { days: 30,  vipLevel: 1, price: 19.90, currency: 'MYR', label: 'Monthly'      },
  quarterly:    { days: 90,  vipLevel: 1, price: 49.0,  currency: 'MYR', label: 'Quarterly'    },
  yearly:       { days: 365, vipLevel: 1, price: 99.90, currency: 'MYR', label: 'Yearly'       },
  // Tiered VIP plans
  vip1_monthly: { days: 30,  vipLevel: 1, price: 19.0,  currency: 'MYR', label: 'VIP1 Monthly' },
  vip2_monthly: { days: 30,  vipLevel: 2, price: 39.0,  currency: 'MYR', label: 'VIP2 Monthly' },
  vip3_monthly: { days: 30,  vipLevel: 3, price: 69.0,  currency: 'MYR', label: 'VIP3 Monthly' },
  vip1_yearly:  { days: 365, vipLevel: 1, price: 99.0,  currency: 'MYR', label: 'VIP1 Yearly'  },
  vip2_yearly:  { days: 365, vipLevel: 2, price: 199.0, currency: 'MYR', label: 'VIP2 Yearly'  },
  vip3_yearly:  { days: 365, vipLevel: 3, price: 349.0, currency: 'MYR', label: 'VIP3 Yearly'  },
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
