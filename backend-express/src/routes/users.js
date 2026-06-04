const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { computeAge } = require('../utils/zodiac');

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
      'nickname', 'bio', 'tags', 'height', 'weight', 'age', 'dob', 'bodyType', 'occupation', 'city',
      'countryCode', 'lookingFor', 'role',
      'zodiac', 'mbti', 'bloodType', 'kinks',
      'relationshipStatus', 'intents',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // DOB is the source of truth: normalize it and denormalize the computed age
    // into `age` so the existing nearby age-range filter (matchStage.age) keeps
    // working with no query change. Sending dob:null clears both.
    if (updates.dob !== undefined) {
      const d = updates.dob ? new Date(updates.dob) : null;
      if (d && !isNaN(d.getTime())) {
        updates.dob = d;
        const a = computeAge(d);
        if (a != null) updates.age = a;
      } else {
        updates.dob = null;
      }
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
          // $aggregate bypasses Mongoose select:false — every secret must be
          // excluded explicitly (email, devices/IPs, OTP/reset, IAP tokens…).
          password: 0, fcmToken: 0, dailySwipes: 0,
          dailySwipesDate: 0, blockedUsers: 0, __v: 0,
          email: 0, devices: 0, deviceFingerprint: 0,
          appleOriginalTransactionId: 0, googleOriginalPurchaseToken: 0,
          loginAttempts: 0, lockoutUntil: 0,
          resetCode: 0, resetCodeExpiry: 0, otpCode: 0, otpExpiry: 0,
          googleId: 0, appleId: 0,
        },
      },
      { $addFields: { id: { $toString: '$_id' }, popularity: { $add: [{ $ifNull: ['$totalLikesReceived', 0] }, { $ifNull: ['$followersCount', 0] }] } } },
    ];

    const users = await User.aggregate(pipeline);
    // $sort inside the aggregation pipeline is unreliable after $geoNear on Atlas M0;
    // sort in JS to guarantee ascending distance order.
    users.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    // Remove self from aggregation results (may appear with non-zero GPS jitter distance),
    // then re-insert at position 0 with exact 0 m distance.
    const selfId = me._id.toString();
    const others = users.filter((u) => u._id.toString() !== selfId);

    const selfEntry = {
      ...me.toObject(),
      id: selfId,
      distanceMeters: 0,
      distanceLabel: '0 m',
    };

    const combined = [selfEntry, ...others];

    const result = combined.map((u) => {
      if (u.distanceMeters === 0 && u.distanceLabel) return u; // self entry already formatted
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
          // $aggregate bypasses Mongoose select:false — every secret must be
          // excluded explicitly (email, devices/IPs, OTP/reset, IAP tokens…).
          password: 0, fcmToken: 0, dailySwipes: 0,
          dailySwipesDate: 0, blockedUsers: 0, __v: 0,
          email: 0, devices: 0, deviceFingerprint: 0,
          appleOriginalTransactionId: 0, googleOriginalPurchaseToken: 0,
          loginAttempts: 0, lockoutUntil: 0,
          resetCode: 0, resetCodeExpiry: 0, otpCode: 0, otpExpiry: 0,
          googleId: 0, appleId: 0,
        },
      },
      { $addFields: { id: { $toString: '$_id' }, popularity: { $add: [{ $ifNull: ['$totalLikesReceived', 0] }, { $ifNull: ['$followersCount', 0] }] } } },
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
        isOnline: 1, lastActiveAt: 1, 'preferences.hideDistance': 1 }
    ).lean();

    const result = users.map((u) => ({
      id: u._id.toString(),
      nickname: u.nickname || '用户',
      lat: u.location?.coordinates?.[1],
      lng: u.location?.coordinates?.[0],
      avatar: u.photos?.[0] ?? null,
      isOnline: u.isOnline ?? false,
      lastActive: u.lastActiveAt ?? null,
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

    // Drop null entries — populate('fromUser') returns null when the liker
    // has been deleted, but the Swipe row stays behind. Including those as
    // nulls in the wire array crashes mobile clients that key/render off
    // user._id, and makes the count disagree with the array length.
    const likers = swipes.map((s) => s.fromUser).filter(Boolean);

    const { isPremiumActive } = require('../utils/premium');
    if (isPremiumActive(me)) {
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

// ── GET /api/users/widget-data ────────────────────────────────────────────────
router.get('/widget-data', auth, async (req, res, next) => {
  try {
    const me = req.user;
    const Match = require('../models/Match');

    const effectiveLng = me.preferences?.virtualLng ?? me.location?.coordinates?.[0] ?? 101.6869;
    const effectiveLat = me.preferences?.virtualLat ?? me.location?.coordinates?.[1] ?? 3.1390;

    // Nearby online users within 50 km
    const nearbyUsers = await User.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [effectiveLng, effectiveLat] },
          distanceField: 'dist',
          maxDistance: 50000,
          spherical: true,
        },
      },
      {
        $match: {
          _id: { $ne: me._id },
          isOnline: true,
          'preferences.stealthMode': { $ne: true },
          'preferences.hideFromNearby': { $ne: true },
        },
      },
      { $project: { dist: 1 } },
    ]);

    const nearbyOnline = nearbyUsers.length;
    let closestDistance = '--';
    if (nearbyUsers.length > 0) {
      const m = nearbyUsers[0].dist;
      closestDistance = m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
    }

    // Recent conversations
    const matches = await Match.find({ users: me._id, isActive: true })
      .sort({ lastMessageAt: -1 })
      .limit(3)
      .populate('users', 'nickname avatarUrl isOnline')
      .lean();

    const recentChats = matches
      .map((m) => {
        const other = m.users.find((u) => u && u._id.toString() !== me._id.toString());
        if (!other) return null;
        return {
          userId: other._id.toString(),
          name: other.nickname,
          avatar: other.avatarUrl ?? '',
          isOnline: other.isOnline ?? false,
          unread: m.unreadCounts?.[me._id.toString()] ?? 0,
        };
      })
      .filter(Boolean);

    ok(res, { nearbyOnline, closestDistance, recentChats });
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
    // self=false → strip the viewed user's email (PII) from the response.
    const json = user.toPublicJSON(undefined, { self: false });
    // Follow relationship for the requester (mutual / following / followed-by).
    if (user._id.toString() !== req.user._id.toString()) {
      const { followStatusMap } = require('../utils/followStatus');
      const fsMap = await followStatusMap(req.user._id, [user._id]);
      json.followStatus = fsMap.get(user._id.toString()) || 'none';
      // Did this user already like ("想认识") the viewer? Flips the like button
      // to "成为同频" since tapping it would create the mutual match.
      const { incomingLikerSet } = require('../utils/incomingLikes');
      const likers = await incomingLikerSet(req.user._id, [user._id]);
      json.likedByThem = likers.has(user._id.toString());
    }
    ok(res, json);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
