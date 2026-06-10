// Premium gifting (item 8). A Premium user gifts 7 days of Premium to another
// user. Rate-limited to deter free-Premium farming: sender must be Premium,
// max 3 gifts/day, and one gift per recipient per 30 days.
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { sendPushToUser } = require('../utils/push');
const User = require('../models/User');
const PremiumGift = require('../models/PremiumGift');

const GIFT_DAYS = 7;
const DAILY_CAP = 3;
const RECIPIENT_COOLDOWN_DAYS = 30;

// ── POST /api/premium/gift  { recipientId } ───────────────────────────────────
router.post('/gift', auth, async (req, res, next) => {
  try {
    if (!isPremiumActive(req.user)) {
      return err(res, 'Gifting Premium requires Premium', 402);
    }
    const recipientId = String(req.body.recipientId || '');
    if (!recipientId) return err(res, 'recipientId required', 400);
    if (recipientId === req.user._id.toString()) {
      return err(res, "You can't gift yourself", 400);
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) return err(res, 'Recipient not found', 404);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Sender daily cap.
    const sentToday = await PremiumGift.countDocuments({
      gifter: req.user._id,
      createdAt: { $gte: new Date(now - DAY) },
    });
    if (sentToday >= DAILY_CAP) {
      return err(res, 'Daily gift limit reached', 429);
    }

    // Per-recipient cooldown.
    const recent = await PremiumGift.findOne({
      gifter: req.user._id,
      recipient: recipientId,
      createdAt: { $gte: new Date(now - RECIPIENT_COOLDOWN_DAYS * DAY) },
    });
    if (recent) {
      return err(res, 'Already gifted this person recently', 429);
    }

    // Grant: extend from the later of (now, existing expiry) so it stacks.
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
