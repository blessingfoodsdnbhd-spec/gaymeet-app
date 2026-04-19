const router = require('express').Router();
const User = require('../models/User');
const Moment = require('../models/Moment');
const Place = require('../models/Place');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── GET /api/globe/points ─────────────────────────────────────────────────────
// Returns all three point types for the 3-D globe view:
//   { users, posts, places, userLat, userLng }
router.get('/points', auth, async (req, res, next) => {
  try {
    const [rawUsers, rawPosts, rawPlaces, me] = await Promise.all([
      User.find(
        {
          'location.coordinates': { $exists: true, $ne: null },
          'preferences.stealthMode': { $ne: true },
          'preferences.hideFromNearby': { $ne: true },
        },
        { _id: 1, nickname: 1, photos: { $slice: 1 }, location: 1,
          isOnline: 1, 'preferences.hideDistance': 1 }
      ).lean(),

      Moment.find(
        { hasLocation: true, isActive: true },
        { _id: 1, content: 1, location: 1, likes: 1, commentsCount: 1, createdAt: 1 }
      ).lean(),

      Place.find(
        { isActive: true },
        { _id: 1, name: 1, location: 1, isVerified: 1, category: 1 }
      ).lean(),

      User.findById(req.user._id, { location: 1 }).lean(),
    ]);

    const users = rawUsers.map((u) => ({
      id: u._id.toString(),
      nickname: u.nickname || '用户',
      lat: u.location?.coordinates?.[1],
      lng: u.location?.coordinates?.[0],
      avatar: u.photos?.[0] ?? null,
      isOnline: u.isOnline ?? false,
      privacy: u.preferences?.hideDistance ? 'blur' : 'normal',
    })).filter((u) => u.lat != null && u.lng != null);

    const posts = rawPosts.map((p) => ({
      id: p._id.toString(),
      content: (p.content || '').substring(0, 50),
      lat: p.location?.coordinates?.[1],
      lng: p.location?.coordinates?.[0],
      likeCount: p.likes?.length ?? 0,
      commentsCount: p.commentsCount ?? 0,
      createdAt: p.createdAt,
    })).filter((p) => p.lat != null && p.lng != null);

    const places = rawPlaces.map((pl) => {
      const lng = pl.location?.coordinates?.[0];
      const lat = pl.location?.coordinates?.[1];
      return {
        id: pl._id.toString(),
        name: pl.name,
        lat,
        lng,
        category: pl.category,
        isPromoted: pl.isVerified ?? false,
      };
    }).filter((pl) => pl.lat != null && pl.lng != null && !(pl.lat === 0 && pl.lng === 0));

    const myLat = me?.location?.coordinates?.[1] ?? null;
    const myLng = me?.location?.coordinates?.[0] ?? null;

    ok(res, { users, posts, places, userLat: myLat, userLng: myLng });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
