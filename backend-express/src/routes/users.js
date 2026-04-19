const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res, next) => {
  try {
    ok(res, req.user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
router.patch('/me', auth, async (req, res, next) => {
  try {
    const allowed = [
      'nickname', 'bio', 'tags', 'height', 'weight', 'age', 'countryCode', 'lookingFor', 'role',
      'zodiac', 'mbti', 'bloodType', 'kinks',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    });
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/users/settings  (preferences / privacy) ───────────────────────
router.patch('/settings', auth, async (req, res, next) => {
  try {
    const prefFields = [
      'hideDistance', 'hideOnlineStatus', 'hideFromNearby',
      'stealthMode', 'stealthOption', 'stealthUntil',
    ];
    const prefUpdate = {};
    for (const f of prefFields) {
      if (req.body[f] !== undefined) prefUpdate[`preferences.${f}`] = req.body[f];
    }

    const user = await User.findByIdAndUpdate(req.user._id, prefUpdate, {
      new: true,
    });
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── PUT /api/users/me/location ────────────────────────────────────────────────
router.put('/me/location', auth, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return err(res, 'latitude and longitude required');
    }
    await User.findByIdAndUpdate(req.user._id, {
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      lastActiveAt: new Date(),
      isOnline: true,
    });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/me/teleport ───────────────────────────────────────────────
router.post('/me/teleport', auth, async (req, res, next) => {
  try {
    const { latitude, longitude, label } = req.body;
    if (latitude == null || longitude == null) {
      return err(res, 'latitude and longitude required');
    }
    await User.findByIdAndUpdate(req.user._id, {
      'preferences.virtualLat': latitude,
      'preferences.virtualLng': longitude,
      'preferences.virtualLocationLabel': label ?? null,
    });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/users/me/teleport ─────────────────────────────────────────────
router.delete('/me/teleport', auth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'preferences.virtualLat': null,
      'preferences.virtualLng': null,
      'preferences.virtualLocationLabel': null,
    });
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/users/me/stealth ───────────────────────────────────────────────
router.patch('/me/stealth', auth, async (req, res, next) => {
  try {
    const { enabled } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      'preferences.stealthMode': !!enabled,
      'preferences.hideFromNearby': !!enabled,
    });
    ok(res, { success: true, stealthMode: !!enabled });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/nearby ─────────────────────────────────────────────────────
router.get('/nearby', auth, async (req, res, next) => {
  try {
    const {
      lat, lng,
      minAge, maxAge,
      minHeight, maxHeight,
      minWeight, maxWeight,
      tags,
      role, zodiac, mbti, bloodType, kinks,
      maxDistance = 50000, // metres — default 50 km
      limit = 50,
    } = req.query;

    const me = req.user;

    // Resolve effective coordinates (teleport overrides real location)
    const effectiveLng =
      parseFloat(lng) ||
      me.preferences?.virtualLng ||
      me.location?.coordinates?.[0] ||
      101.6869; // KL default
    const effectiveLat =
      parseFloat(lat) ||
      me.preferences?.virtualLat ||
      me.location?.coordinates?.[1] ||
      3.1390;

    // Update real location if provided
    if (lat && lng) {
      await User.findByIdAndUpdate(me._id, {
        location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        lastActiveAt: new Date(),
        isOnline: true,
      });
    }

    // Build filter: exclude self, blocked users, users who blocked us,
    // stealth/hideFromNearby users
    const blockedByMe = me.blockedUsers.map((id) => id.toString());

    const usersWhoBlockedMe = await User.find(
      { blockedUsers: me._id },
      { _id: 1 }
    ).lean();
    const blockedByOthers = usersWhoBlockedMe.map((u) => u._id.toString());

    const excludeIds = [
      ...blockedByMe,
      ...blockedByOthers,
    ].map((id) => new mongoose.Types.ObjectId(id.toString()));

    // Build match stage
    const matchStage = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
    };

    if (minAge || maxAge) {
      matchStage.age = {};
      if (minAge) matchStage.age.$gte = parseInt(minAge);
      if (maxAge) matchStage.age.$lte = parseInt(maxAge);
    }
    if (minHeight || maxHeight) {
      matchStage.height = {};
      if (minHeight) matchStage.height.$gte = parseInt(minHeight);
      if (maxHeight) matchStage.height.$lte = parseInt(maxHeight);
    }
    if (minWeight || maxWeight) {
      matchStage.weight = {};
      if (minWeight) matchStage.weight.$gte = parseInt(minWeight);
      if (maxWeight) matchStage.weight.$lte = parseInt(maxWeight);
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      if (tagList.length) matchStage.tags = { $in: tagList };
    }
    if (role) matchStage.role = role;
    if (zodiac) matchStage.zodiac = zodiac;
    if (mbti) matchStage.mbti = mbti;
    if (bloodType) matchStage.bloodType = bloodType;
    if (kinks) {
      const kinkList = Array.isArray(kinks) ? kinks : [kinks];
      if (kinkList.length) matchStage.kinks = { $in: kinkList };
    }

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [effectiveLng, effectiveLat] },
          distanceField: 'distanceMeters',
          maxDistance: parseInt(maxDistance),
          spherical: true,
          query: matchStage,
        },
      },
      { $limit: parseInt(limit) },
      {
        $project: {
          password: 0, fcmToken: 0, dailySwipes: 0,
          dailySwipesDate: 0, blockedUsers: 0, __v: 0,
        },
      },
      { $addFields: { id: { $toString: '$_id' } } },
    ];

    const users = await User.aggregate(pipeline);
    // $sort inside the aggregation pipeline is unreliable after $geoNear on Atlas M0;
    // sort in JS to guarantee ascending distance order.
    users.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    const result = users.map((u) => {
      const dm = u.distanceMeters;
      const label =
        dm < 1000
          ? `${Math.round(dm)} m`
          : `${(dm / 1000).toFixed(1)} km`;
      return { ...u, distanceLabel: label };
    });

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/discover ───────────────────────────────────────────────────
router.get('/discover', auth, async (req, res, next) => {
  try {
    const Swipe = require('../models/Swipe');
    const me = req.user;
    const { role, zodiac, mbti, bloodType, kinks } = req.query;

    const alreadySwiped = await Swipe.find({ fromUser: me._id }, { toUser: 1 }).lean();
    const swipedIds = alreadySwiped.map((s) => s.toUser);

    const blockedByMe = me.blockedUsers;
    const usersWhoBlockedMe = await User.find(
      { blockedUsers: me._id },
      { _id: 1 }
    ).lean();

    const excludeIds = [
      ...swipedIds,
      ...blockedByMe,
      ...usersWhoBlockedMe.map((u) => u._id),
    ];

    const lat =
      me.preferences?.virtualLat || me.location?.coordinates?.[1] || 3.1390;
    const lng =
      me.preferences?.virtualLng || me.location?.coordinates?.[0] || 101.6869;

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: 100000, // 100 km
          spherical: true,
          query: {
            _id: { $nin: excludeIds },
            'preferences.hideFromNearby': { $ne: true },
            'preferences.stealthMode': { $ne: true },
            ...(role ? { role } : {}),
            ...(zodiac ? { zodiac } : {}),
            ...(mbti ? { mbti } : {}),
            ...(bloodType ? { bloodType } : {}),
            ...(kinks ? { kinks: { $in: Array.isArray(kinks) ? kinks : [kinks] } } : {}),
          },
        },
      },
      { $sample: { size: 30 } },
      {
        $project: {
          password: 0, fcmToken: 0, dailySwipes: 0,
          dailySwipesDate: 0, blockedUsers: 0, __v: 0,
        },
      },
      { $addFields: { id: { $toString: '$_id' } } },
    ];

    const users = await User.aggregate(pipeline);
    ok(res, users);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/locations ──────────────────────────────────────────────────
// Returns all non-stealth users with coordinates, for the 3-D globe view.
// IMPORTANT: must stay before GET /:id to avoid "locations" being cast as ObjectId.
router.get('/locations', auth, async (req, res, next) => {
  try {
    const users = await User.find(
      {
        'location.coordinates': { $exists: true, $ne: null },
        'preferences.stealthMode':    { $ne: true },
        'preferences.hideFromNearby': { $ne: true },
      },
      { _id: 1, nickname: 1, photos: { $slice: 1 }, location: 1,
        isOnline: 1, 'preferences.hideDistance': 1 }
    ).lean();

    const result = users.map((u) => ({
      id: u._id.toString(),
      nickname: u.nickname || '用户',
      lat: u.location?.coordinates?.[1],
      lng: u.location?.coordinates?.[0],
      avatar: u.photos?.[0] ?? null,
      isOnline: u.isOnline ?? false,
      privacy: u.preferences?.hideDistance ? 'blur' : 'normal',
    })).filter((u) => u.lat != null && u.lng != null);

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/likes ──────────────────────────────────────────────────────
router.get('/likes', auth, async (req, res, next) => {
  try {
    const Swipe = require('../models/Swipe');
    const me = req.user;

    const swipes = await Swipe.find({
      toUser: me._id,
      direction: { $in: ['like', 'super_like'] },
    })
      .sort({ createdAt: -1 })
      .populate('fromUser', '-password -fcmToken -blockedUsers -dailySwipes -dailySwipesDate')
      .lean();

    const likers = swipes.map((s) => s.fromUser);

    if (me.isPremium) {
      ok(res, { count: likers.length, users: likers });
    } else {
      // Free: return count + blurred (just IDs + placeholder)
      ok(res, {
        count: likers.length,
        users: likers.map((u) => ({
          _id: u._id,
          nickname: '??',
          avatarUrl: null,
          isBlurred: true,
        })),
      });
    }
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -fcmToken -blockedUsers -dailySwipes -dailySwipesDate'
    );
    if (!user) return err(res, 'User not found', 404);
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
