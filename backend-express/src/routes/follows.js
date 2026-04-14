const router = require('express').Router();
const Follow = require('../models/Follow');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

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
      .populate('following', 'nickname avatarUrl isOnline level isPremium isVerified')
      .lean();

    const ids = follows.map((f) => f.following._id);
    const myFollows = await Follow.find({
      follower: req.user._id,
      following: { $in: ids },
    }).lean();
    const followingSet = new Set(myFollows.map((f) => f.following.toString()));

    ok(
      res,
      follows.map((f) => ({
        ...f.following,
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
