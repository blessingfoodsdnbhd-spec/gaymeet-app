const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const DAILY_FREE_TICKETS = 5;

// ── GET /api/popular ──────────────────────────────────────────────────────────
// Returns top users sorted by real popularityScore.
router.get('/', auth, async (req, res, next) => {
  try {
    const { countryCode } = req.query;
    const me = req.user;

    const filter = {
      _id: { $ne: me._id },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
    };
    if (countryCode) filter.countryCode = countryCode;

    const users = await User.find(filter)
      .sort({ popularityScore: -1, isBoosted: -1, lastActiveAt: -1 })
      .limit(50)
      .select('nickname avatarUrl countryCode isBoosted isPremium lastActiveAt age height popularityScore')
      .lean();

    const result = users.map((u, i) => ({
      rank: i + 1,
      userId: u._id,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      countryCode: u.countryCode,
      isBoosted: u.isBoosted,
      isPremium: u.isPremium,
      age: u.age,
      height: u.height,
      ticketCount: u.popularityScore ?? 0,
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/popular/my-tickets ───────────────────────────────────────────────
// Returns the caller's remaining ticket balance for today.
router.get('/my-tickets', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('ticketBalance ticketRefillDate').lean();

    // Refill daily tickets if it's a new day
    const today = new Date().toISOString().slice(0, 10);
    if (user.ticketRefillDate !== today) {
      await User.findByIdAndUpdate(req.user._id, {
        ticketBalance: DAILY_FREE_TICKETS,
        ticketRefillDate: today,
      });
      return ok(res, { remaining: DAILY_FREE_TICKETS, refillDate: today });
    }

    ok(res, { remaining: user.ticketBalance ?? DAILY_FREE_TICKETS });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/popular/ticket/use ──────────────────────────────────────────────
// Vote for a user: deduct one ticket from caller, increment target's popularityScore.
router.post('/ticket/use', auth, async (req, res, next) => {
  try {
    const { targetUserId, countryCode } = req.body;
    if (!targetUserId) return err(res, 'targetUserId is required', 400);
    if (targetUserId === req.user._id.toString()) {
      return err(res, 'Cannot vote for yourself', 400);
    }

    // Refresh daily ticket balance if new day
    const today = new Date().toISOString().slice(0, 10);
    const sender = await User.findById(req.user._id).select('ticketBalance ticketRefillDate');

    if (sender.ticketRefillDate !== today) {
      sender.ticketBalance = DAILY_FREE_TICKETS;
      sender.ticketRefillDate = today;
    }

    if (sender.ticketBalance <= 0) {
      return err(res, '今日人气票已用完，明天再来', 429);
    }

    // Deduct ticket from sender
    sender.ticketBalance -= 1;
    await sender.save();

    // Increment target's popularity score
    await User.findByIdAndUpdate(targetUserId, { $inc: { popularityScore: 1 } });

    ok(res, {
      success: true,
      countryCode: countryCode ?? null,
      remaining: sender.ticketBalance,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/popular/ticket/purchase ─────────────────────────────────────────
router.post('/ticket/purchase', auth, async (req, res, next) => {
  try {
    const { amount = 5 } = req.body;
    const cost = amount * 10; // 10 coins per ticket

    const user = await User.findById(req.user._id).select('coins ticketBalance');
    if (user.coins < cost) {
      return err(res, `购买${amount}张票需要${cost}金币`, 402);
    }

    user.coins -= cost;
    user.ticketBalance = (user.ticketBalance ?? 0) + amount;
    await user.save();

    ok(res, {
      success: true,
      purchased: amount,
      remaining: user.ticketBalance,
      coinsSpent: cost,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
