const router = require('express').Router();
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const FREE_DAILY_SWIPES = 20;

// ── POST /api/swipes ──────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const { targetUserId, direction } = req.body;
    if (!targetUserId || !direction) {
      return err(res, 'targetUserId and direction required');
    }
    if (!['like', 'pass', 'super_like'].includes(direction)) {
      return err(res, 'direction must be like, pass, or super_like');
    }

    const me = req.user;

    // ── Daily swipe limit for free users ──────────────────────────────────────
    if (!me.isPremium && direction !== 'pass') {
      const today = new Date().toISOString().slice(0, 10);
      const swipeUser = await User.findById(me._id);

      if (swipeUser.dailySwipesDate !== today) {
        swipeUser.dailySwipes = 0;
        swipeUser.dailySwipesDate = today;
      }

      if (swipeUser.dailySwipes >= FREE_DAILY_SWIPES) {
        return res.status(429).json({
          error: 'Daily swipe limit reached',
          limitReached: true,
          resetAt: new Date(today + 'T00:00:00.000Z').getTime() + 86400000,
        });
      }

      swipeUser.dailySwipes += 1;
      await swipeUser.save();
    }

    // ── Upsert swipe ──────────────────────────────────────────────────────────
    await Swipe.findOneAndUpdate(
      { fromUser: me._id, toUser: targetUserId },
      { direction },
      { upsert: true, new: true }
    );

    // ── Check for mutual like → create match ──────────────────────────────────
    if (direction === 'like' || direction === 'super_like') {
      const mutual = await Swipe.findOne({
        fromUser: targetUserId,
        toUser: me._id,
        direction: { $in: ['like', 'super_like'] },
      });

      if (mutual) {
        // Avoid duplicate matches
        const existing = await Match.findOne({
          users: { $all: [me._id, targetUserId] },
        });

        if (!existing) {
          const match = await Match.create({
            users: [me._id, targetUserId],
          });
          return ok(res, { matched: true, matchId: match._id.toString() });
        }

        return ok(res, {
          matched: true,
          matchId: existing._id.toString(),
        });
      }
    }

    ok(res, { matched: false, matchId: null });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
