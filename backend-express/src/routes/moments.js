const router = require('express').Router();
const mongoose = require('mongoose');
const Moment = require('../models/Moment');
const MomentComment = require('../models/MomentComment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { hasProfanity } = require('../utils/profanityFilter');
const { sendPushToUser } = require('../utils/push');

// Meyou v2 nearby radius for moments — matches /api/discover/nearby default.
const MOMENTS_NEARBY_KM = 50;

// ── GET /api/moments ──────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const { userId, feed, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter;
    let followingIds = null;
    if (userId) {
      filter = { isActive: true, user: userId, visibility: 'public' };
    } else if (feed === 'following' || feed === 'friends') {
      // Union of (a) users I follow + (b) the OTHER party of every
      // active match I'm in. Product wording uses "好友 / Friends" to
      // mean both audiences — followers I've explicitly added AND
      // people I've mutual-liked into a chat thread. Dedupe via a Map
      // keyed on stringified ObjectId since ObjectIds are reference
      // types and a plain Set wouldn't dedupe across instances.
      const Follow = require('../models/Follow');
      const Match = require('../models/Match');
      const [followDocs, matchDocs] = await Promise.all([
        Follow.find({ follower: req.user._id }).select('following').lean(),
        Match.find({ users: req.user._id, isActive: true })
          .select('users')
          .lean(),
      ]);
      const meStr = req.user._id.toString();
      const idMap = new Map();
      followDocs.forEach((f) => idMap.set(f.following.toString(), f.following));
      matchDocs.forEach((m) => {
        m.users.forEach((u) => {
          const s = u.toString();
          if (s !== meStr) idMap.set(s, u);
        });
      });
      followingIds = Array.from(idMap.values());
      filter = {
        isActive: true,
        visibility: { $in: ['public', 'friends'] },
        // Posts by people I follow/match, PLUS posts I'm tagged in (FB-style).
        $or: [
          { user: { $in: followingIds } },
          { taggedUserIds: req.user._id },
        ],
      };
    } else if (feed === 'nearby') {
      // Find users within MOMENTS_NEARBY_KM of me, then filter moments to that set.
      const me = req.user;
      const lat = me.location?.coordinates?.[1] ?? 3.1390;
      const lng = me.location?.coordinates?.[0] ?? 101.6869;
      const nearbyUsers = await User.find({
        _id: { $ne: me._id },
        'preferences.hideFromNearby': { $ne: true },
        'preferences.stealthMode': { $ne: true },
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: MOMENTS_NEARBY_KM * 1000,
          },
        },
      })
        .select('_id')
        .limit(500)
        .lean();
      filter = {
        isActive: true,
        user: { $in: nearbyUsers.map((u) => u._id) },
        visibility: 'public',
      };
    } else if (feed === 'interest') {
      // Match posts by users who share at least one tag with me.
      const myInterests = req.user.interests || [];
      if (myInterests.length === 0) {
        return ok(res, []);
      }
      const interestUsers = await User.find({
        _id: { $ne: req.user._id },
        interests: { $in: myInterests },
      })
        .select('_id')
        .limit(1000)
        .lean();
      filter = {
        isActive: true,
        user: { $in: interestUsers.map((u) => u._id) },
        visibility: 'public',
      };
    } else {
      filter = { isActive: true, visibility: 'public' };
    }

    const moments = await Moment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'nickname avatarUrl isPremium countryCode')
      .populate('taggedUserIds', 'nickname avatarUrl')
      .lean();

    if (feed === 'following') {
      console.log(
        `[moments.feed] user=${req.user._id} following=${followingIds.length} page=${page} matched=${moments.length}`
      );
    }

    const result = moments.map((m) => ({
      ...m,
      likeCount: m.likes.length,
      // Client reads `commentCount` (singular); DB field is `commentsCount`.
      // Map it so the comment counter isn't stuck at 0.
      commentCount: m.commentsCount || 0,
      isLiked: m.likes.some((id) => id.toString() === req.user._id.toString()),
      likes: undefined, // don't send full array
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/moments/:id ──────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const moment = await Moment.findOne({ _id: req.params.id, isActive: true })
      .populate('user', 'nickname avatarUrl isPremium countryCode')
      .populate('taggedUserIds', 'nickname avatarUrl')
      .lean();

    if (!moment) return err(res, 'Moment not found', 404);

    const comments = await MomentComment.find({ moment: moment._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .populate('user', 'nickname avatarUrl')
      .lean();

    ok(res, {
      ...moment,
      likeCount: moment.likes.length,
      isLiked: moment.likes.some(
        (id) => id.toString() === req.user._id.toString()
      ),
      likes: undefined,
      comments: comments.map((c) => ({
        ...c,
        likeCount: c.likes.length,
        isLiked: c.likes.some((id) => id.toString() === req.user._id.toString()),
        likes: undefined,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/moments ─────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const {
      content = '', images = [], visibility = 'public', lat, lng,
      locationLabel, taggedUserIds,
    } = req.body;

    if (!content && images.length === 0) {
      return err(res, 'content or images required');
    }
    if (content.length > 500) return err(res, 'content max 500 chars');
    if (images.length > 9) return err(res, 'max 9 images');
    if (hasProfanity(content)) return err(res, 'Inappropriate content', 422);

    const data = {
      user: req.user._id,
      content,
      images,
      visibility,
    };

    if (lat != null && lng != null) {
      data.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
      data.hasLocation = true;
      if (locationLabel) data.locationLabel = String(locationLabel).slice(0, 120);
    }

    // Tag friends (FB-style). Only people the author follows OR who follow the
    // author may be tagged (anti-spam); deduped, self stripped, capped at 10.
    let taggedIds = [];
    if (Array.isArray(taggedUserIds) && taggedUserIds.length) {
      const ids = [...new Set(taggedUserIds.map(String))].filter(
        (id) => mongoose.isValidObjectId(id) && id !== req.user._id.toString(),
      );
      if (ids.length > 10) return err(res, 'max 10 tagged friends');
      if (ids.length) {
        const Follow = require('../models/Follow');
        const rels = await Follow.find({
          $or: [
            { follower: req.user._id, following: { $in: ids } },
            { following: req.user._id, follower: { $in: ids } },
          ],
        }).select('follower following').lean();
        const allowed = new Set();
        rels.forEach((r) => {
          allowed.add(r.follower.toString());
          allowed.add(r.following.toString());
        });
        taggedIds = ids.filter((id) => allowed.has(id));
      }
      data.taggedUserIds = taggedIds;
    }

    const moment = await Moment.create(data);
    const populated = await moment.populate([
      { path: 'user', select: 'nickname avatarUrl isPremium' },
      { path: 'taggedUserIds', select: 'nickname avatarUrl' },
    ]);

    // Notify tagged friends — fire-and-forget. Tap opens the moment.
    if (taggedIds.length) {
      const author = req.user.nickname || 'Someone';
      taggedIds.forEach((uid) => {
        sendPushToUser(uid, {
          title: author,
          body: `${author} tagged you in a moment`,
          data: { type: 'comment', momentId: moment._id.toString() },
        }).catch(() => {});
      });
    }

    created(res, {
      ...populated.toObject(),
      likeCount: 0,
      isLiked: false,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/moments/:id ───────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const moment = await Moment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!moment) return err(res, 'Moment not found', 404);

    moment.isActive = false;
    await moment.save();

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/moments/:id/like ────────────────────────────────────────────────
router.post('/:id/like', auth, async (req, res, next) => {
  try {
    const moment = await Moment.findOne({ _id: req.params.id, isActive: true });
    if (!moment) return err(res, 'Moment not found', 404);

    const uid = req.user._id;
    const idx = moment.likes.indexOf(uid);

    if (idx === -1) {
      moment.likes.push(uid);
    } else {
      moment.likes.splice(idx, 1);
    }

    await moment.save();

    // Push the moment author only when LIKING (not unliking) and only
    // when the liker isn't the author themselves. Fire-and-forget.
    if (idx === -1 && String(moment.user) !== String(uid)) {
      (async () => {
        try {
          const liker = await User.findById(uid).select('nickname').lean();
          const likerName = liker?.nickname || 'Someone';
          await sendPushToUser(moment.user, {
            title: `${likerName} liked your moment`,
            body: moment.content?.slice(0, 80) || '',
            data: { type: 'comment', momentId: String(moment._id) },
          });
        } catch { /* ignore */ }
      })();
    }

    ok(res, { likeCount: moment.likes.length, isLiked: idx === -1 });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/moments/:id/comment ─────────────────────────────────────────────
router.post('/:id/comment', auth, async (req, res, next) => {
  try {
    const { content, parentCommentId } = req.body;
    if (!content) return err(res, 'content required');
    if (content.length > 200) return err(res, 'comment max 200 chars');
    if (hasProfanity(content)) return err(res, 'Inappropriate content', 422);

    const moment = await Moment.findOne({ _id: req.params.id, isActive: true });
    if (!moment) return err(res, 'Moment not found', 404);

    const comment = await MomentComment.create({
      moment: moment._id,
      user: req.user._id,
      content,
      parentComment: parentCommentId ?? null,
    });

    await Moment.findByIdAndUpdate(moment._id, { $inc: { commentsCount: 1 } });

    const populated = await comment.populate('user', 'nickname avatarUrl');

    // Push moment author about the new comment (skip self-comment).
    if (String(moment.user) !== String(req.user._id)) {
      sendPushToUser(moment.user, {
        title: `${populated.user?.nickname || 'Someone'} commented`,
        body: content.slice(0, 120),
        data: { type: 'comment', momentId: String(moment._id) },
      }).catch(() => {});
    }

    created(res, {
      ...populated.toObject(),
      likeCount: 0,
      isLiked: false,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/moments/:id/comments/:commentId ───────────────────────────────
router.delete('/:id/comments/:commentId', auth, async (req, res, next) => {
  try {
    const comment = await MomentComment.findOne({
      _id: req.params.commentId,
      user: req.user._id,
      moment: req.params.id,
    });
    if (!comment) return err(res, 'Comment not found', 404);

    await comment.deleteOne();
    await Moment.findByIdAndUpdate(req.params.id, {
      $inc: { commentsCount: -1 },
    });

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/moments/:id/comments ─────────────────────────────────────────────
router.get('/:id/comments', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const comments = await MomentComment.find({ moment: req.params.id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'nickname avatarUrl')
      .lean();

    ok(res, comments.map((c) => ({
      ...c,
      likeCount: c.likes.length,
      isLiked: c.likes.some((id) => id.toString() === req.user._id.toString()),
      likes: undefined,
    })));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
