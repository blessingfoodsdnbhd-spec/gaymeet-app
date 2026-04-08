const router = require('express').Router();
const Shout = require('../models/Shout');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { hasProfanity } = require('../utils/profanityFilter');

// ── GET /api/shouts ───────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const { radius = 10000 } = req.query; // metres
    const me = req.user;

    const lng =
      me.preferences?.virtualLng ?? me.location?.coordinates?.[0] ?? 101.6869;
    const lat =
      me.preferences?.virtualLat ?? me.location?.coordinates?.[1] ?? 3.1390;

    const now = new Date();
    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: parseInt(radius),
          spherical: true,
          query: { expiresAt: { $gt: now } },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: '$userDoc' },
      {
        $project: {
          content: 1,
          createdAt: 1,
          distanceMeters: 1,
          expiresAt: 1,
          'userDoc.nickname': 1,
          'userDoc.avatarUrl': 1,
          'userDoc.countryCode': 1,
          'userDoc._id': 1,
        },
      },
    ];

    const shouts = await Shout.aggregate(pipeline);

    const result = shouts.map((s) => ({
      id: s._id,
      content: s.content,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      distanceMeters: s.distanceMeters,
      user: s.userDoc,
    }));

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/shouts/mine ──────────────────────────────────────────────────────
router.get('/mine', auth, async (req, res, next) => {
  try {
    const shout = await Shout.findOne({
      user: req.user._id,
      expiresAt: { $gt: new Date() },
    }).lean();

    ok(res, shout ?? null);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/shouts ──────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return err(res, 'content required');
    if (content.length > 140) return err(res, 'Max 140 characters');
    if (hasProfanity(content)) return err(res, 'Inappropriate content', 422);

    const me = req.user;
    const lng =
      me.preferences?.virtualLng ?? me.location?.coordinates?.[0] ?? 101.6869;
    const lat =
      me.preferences?.virtualLat ?? me.location?.coordinates?.[1] ?? 3.1390;

    // One active shout per user — delete previous
    await Shout.deleteMany({ user: me._id });

    const shout = await Shout.create({
      user: me._id,
      content,
      location: { type: 'Point', coordinates: [lng, lat] },
    });

    created(res, {
      id: shout._id,
      content: shout.content,
      createdAt: shout.createdAt,
      expiresAt: shout.expiresAt,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/shouts ────────────────────────────────────────────────────────
router.delete('/', auth, async (req, res, next) => {
  try {
    await Shout.deleteMany({ user: req.user._id });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
