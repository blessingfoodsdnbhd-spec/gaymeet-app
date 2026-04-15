const router = require('express').Router();
const Energy = require('../models/Energy');
const User   = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

const FREE_DAILY_SENDS = 3;
const OVER_LIMIT_COIN_COST = 5;
const EXP_PER_SEND = 1;
const MAX_LEVEL = 99;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Recalculate level from totalExpReceived. */
function calcLevel(totalExp) {
  return Math.min(Math.floor(Math.sqrt(totalExp / 10)) + 1, MAX_LEVEL);
}

// ── POST /api/energy/send ─────────────────────────────────────────────────────
router.post('/send', auth, async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return err(res, 'receiverId required');
    if (receiverId === req.user._id.toString()) {
      return err(res, 'Cannot send energy to yourself');
    }

    const [sender, receiver] = await Promise.all([
      User.findById(req.user._id),
      User.findById(receiverId),
    ]);

    if (!receiver) return err(res, 'User not found', 404);

    const today = todayStr();
    const startOfDay = new Date(today + 'T00:00:00.000Z');
    const endOfDay = new Date(today + 'T23:59:59.999Z');

    // Count distinct receivers this sender has sent to today
    const distinctReceiversToday = await Energy.distinct('receiver', {
      sender: sender._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const isNewReceiver = !distinctReceiversToday.some(
      (id) => id.toString() === receiverId
    );

    // Rate-limit free users: 3 NEW distinct receivers per day.
    // Sending again to an existing receiver is always free.
    if (!sender.isPremium && isNewReceiver && distinctReceiversToday.length >= FREE_DAILY_SENDS) {
      if (sender.coins < OVER_LIMIT_COIN_COST) {
        return err(res, 'Daily free limit reached. Need 5 coins to continue.', 402);
      }
      sender.coins -= OVER_LIMIT_COIN_COST;
    }

    // Keep dailyEnergySends as a convenience total (not used for limiting)
    if (sender.dailyEnergySendsDate !== today) {
      sender.dailyEnergySends = 0;
      sender.dailyEnergySendsDate = today;
    }
    sender.dailyEnergySends += 1;

    // Give EXP to receiver and recalculate level
    receiver.totalExpReceived += EXP_PER_SEND;
    receiver.currentExp += EXP_PER_SEND;
    const newLevel = calcLevel(receiver.totalExpReceived);
    const leveledUp = newLevel > receiver.level;
    receiver.level = newLevel;

    // Create energy record and persist both users
    await Promise.all([
      Energy.create({ sender: sender._id, receiver: receiver._id, amount: EXP_PER_SEND }),
      sender.save(),
      receiver.save(),
    ]);

    created(res, {
      receiverLevel: receiver.level,
      receiverTotalExp: receiver.totalExpReceived,
      leveledUp,
      senderCoins: sender.coins,
      senderSentToday: sender.dailyEnergySends,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/energy/history — energy I received ───────────────────────────────
router.get('/history', auth, async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const [records, total] = await Promise.all([
      Energy.find({ receiver: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sender', 'nickname avatarUrl level'),
      Energy.countDocuments({ receiver: req.user._id }),
    ]);

    ok(res, { records, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/energy/sent — energy I sent today ────────────────────────────────
router.get('/sent', auth, async (req, res, next) => {
  try {
    const today = todayStr();
    const start = new Date(today + 'T00:00:00.000Z');
    const end   = new Date(today + 'T23:59:59.999Z');

    const records = await Energy.find({
      sender: req.user._id,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .populate('receiver', 'nickname avatarUrl level');

    const me = await User.findById(req.user._id).select('dailyEnergySends dailyEnergySendsDate coins');

    const sentToday = me.dailyEnergySendsDate === today ? me.dailyEnergySends : 0;

    ok(res, {
      records,
      sentToday,
      freeRemaining: Math.max(0, FREE_DAILY_SENDS - sentToday),
      coins: me.coins,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
