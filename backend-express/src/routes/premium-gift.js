// Premium gifting (item 8 / GIFT1). A user gifts 7 days of Premium to another
// user. Quotas (overhauled): a gifter may send a limited number of gifts per
// CALENDAR MONTH — 5 if they are effectively Premium, 1 if free — and may gift
// any given recipient at most ONCE EVER (lifetime, per gifter→recipient pair).
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { sendPushToUser } = require('../utils/push');
const User = require('../models/User');
const PremiumGift = require('../models/PremiumGift');

const GIFT_DAYS = 7;
const PREMIUM_MONTHLY_CAP = 5;
const FREE_MONTHLY_CAP = 1;
const DAY = 24 * 60 * 60 * 1000;

// Start of the current calendar month, UTC (matches the quota display).
function startOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// A gifter's monthly cap depends on their effective Premium status.
const monthlyCapFor = (user) => (isPremiumActive(user) ? PREMIUM_MONTHLY_CAP : FREE_MONTHLY_CAP);

// ── GET /api/premium/gift/quota ───────────────────────────────────────────────
// Drives the "今月剩余 X / N 次" header. `total` is 5 for Premium, 1 for free.
router.get('/gift/quota', auth, async (req, res, next) => {
  try {
    const total = monthlyCapFor(req.user);
    const used = await PremiumGift.countDocuments({
      gifter: req.user._id,
      createdAt: { $gte: startOfMonthUTC() },
    });
    ok(res, { used, total, remaining: Math.max(0, total - used), isPremium: isPremiumActive(req.user) });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/premium/gift  { recipientId } ───────────────────────────────────
router.post('/gift', auth, async (req, res, next) => {
  try {
    const recipientId = String(req.body.recipientId || '');
    if (!recipientId) return err(res, 'recipientId required', 400);
    if (recipientId === req.user._id.toString()) {
      return err(res, "You can't gift yourself", 400);
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) return err(res, 'Recipient not found', 404);

    // Monthly cap (5 Premium / 1 free).
    const cap = monthlyCapFor(req.user);
    const usedThisMonth = await PremiumGift.countDocuments({
      gifter: req.user._id,
      createdAt: { $gte: startOfMonthUTC() },
    });
    if (usedThisMonth >= cap) {
      return res.status(429).json({ error: 'Monthly gift limit reached', code: 'MONTHLY_QUOTA_EXCEEDED' });
    }

    // Lifetime: a gifter may gift any recipient at most once, ever.
    const already = await PremiumGift.exists({ gifter: req.user._id, recipient: recipientId });
    if (already) {
      return res.status(409).json({ error: 'You have already gifted this person', code: 'RECIPIENT_ALREADY_GIFTED' });
    }

    // Grant: extend from the later of (now, existing expiry) so it stacks.
    const now = Date.now();
    const current = recipient.premiumExpiresAt ? new Date(recipient.premiumExpiresAt) : null;
    const base = current && current.getTime() > now ? current.getTime() : now;
    const newExpiry = new Date(base + GIFT_DAYS * DAY);
    recipient.isPremium = true;
    recipient.premiumExpiresAt = newExpiry;
    await recipient.save();

    await PremiumGift.create({ gifter: req.user._id, recipient: recipientId, days: GIFT_DAYS });

    // Push to recipient (detached — don't block the response).
    sendPushToUser(recipientId, {
      title: '🎁 Premium',
      body: `${req.user.nickname || 'A friend'} sent you ${GIFT_DAYS} days of Premium!`,
      data: { type: 'premium_gift' },
    }).catch(() => {});

    ok(res, { success: true, days: GIFT_DAYS, recipientPremiumExpiresAt: newExpiry.toISOString() });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
