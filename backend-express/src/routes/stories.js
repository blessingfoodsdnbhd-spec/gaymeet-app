const router = require('express').Router();
const Story = require('../models/Story');
const Follow = require('../models/Follow');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { ok, created, err } = require('../utils/respond');

// ── GET /api/stories — feed: public stories + followed users' followers-only ────
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Users I follow
    const followDocs = await Follow.find({ follower: userId })
      .select('following')
      .lean();
    const followingIds = followDocs.map((f) => f.following);

    const stories = await Story.find({
      expiresAt: { $gt: now },
      $or: [
        { user: userId }, // own stories (all visibilities)
        { user: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } },
        { visibility: 'public' }, // public stories from anyone
      ],
    })
      .sort({ user: 1, createdAt: 1 })
      .populate('user', 'nickname avatarUrl')
      .lean();

    // Group by user
    const grouped = {};
    for (const s of stories) {
      const uid = s.user._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = {
          user: s.user,
          stories: [],
          hasUnviewed: false,
        };
      }
      const isViewed = s.viewedBy.some(
        (id) => id.toString() === userId.toString()
      );
      if (!isViewed) grouped[uid].hasUnviewed = true;
      grouped[uid].stories.push({
        ...s,
        isViewed,
        viewedBy: undefined,
      });
    }

    ok(res, Object.values(grouped));
  } catch (e) {
    next(e);
  }
});

// ── GET /api/stories/:userId — all active stories from a specific user ─────────
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const now = new Date();
    const stories = await Story.find({
      user: req.params.userId,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: 1 })
      .lean();

    const uid = req.user._id;
    ok(
      res,
      stories.map((s) => ({
        ...s,
        isViewed: s.viewedBy.some((id) => id.toString() === uid.toString()),
        viewedBy: undefined,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// ── POST /api/stories — create a new story ────────────────────────────────────
router.post(
  '/',
  auth,
  upload.single('media'),
  async (req, res, next) => {
    try {
      if (!req.file) return err(res, 'media file required');

      const { caption = '', mediaType = 'image', visibility = 'followers', lat, lng } = req.body;
      const host = `${req.protocol}://${req.get('host')}`;
      const mediaUrl = `${host}/uploads/${req.file.filename}`;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      const data = {
        user: req.user._id,
        mediaUrl,
        mediaType: ['image', 'video'].includes(mediaType) ? mediaType : 'image',
        caption: caption.slice(0, 100),
        visibility: ['public', 'followers', 'private'].includes(visibility) ? visibility : 'followers',
        expiresAt,
      };

      if (lat != null && lng != null) {
        data.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
        data.hasLocation = true;
      }

      const story = await Story.create(data);

      created(res, story.toObject());
    } catch (e) {
      next(e);
    }
  }
);

// ── DELETE /api/stories/:id — delete own story ────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!story) return err(res, 'Story not found', 404);

    await story.deleteOne();
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/stories/:id/view — mark story as viewed ────────────────────────
router.post('/:id/view', auth, async (req, res, next) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      expiresAt: { $gt: new Date() },
    });
    if (!story) return err(res, 'Story not found', 404);

    const uid = req.user._id;
    const alreadyViewed = story.viewedBy.some(
      (id) => id.toString() === uid.toString()
    );
    if (!alreadyViewed) {
      story.viewedBy.push(uid);
      story.viewCount += 1;
      await story.save();
    }

    ok(res, { viewCount: story.viewCount });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
