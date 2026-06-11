const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { computeAge } = require('../utils/zodiac');
const { NOT_OFFICIAL, isNotOfficial } = require('../utils/discovery');
const { blockedIdSet } = require('../utils/blocking');
const ProfileView = require('../models/ProfileView');

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res, next) => {
  try {
    ok(res, req.user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/me/viewers ─────────────────────────────────────────────────
// "谁在看你" — unique viewers, newest-first. Premium sees real identities; free
// sees the count + blurred rows (real avatar, hidden name) → Premium upsell.
// Defined before /:id so the path isn't swallowed by the id route.
router.get('/me/viewers', auth, async (req, res, next) => {
  try {
    const views = await ProfileView.find({ viewedId: req.user._id })
      .sort({ viewedAt: -1 })
      .limit(100)
      .populate('viewerId', 'nickname avatarUrl isOnline lastActiveAt isPremium isVerified isOfficial dob location')
      .lean();
    // populate → null if deleted; also hide official accounts (Meyou 官方)
    const valid = views.filter((v) => v.viewerId && isNotOfficial(v.viewerId));
    const { isPremiumActive } = require('../utils/premium');
    const { haversineMeters } = require('../utils/geo');
    const myCoords = req.user.location?.coordinates;
    const premium = isPremiumActive(req.user);
    const viewers = valid.map((v) => {
      const u = v.viewerId;
      const base = { viewedAt: v.viewedAt.toISOString(), _id: u._id };
      if (premium) {
        return {
          ...base,
          nickname: u.nickname,
          avatarUrl: u.avatarUrl ?? null,
          isOnline: u.isOnline ?? false,
          dob: u.dob ? u.dob.toISOString() : null,
          lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
          distanceM: haversineMeters(myCoords, u.location?.coordinates),
          isOfficial: u.isOfficial ?? false,
          isVerified: u.isVerified ?? false,
          isPremium: u.isPremium ?? false,
          isBlurred: false,
        };
      }
      return { ...base, nickname: '??', avatarUrl: u.avatarUrl ?? null, isBlurred: true };
    });
    ok(res, { count: valid.length, viewers });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/:id/view ──────────────────────────────────────────────────
// Log a profile view (fire-and-forget from the client when AboutUserSheet opens).
// Upsert keeps one row per viewer→viewed pair and bumps viewedAt. Self is a no-op.
router.post('/:id/view', auth, async (req, res, next) => {
  try {
    const viewedId = req.params.id;
    if (!mongoose.isValidObjectId(viewedId)) return err(res, 'Invalid id');
    if (viewedId === req.user._id.toString()) return ok(res, { skipped: true });
    // Premium incognito browsing → don't log the view. Honored only while
    // Premium is active; a lapsed subscriber falls through to normal logging.
    const { isPremiumActive } = require('../utils/premium');
    if (req.user.incognitoBrowsing && isPremiumActive(req.user)) {
      return res.status(204).end();
    }
    await ProfileView.findOneAndUpdate(
      { viewerId: req.user._id, viewedId },
      { $set: { viewedAt: new Date() } },
      { upsert: true },
    );
    ok(res, { ok: true });
  } catch (e) {
    // A racing upsert can throw a duplicate-key once; not worth failing the call.
    if (e && e.code === 11000) return ok(res, { ok: true });
    next(e);
  }
});

// Names reserved for official accounts (anti-impersonation). `meyou`/`密友` are
// brand substrings (block anything containing them — covers "Meyou 官方",
// "Meyou Official", etc.); the rest match the full normalized name.
const RESERVED_SUBSTR = ['meyou', '密友'];
const RESERVED_EXACT = [
  'admin', '管理员', '管理員', 'support', '客服', 'notification', 'system', '系统',
  '官方', 'official', 'bot',
];
function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[\s._\-]/g, '').trim();
}
function isReservedName(name) {
  const n = normalizeName(name);
  if (!n) return false;
  if (RESERVED_SUBSTR.some((r) => n.includes(r))) return true;
  return RESERVED_EXACT.includes(n);
}

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
router.patch('/me', auth, async (req, res, next) => {
  try {
    const allowed = [
      'nickname', 'bio', 'tags', 'height', 'weight', 'age', 'dob', 'bodyType', 'city',
      'countryCode', 'lookingFor', 'role',
      'zodiac', 'mbti', 'bloodType', 'kinks',
      'relationshipStatus', 'intents',
      'mobileGames', 'isPublicProfile', 'incognitoBrowsing', 'voiceIntroUrl',
      'preferredLanguage',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // preferredLanguage: only accept the supported UI locales; anything else
    // (incl. region variants) is ignored so push localization stays predictable.
    if (updates.preferredLanguage !== undefined) {
      const lang = String(updates.preferredLanguage || '').slice(0, 2).toLowerCase();
      if (['zh', 'en', 'ko', 'ja'].includes(lang)) updates.preferredLanguage = lang;
      else delete updates.preferredLanguage;
    }

    // mobileGames: trim, drop empties, cap each entry at 30 chars, dedupe
    // (case-insensitive), cap the list at 10.
    if (updates.mobileGames !== undefined) {
      const raw = Array.isArray(updates.mobileGames) ? updates.mobileGames : [];
      const seen = new Set();
      const clean = [];
      for (const g of raw) {
        const v = String(g ?? '').trim().slice(0, 30);
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        clean.push(v);
        if (clean.length >= 10) break;
      }
      updates.mobileGames = clean;
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

    // Block changing your display name TO a reserved/official name (unless this
    // IS an official account). Existing names are untouched — this only fires on
    // a change.
    if (updates.nickname !== undefined && req.user.isOfficial !== true && isReservedName(updates.nickname)) {
      return res.status(400).json({ error: 'This name is reserved for official use', code: 'RESERVED_NAME' });
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
      'hideDistance', 'hideOnlineStatus', 'hidePopularity', 'hideFromNearby',
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
    // Virtual location ("location spoofing") is a Premium feature.
    const { isPremiumActive } = require('../utils/premium');
    if (!isPremiumActive(req.user)) {
      return res.status(403).json({ error: 'Premium required', code: 'PREMIUM_REQUIRED' });
    }
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
      ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from discovery
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
            ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from discovery
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
    const blockedArr = [...(await blockedIdSet(req.user))];
    const users = await User.find(
      {
        'location.coordinates': { $exists: true, $ne: null },
        'preferences.stealthMode':    { $ne: true },
        'preferences.hideFromNearby': { $ne: true },
        _id: { $nin: blockedArr },
        ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from the globe
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

    const blocked = await blockedIdSet(me);
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
    // user._id, and makes the count disagree with the array length. Also drop
    // anyone in a mutual block with the viewer.
    const likers = swipes
      .map((s) => s.fromUser)
      .filter(isNotOfficial)
      .filter((u) => !blocked.has(String(u._id)));

    const { isPremiumActive } = require('../utils/premium');
    if (isPremiumActive(me)) {
      // Full user docs already carry dob/lastActiveAt/location; add a numeric
      // distance so the client can sort by 距离. (dob/lastActiveAt serialize to
      // ISO via JSON automatically.)
      const { haversineMeters } = require('../utils/geo');
      const myCoords = me.location?.coordinates;
      ok(res, {
        count: likers.length,
        users: likers.map((u) => ({ ...u, distanceM: haversineMeters(myCoords, u.location?.coordinates) })),
      });
    } else {
      // Free: count + blurred rows. We DO send the real avatarUrl so the client
      // can render a heavily-blurred teaser (blurRadius), but the name stays
      // hidden — identity is the gated value. Tapping a row → Premium upsell.
      ok(res, {
        count: likers.length,
        users: likers.map((u) => ({
          _id: u._id,
          nickname: '??',
          avatarUrl: u.avatarUrl ?? null,
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
          ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from widget
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
    // Mutual block: a blocked user's profile is "unavailable" to the viewer
    // (and the viewer's to them). 404 + code so the client shows 用户不可用.
    const blocked = await blockedIdSet(req.user);
    if (blocked.has(String(req.params.id))) {
      return res.status(404).json({ error: 'User unavailable', code: 'BLOCKED' });
    }

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
      // Gated: only Premium viewers get the "成为同频" shortcut (PR H).
      const { incomingLikerSet } = require('../utils/incomingLikes');
      const { isPremiumActive } = require('../utils/premium');
      const likers = await incomingLikerSet(req.user._id, [user._id]);
      json.likedByThem = isPremiumActive(req.user) && likers.has(user._id.toString());
    }
    ok(res, json);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
