const router = require('express').Router();
const Gift = require('../models/Gift');
const GiftTransaction = require('../models/GiftTransaction');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

const FREE_DAILY_GIFTS = 3;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const COIN_PACKAGES = [
  {
    id: 'coins_60',
    coins: 60,
    bonus: 0,
    price: 4.90,
    currency: 'MYR',
    label: '60 Coins',
    bestValue: false,
    popular: false,
  },
  {
    id: 'coins_300',
    coins: 300,
    bonus: 30,
    price: 19.90,
    currency: 'MYR',
    label: '300 Coins',
    bestValue: false,
    popular: true,
  },
  {
    id: 'coins_700',
    coins: 700,
    bonus: 100,
    price: 39.90,
    currency: 'MYR',
    label: '700 Coins',
    bestValue: false,
    popular: false,
  },
  {
    id: 'coins_1500',
    coins: 1500,
    bonus: 300,
    price: 79.90,
    currency: 'MYR',
    label: '1500 Coins',
    bestValue: true,
    popular: false,
  },
];

// ── GET /api/gifts ────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const gifts = await Gift.find({ isActive: true })
      .sort({ category: 1, sortOrder: 1 })
      .lean();

    // Group by category
    const grouped = gifts.reduce((acc, g) => {
      if (!acc[g.category]) acc[g.category] = [];
      acc[g.category].push(g);
      return acc;
    }, {});

    ok(res, { gifts, grouped });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/gifts/send ──────────────────────────────────────────────────────
router.post('/send', auth, async (req, res, next) => {
  try {
    const { receiverId, giftId, message } = req.body;
    if (!receiverId || !giftId) return err(res, 'receiverId and giftId required');

    const [gift, receiver, sender] = await Promise.all([
      Gift.findOne({ _id: giftId, isActive: true }),
      User.findById(receiverId),
      User.findById(req.user._id),
    ]);

    if (!gift) return err(res, 'Gift not found', 404);
    if (!receiver) return err(res, 'Receiver not found', 404);
    if (receiverId === req.user._id.toString()) return err(res, 'Cannot gift yourself');

    // Check free gift allowance (premium users get 3 free/day)
    let isFreeGift = false;
    if (sender.isPremium) {
      const today = todayStr();
      const startOfDay = new Date(today + 'T00:00:00.000Z');
      const freeGiftsSentToday = await GiftTransaction.countDocuments({
        sender: sender._id,
        isFreeGift: true,
        createdAt: { $gte: startOfDay },
      });
      if (freeGiftsSentToday < FREE_DAILY_GIFTS) {
        isFreeGift = true;
      }
    }

    // Deduct coins if not free
    if (!isFreeGift) {
      if (sender.coins < gift.price) {
        return res.status(402).json({
          error: 'Insufficient coins',
          required: gift.price,
          balance: sender.coins,
        });
      }
      await User.findByIdAndUpdate(sender._id, { $inc: { coins: -gift.price } });
    }

    // Credit receiver with a small coin reward (10%)
    const reward = Math.floor(gift.price * 0.1);
    if (reward > 0) {
      await User.findByIdAndUpdate(receiverId, { $inc: { coins: reward } });
    }

    const tx = await GiftTransaction.create({
      sender: sender._id,
      receiver: receiverId,
      gift: gift._id,
      message: message ?? null,
      coins: gift.price,
      isFreeGift,
    });

    const populated = await tx.populate([
      { path: 'gift' },
      { path: 'sender', select: 'nickname avatarUrl' },
    ]);

    created(res, {
      transaction: populated,
      newBalance: isFreeGift ? sender.coins : sender.coins - gift.price,
      isFreeGift,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/gifts/received ───────────────────────────────────────────────────
router.get('/received', auth, async (req, res, next) => {
  try {
    const txs = await GiftTransaction.find({ receiver: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('gift')
      .populate('sender', 'nickname avatarUrl countryCode')
      .lean();

    ok(res, txs);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/gifts/sent ───────────────────────────────────────────────────────
router.get('/sent', auth, async (req, res, next) => {
  try {
    const txs = await GiftTransaction.find({ sender: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('gift')
      .populate('receiver', 'nickname avatarUrl')
      .lean();

    ok(res, txs);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/coins/balance ────────────────────────────────────────────────────
// Mounted at /api/coins → /balance; also reachable at /api/gifts/balance
router.get('/balance', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id, 'coins').lean();
    ok(res, { balance: user.coins ?? 0 });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/coins/purchase ──────────────────────────────────────────────────
router.post('/purchase', auth, async (req, res, next) => {
  try {
    const { package: pkg } = req.body;
    const found = COIN_PACKAGES.find((p) => p.id === pkg);
    if (!found) {
      return err(res, `package must be one of: ${COIN_PACKAGES.map((p) => p.id).join(', ')}`);
    }

    // In production: verify receipt with Apple/Google Play. Trust client here.
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { coins: found.coins } },
      { new: true }
    );

    ok(res, {
      success: true,
      purchased: found.coins,
      newBalance: user.coins,
      package: found,
    });
  } catch (e) {
    next(e);
  }
});

// Expose packages list
router.get('/packages', auth, (req, res) => {
  ok(res, COIN_PACKAGES);
});

module.exports = router;
