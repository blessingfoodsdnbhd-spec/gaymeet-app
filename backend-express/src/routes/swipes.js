const router = require('express').Router();
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { sendPushToUser } = require('../utils/push');
const { notify } = require('../services/notificationService');

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
    if (!isPremiumActive(me) && direction !== 'pass') {
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
    // Capture the prior direction first so we can keep the target's
    // totalLikesReceived (→ popularity) counter accurate across re-swipes.
    const prior = await Swipe.findOne({ fromUser: me._id, toUser: targetUserId })
      .select('direction').lean();
    await Swipe.findOneAndUpdate(
      { fromUser: me._id, toUser: targetUserId },
      { direction },
      { upsert: true, new: true }
    );

    // Maintain popularity (likes received) only on a like↔non-like transition.
    const wasLike = !!prior && ['like', 'super_like'].includes(prior.direction);
    const isLike = direction === 'like' || direction === 'super_like';
    if (isLike && !wasLike) {
      await User.findByIdAndUpdate(targetUserId, { $inc: { totalLikesReceived: 1 } });
    } else if (!isLike && wasLike) {
      await User.findByIdAndUpdate(targetUserId, { $inc: { totalLikesReceived: -1 } });
    }

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

        let match = existing;
        let isNewMatch = false;
        if (!existing) {
          match = await Match.create({ users: [me._id, targetUserId] });
          isNewMatch = true;

          // Seed a system greeting so the conversation shows up in BOTH users'
          // 消息 tab immediately, even if neither sends a message. lastMessageBy
          // is left null to flag the thread's preview as a system message (the
          // client localizes it). readBy = both → no phantom unread badge.
          try {
            const Message = require('../models/Message');
            const SYSTEM_BODY = '你们已成为同频朋友 ✨ 来打个招呼吧';
            await Message.create({
              matchId: match._id,
              senderId: me._id,
              type: 'text',
              content: SYSTEM_BODY,
              isSystem: true,
              readBy: [me._id, targetUserId],
            });
            await Match.findByIdAndUpdate(match._id, {
              lastMessage: SYSTEM_BODY,
              lastMessageAt: new Date(),
              lastMessageBy: null,
            });
          } catch (_) {
            // best-effort — never block the match response
          }
        }

        // Notify the OTHER user via socket so they get a MatchOverlay.
        if (isNewMatch) {
          try {
            const { getIO } = require('../services/socketService');
            const io = getIO();
            if (io) {
              io.to(`user:${targetUserId}`).emit('match:new', {
                id: match._id.toString(),
                // Sent to the OTHER user → self:false (don't leak my email).
                user: me.toPublicJSON(undefined, { self: false }),
              });
            }
          } catch (_) {
            // best effort
          }

          // Best-effort push to the OTHER party — the swiper is currently
          // in-app and got the matched=true response, so they don't need a
          // notification. Receiver may have liked us hours/days ago.
          notify(targetUserId, 'match', {
            title: "It's a match! 🎉",
            body: `You matched with ${me.nickname || 'someone'}`,
            data: {
              matchId: match._id.toString(),
              fromUserName: me.nickname || '',
              fromUserAvatarUrl: me.avatarUrl || '',
            },
          }).catch(() => { /* never fails the request */ });
        }

        return ok(res, { matched: true, matchId: match._id.toString() });
      }

      // No mutual yet, but if this was a super_like, notify the target so
      // they know to check their incoming likes (regular likes are silent
      // to avoid notification spam — they'll see them in the likes feed).
      if (direction === 'super_like') {
        sendPushToUser(targetUserId, {
          title: `${me.nickname || 'Someone'} super liked you ⭐`,
          body: 'Open Meyou to see who',
          data: { type: 'like', fromUserId: me._id.toString() },
        }).catch(() => {});
      }
    }

    ok(res, { matched: false, matchId: null });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
