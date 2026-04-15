const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const DAILY_FREE_TICKETS = 5;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Serialize a User doc to the nested { user, rank, source, ticketCount } shape.
function toEntry(u, rank, source = 'system') {
  return {
    rank,
    source,
    ticketCount: u.dailyTicketsReceived ?? 0,
    user: {
      _id: u._id,
      id: u._id.toString(),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      countryCode: u.countryCode,
      isBoosted: u.isBoosted,
      isPremium: u.isPremium,
      age: u.age,
      height: u.height,
      popularityScore: u.popularityScore ?? 0,
    },
  };
}

// ── GET /api/popular/today ─────────────────────────────────────────────────────
// Daily leaderboard: top 10 users by tickets received today.
// Computed on-demand; fills remaining slots with highly-active users if < 10.
router.get('/today', auth, async (req, res, next) => {
  try {
    const today = todayStr();

    // Users who received tickets today, sorted by count desc
    const topByTickets = await User.find({
      dailyTicketsDate: today,
      dailyTicketsReceived: { $gt: 0 },
      'preferences.hideFromNearby': { $ne: true },
    })
      .sort({ dailyTicketsReceived: -1 })
      .limit(10)
      .select('nickname avatarUrl countryCode isBoosted isPremium age height popularityScore dailyTicketsReceived')
      .lean();

    let entries = topByTickets.map((u, i) => toEntry(u, i + 1, 'ticket'));

    // Fill remaining spots up to 10 with popular users not already listed
    if (entries.length < 10) {
      const excludeIds = topByTickets.map((u) => u._id);
      const filler = await User.find({
        _id: { $nin: excludeIds },
        'preferences.hideFromNearby': { $ne: true },
        'preferences.stealthMode': { $ne: true },
      })
        .sort({ popularityScore: -1, lastActiveAt: -1 })
        .limit(10 - entries.length)
        .select('nickname avatarUrl countryCode isBoosted isPremium age height popularityScore dailyTicketsReceived')
        .lean();

      filler.forEach((u, i) =>
        entries.push(toEntry(u, entries.length + 1, 'system'))
      );
    }

    ok(res, entries);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/popular ──────────────────────────────────────────────────────────
// Alias to /today for the main leaderboard.
router.get('/', auth, async (req, res, next) => {
  req.url = '/today';
  router.handle(req, res, next);
});

// ── GET /api/popular/my-tickets ───────────────────────────────────────────────
router.get('/my-tickets', auth, async (req, res, next) => {
  try {
    const today = todayStr();
    let user = await User.findById(req.user._id).select('ticketBalance ticketRefillDate').lean();

    // Refill daily tickets if it's a new day
    if (user.ticketRefillDate !== today) {
      await User.findByIdAndUpdate(req.user._id, {
        ticketBalance: DAILY_FREE_TICKETS,
        ticketRefillDate: today,
      });
      return ok(res, { remaining: DAILY_FREE_TICKETS, max: DAILY_FREE_TICKETS });
    }

    ok(res, {
      remaining: user.ticketBalance ?? DAILY_FREE_TICKETS,
      max: DAILY_FREE_TICKETS,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/popular/ticket/use ──────────────────────────────────────────────
// Vote for a user: caller spends 1 ticket, target gains daily popularity.
router.post('/ticket/use', auth, async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return err(res, 'targetUserId is required', 400);
    if (targetUserId === req.user._id.toString()) {
      return err(res, 'Cannot vote for yourself', 400);
    }

    const today = todayStr();
    const sender = await User.findById(req.user._id).select('ticketBalance ticketRefillDate');

    // Refill if new day
    if (sender.ticketRefillDate !== today) {
      sender.ticketBalance = DAILY_FREE_TICKETS;
      sender.ticketRefillDate = today;
    }

    if (sender.ticketBalance <= 0) {
      return err(res, '今日人气票已用完，明天再来', 429);
    }

    sender.ticketBalance -= 1;
    await sender.save();

    // Increment target's daily ticket count (reset if new day) + overall score
    const target = await User.findById(targetUserId).select('dailyTicketsReceived dailyTicketsDate');
    if (!target) return err(res, 'User not found', 404);

    if (target.dailyTicketsDate !== today) {
      target.dailyTicketsReceived = 1;
      target.dailyTicketsDate = today;
    } else {
      target.dailyTicketsReceived += 1;
    }
    await target.save();
    await User.findByIdAndUpdate(targetUserId, { $inc: { popularityScore: 1 } });

    ok(res, {
      success: true,
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
