const router = require('express').Router();
const Follow = require('../models/Follow');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { sendPushToUser } = require('../utils/push');
const { notify } = require('../services/notificationService');

// ── POST /api/users/:id/follow — toggle follow / unfollow ─────────────────────
router.post('/:id/follow', auth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return err(res, 'Cannot follow yourself', 400);
    }

    const target = await User.findById(targetId);
    if (!target) return err(res, 'User not found', 404);

    const existing = await Follow.findOne({
      follower: req.user._id,
      following: targetId,
    });

    if (existing) {
      // Unfollow
      await existing.deleteOne();
      await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } });
      return ok(res, { following: false });
    } else {
      // Follow
      await Follow.create({ follower: req.user._id, following: targetId });
      await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });
      await User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });

      // Push the followed user — fire-and-forget. req.user is loaded by the
      // auth middleware and has nickname. Localized to the recipient's app
      // language via the i18n bundle (notify() resolves preferredLanguage).
      const who = req.user.nickname || 'Someone';
      notify(targetId, 'follow', {
        title: `${who} is following you`,
        body: 'Tap to view their profile',
        // fromUserName/Avatar let the Notification Center show the follower's
        // avatar + name instead of a generic "+" icon (YYY).
        data: {
          fromUserId: String(req.user._id),
          fromUserName: who,
          fromUserAvatarUrl: req.user.avatarUrl || '',
        },
        i18n: {
          en: { title: `${who} is following you`, body: 'Tap to view their profile' },
          zh: { title: `${who} 关注了你`, body: '点击查看TA的主页' },
          ko: { title: `${who}님이 회원님을 팔로우합니다`, body: '탭하여 프로필을 보세요' },
          ja: { title: `${who}があなたをフォローしました`, body: 'タップしてプロフィールを見る' },
        },
        // Coalesce the push when several people follow within an hour (item 9):
        // one "N people are following you" instead of N separate buzzes.
        coalesce: {
          windowMs: 60 * 60 * 1000,
          summaryI18n: {
            en: { title: '{{count}} people are following you', body: 'Tap to see who' },
            zh: { title: '{{count}} 人关注了你', body: '点击查看是谁' },
            ko: { title: '{{count}}명이 회원님을 팔로우합니다', body: '탭하여 확인하세요' },
            ja: { title: '{{count}}人があなたをフォローしました', body: 'タップして確認' },
          },
        },
      }).catch(() => {});

      return ok(res, { following: true });
    }
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/:id/followers ──────────────────────────────────────────────
router.get('/:id/followers', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const follows = await Follow.find({ following: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('follower', 'nickname avatarUrl isOnline level isPremium isVerified')
      .lean();

    // Check which of these users the current viewer already follows
    const ids = follows.map((f) => f.follower._id);
    const myFollows = await Follow.find({
      follower: req.user._id,
      following: { $in: ids },
    }).lean();
    const followingSet = new Set(myFollows.map((f) => f.following.toString()));

    ok(
      res,
      follows.map((f) => ({
        ...f.follower,
        isFollowing: followingSet.has(f.follower._id.toString()),
        isSelf: f.follower._id.toString() === req.user._id.toString(),
      }))
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/:id/following ──────────────────────────────────────────────
router.get('/:id/following', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const follows = await Follow.find({ follower: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('following', 'nickname avatarUrl isOnline level isPremium isVerified dob lastActiveAt location')
      .lean();

    const ids = follows.map((f) => f.following._id);
    const myFollows = await Follow.find({
      follower: req.user._id,
      following: { $in: ids },
    }).lean();
    const followingSet = new Set(myFollows.map((f) => f.following.toString()));

    const { haversineMeters } = require('../utils/geo');
    const myCoords = req.user.location?.coordinates;
    ok(
      res,
      follows.map((f) => ({
        ...f.following,
        dob: f.following.dob ? new Date(f.following.dob).toISOString() : null,
        lastActiveAt: f.following.lastActiveAt ? new Date(f.following.lastActiveAt).toISOString() : null,
        distanceM: haversineMeters(myCoords, f.following.location?.coordinates),
        isFollowing: followingSet.has(f.following._id.toString()),
        isSelf: f.following._id.toString() === req.user._id.toString(),
      }))
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/:id/is-following ───────────────────────────────────────────
router.get('/:id/is-following', auth, async (req, res, next) => {
  try {
    const exists = await Follow.exists({
      follower: req.user._id,
      following: req.params.id,
    });
    ok(res, { following: !!exists });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
