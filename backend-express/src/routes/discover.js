const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const { NOT_OFFICIAL } = require('../utils/discovery');
const { followStatusMap } = require('../utils/followStatus');
const { incomingLikerSet } = require('../utils/incomingLikes');
const { isPremiumActive } = require('../utils/premium');

const MAX_DISTANCE_M = 100_000; // 100 km — Meyou is Malaysia-only at launch

// Resolve the origin coordinates for distance/geo queries. Premium users with a
// virtual location set ("location spoofing") use that; everyone else uses their
// real GPS location. KL is the last-resort default when neither is present.
function resolveOrigin(me) {
  const v = me.preferences || {};
  if (isPremiumActive(me) && v.virtualLat != null && v.virtualLng != null) {
    return { lat: v.virtualLat, lng: v.virtualLng };
  }
  return {
    lat: me.location?.coordinates?.[1] ?? 3.1390,
    lng: me.location?.coordinates?.[0] ?? 101.6869,
  };
}

function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Hide a Premium user's presence (online dot AND last-active time) from other
// viewers when they've opted in. The aggregation paths bypass toPublicJSON, so
// we re-apply the same gating here — otherwise the AboutUserSheet (fed from
// these cards) would still leak "X 分钟前活跃".
function presenceFields(u) {
  const hidden = !!u.preferences?.hideOnlineStatus && isPremiumActive(u);
  return {
    lastActiveAt: hidden ? null : u.lastActiveAt,
    isOnline: hidden ? false : u.isOnline,
  };
}

function computeShared(myTags, otherTags) {
  const set = new Set(myTags || []);
  return (otherTags || []).filter((t) => set.has(t));
}

// ── GET /api/discover/cards?count=10 ─────────────────────────────────────────
// Interest-aware swipe deck.
//
// Filtering:
//  - exclude self, blocked-by-me, users-who-blocked-me, already-swiped
//  - exclude users with empty interests array
//  - exclude users hiding from nearby + stealth mode
// Sorting:
//  - users with ≥1 shared tag first, sorted by overlap desc, then distance asc
//  - then everyone else (no overlap) by distance asc, as a fallback when the
//    user's tag pool is small
router.get('/cards', auth, async (req, res, next) => {
  try {
    const me = req.user;
    const count = Math.min(parseInt(req.query.count, 10) || 10, 30);

    // Optional filter overrides. Distance defaults to MAX_DISTANCE_M.
    const radiusKmRaw = parseFloat(req.query.radiusKm);
    const maxDistance = Number.isFinite(radiusKmRaw) && radiusKmRaw > 0
      ? Math.min(radiusKmRaw * 1000, MAX_DISTANCE_M)
      : MAX_DISTANCE_M;

    // `interests` query param: comma-separated tag ids (or repeated values).
    // When provided, only candidates with at least one matching tag are returned.
    const interestsParam = req.query.interests;
    let filterInterests = null;
    if (interestsParam) {
      const arr = Array.isArray(interestsParam)
        ? interestsParam
        : String(interestsParam).split(',');
      filterInterests = arr.map((s) => String(s).trim()).filter(Boolean);
      if (filterInterests.length === 0) filterInterests = null;
    }

    const alreadySwiped = await Swipe.find({ fromUser: me._id }, { toUser: 1 }).lean();
    const swipedIds = alreadySwiped.map((s) => s.toUser);
    const usersWhoBlockedMe = await User.find({ blockedUsers: me._id }, { _id: 1 }).lean();
    const excludeIds = [
      me._id,
      ...swipedIds,
      ...(me.blockedUsers || []),
      ...usersWhoBlockedMe.map((u) => u._id),
    ];

    const { lat, lng } = resolveOrigin(me); // Premium virtual location or GPS
    const myInterests = me.interests || [];

    const baseQuery = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
      isDeleted: { $ne: true },
      ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from discovery
    };
    if (filterInterests) {
      baseQuery.interests = { $in: filterInterests };
    }

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance,
          spherical: true,
          query: baseQuery,
        },
      },
      {
        $addFields: {
          sharedTags: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$interests', []] } }, 0] },
              then: { $setIntersection: ['$interests', myInterests] },
              else: [],
            },
          },
        },
      },
      { $addFields: { sharedCount: { $size: '$sharedTags' } } },
      // Premium Boost — surface boosted-and-not-expired users first. Without
      // this, POST /api/users/boost was an orphan (it set isBoosted=true but
      // /cards never consulted the field). The expiry guard is critical:
      // boostExpiresAt stays in the doc indefinitely after activation, so a
      // naive `$sort: { isBoosted: -1 }` would keep a long-expired user
      // pinned at the top forever.
      {
        $addFields: {
          isActiveBoosted: {
            $and: [
              { $eq: [{ $ifNull: ['$isBoosted', false] }, true] },
              { $ne: ['$boostExpiresAt', null] },
              { $gt: ['$boostExpiresAt', '$$NOW'] },
            ],
          },
        },
      },
      // Sort: active boost first, then overlap desc, then distance asc.
      { $sort: { isActiveBoosted: -1, sharedCount: -1, distanceMeters: 1 } },
      { $limit: count },
      {
        $project: {
          password: 0,
          email: 0,
          devices: 0,
          deviceFingerprint: 0,
          appleOriginalTransactionId: 0,
          googleOriginalPurchaseToken: 0,
          loginAttempts: 0,
          lockoutUntil: 0,
          fcmToken: 0,
          dailySwipes: 0,
          dailySwipesDate: 0,
          blockedUsers: 0,
          __v: 0,
          resetCode: 0,
          resetCodeExpiry: 0,
          otpCode: 0,
          otpExpiry: 0,
        },
      },
    ];

    const docs = await User.aggregate(pipeline);
    const fsMap = await followStatusMap(me._id, docs.map((d) => d._id));
    const likers = await incomingLikerSet(me._id, docs.map((d) => d._id));
    const cards = docs.map((u) => ({
      ...u,
      id: u._id.toString(),
      distance: formatDistance(u.distanceMeters),
      distKm: u.distanceMeters != null ? +(u.distanceMeters / 1000).toFixed(2) : null,
      avatarIdx: hashToIdx(u._id.toString()),
      followStatus: fsMap.get(u._id.toString()) || 'none',
      likedByThem: isPremiumActive(me) && likers.has(u._id.toString()),
      popularity: (u.totalLikesReceived || 0) + (u.followersCount || 0),
      ...presenceFields(u),
    }));
    ok(res, cards);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/discover/search-new ────────────────────────────────────────────
// Powers the "search for new nearby friends" radar. Same candidate pool as
// /cards (not-swiped, not-blocked, within radius, optional interest filter) but
// scoped to RECENTLY ACTIVE users (lastActiveAt within 7 days) and sorted by
// shared-interest overlap then distance — i.e. fresh, relevant people. Returns
// the same card shape so the client can drop them straight into the deck.
router.post('/search-new', auth, async (req, res, next) => {
  try {
    const me = req.user;
    const count = Math.min(parseInt(req.body?.count, 10) || 15, 20);

    const radiusKmRaw = parseFloat(req.body?.radiusKm);
    const maxDistance = Number.isFinite(radiusKmRaw) && radiusKmRaw > 0
      ? Math.min(radiusKmRaw * 1000, MAX_DISTANCE_M)
      : MAX_DISTANCE_M;

    let filterInterests = null;
    if (req.body?.interests) {
      const arr = Array.isArray(req.body.interests)
        ? req.body.interests
        : String(req.body.interests).split(',');
      filterInterests = arr.map((s) => String(s).trim()).filter(Boolean);
      if (filterInterests.length === 0) filterInterests = null;
    }

    const alreadySwiped = await Swipe.find({ fromUser: me._id }, { toUser: 1 }).lean();
    const swipedIds = alreadySwiped.map((s) => s.toUser);
    const usersWhoBlockedMe = await User.find({ blockedUsers: me._id }, { _id: 1 }).lean();
    const excludeIds = [
      me._id,
      ...swipedIds,
      ...(me.blockedUsers || []),
      ...usersWhoBlockedMe.map((u) => u._id),
    ];

    const { lat, lng } = resolveOrigin(me); // Premium virtual location or GPS
    const myInterests = me.interests || [];
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const baseQuery = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
      isDeleted: { $ne: true },
      ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from discovery
      lastActiveAt: { $gte: since }, // recently active only
    };
    if (filterInterests) baseQuery.interests = { $in: filterInterests };

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance,
          spherical: true,
          query: baseQuery,
        },
      },
      {
        $addFields: {
          sharedTags: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$interests', []] } }, 0] },
              then: { $setIntersection: ['$interests', myInterests] },
              else: [],
            },
          },
        },
      },
      { $addFields: { sharedCount: { $size: '$sharedTags' } } },
      { $sort: { sharedCount: -1, distanceMeters: 1 } },
      { $limit: count },
      {
        $project: {
          password: 0,
          email: 0,
          devices: 0,
          deviceFingerprint: 0,
          appleOriginalTransactionId: 0,
          googleOriginalPurchaseToken: 0,
          loginAttempts: 0,
          lockoutUntil: 0,
          fcmToken: 0,
          dailySwipes: 0,
          dailySwipesDate: 0,
          blockedUsers: 0,
          __v: 0,
          resetCode: 0,
          resetCodeExpiry: 0,
          otpCode: 0,
          otpExpiry: 0,
        },
      },
    ];

    const docs = await User.aggregate(pipeline);
    const fsMap = await followStatusMap(me._id, docs.map((d) => d._id));
    const likers = await incomingLikerSet(me._id, docs.map((d) => d._id));
    const cards = docs.map((u) => ({
      ...u,
      id: u._id.toString(),
      distance: formatDistance(u.distanceMeters),
      distKm: u.distanceMeters != null ? +(u.distanceMeters / 1000).toFixed(2) : null,
      avatarIdx: hashToIdx(u._id.toString()),
      followStatus: fsMap.get(u._id.toString()) || 'none',
      likedByThem: isPremiumActive(me) && likers.has(u._id.toString()),
      popularity: (u.totalLikesReceived || 0) + (u.followersCount || 0),
      ...presenceFields(u),
    }));
    ok(res, cards);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/discover/swipe ─────────────────────────────────────────────────
// Body: { userId, action: 'like' | 'pass' | 'super' }
// Returns: { match?: User } — match is set if a mutual like was created.
router.post('/swipe', auth, async (req, res, next) => {
  try {
    const { userId, action } = req.body;
    if (!userId || !action) return err(res, 'userId and action are required');
    if (!mongoose.Types.ObjectId.isValid(userId)) return err(res, 'Invalid userId');
    if (!['like', 'pass', 'super'].includes(action)) {
      return err(res, "action must be 'like', 'pass', or 'super'");
    }

    const me = req.user;
    const direction = action === 'super' ? 'super_like' : action;

    await Swipe.findOneAndUpdate(
      { fromUser: me._id, toUser: userId },
      { direction },
      { upsert: true, new: true },
    );

    if (direction === 'like' || direction === 'super_like') {
      const mutual = await Swipe.findOne({
        fromUser: userId,
        toUser: me._id,
        direction: { $in: ['like', 'super_like'] },
      });
      if (mutual) {
        let match = await Match.findOne({ users: { $all: [me._id, userId] } });
        const isNewMatch = !match;
        if (!match) {
          match = await Match.create({ users: [me._id, userId] });
        }
        const otherUser = await User.findById(userId);
        const payload = {
          id: match._id.toString(),
          user: otherUser ? otherUser.toPublicJSON(undefined, { self: false }) : null,
        };

        // Push to the OTHER user so they get a MatchOverlay too.
        // Don't push back to self — the HTTP response already carries the match.
        if (isNewMatch) {
          try {
            const { getIO } = require('../services/socketService');
            const io = getIO();
            if (io) {
              io.to(`user:${userId}`).emit('match:new', {
                id: match._id.toString(),
                // Sent to the OTHER user → self:false (don't leak my email).
                user: me.toPublicJSON(undefined, { self: false }),
              });
            }
          } catch (_) {
            // best effort
          }
        }

        return ok(res, { match: payload });
      }
    }
    ok(res, { match: null });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/discover/nearby?radiusKm=10&interests=coffee,hiking ─────────────
// Same filter shape as /cards but tuned for the 4-column grid: more results,
// sort by distance only (overlap shown as a chip on tile, not used for sorting).
router.get('/nearby', auth, async (req, res, next) => {
  try {
    const me = req.user;
    // The client sends radiusKm=0 as the "不限/unlimited" sentinel from the
    // FiltersSheet. An explicit 0/negative now means TRULY worldwide: drop the
    // $geoNear distance cap entirely (still sorted nearest-first) and raise the
    // page size to 300 so the grid isn't starved. A bounded radius keeps its
    // cap + the standard 80 page; a missing/NaN radius keeps the 100km default.
    const radiusKmRaw = parseFloat(req.query.radiusKm);
    const hasRadius = Number.isFinite(radiusKmRaw);
    const unlimited = hasRadius && radiusKmRaw <= 0;
    const maxDistance = hasRadius && radiusKmRaw > 0
      ? Math.min(radiusKmRaw * 1000, MAX_DISTANCE_M)
      : (unlimited ? null : MAX_DISTANCE_M);
    const PAGE_SIZE = unlimited ? 300 : 80;

    // Mirror /cards: optional comma-separated interest filter. When set,
    // only candidates with at least one matching tag are returned.
    const interestsParam = req.query.interests;
    let filterInterests = null;
    if (interestsParam) {
      const arr = Array.isArray(interestsParam)
        ? interestsParam
        : String(interestsParam).split(',');
      filterInterests = arr.map((s) => String(s).trim()).filter(Boolean);
      if (filterInterests.length === 0) filterInterests = null;
    }

    const usersWhoBlockedMe = await User.find({ blockedUsers: me._id }, { _id: 1 }).lean();
    const excludeIds = [
      me._id,
      ...(me.blockedUsers || []),
      ...usersWhoBlockedMe.map((u) => u._id),
    ];

    const { lat, lng } = resolveOrigin(me); // Premium virtual location or GPS
    const myInterests = me.interests || [];

    const baseQuery = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
      isDeleted: { $ne: true },
      ...NOT_OFFICIAL, // hide official accounts (Meyou 官方) from discovery
    };
    if (filterInterests) {
      baseQuery.interests = { $in: filterInterests };
    }

    const geoNear = {
      near: { type: 'Point', coordinates: [lng, lat] },
      distanceField: 'distanceMeters',
      spherical: true,
      query: baseQuery,
    };
    // Omit maxDistance entirely when unlimited so $geoNear returns the nearest
    // matches worldwide (still sorted by distance), capped only by $limit.
    if (maxDistance != null) geoNear.maxDistance = maxDistance;

    const pipeline = [
      { $geoNear: geoNear },
      {
        $addFields: {
          sharedTags: {
            $setIntersection: [{ $ifNull: ['$interests', []] }, myInterests],
          },
        },
      },
      { $limit: PAGE_SIZE },
      {
        $project: {
          password: 0,
          email: 0,
          devices: 0,
          deviceFingerprint: 0,
          appleOriginalTransactionId: 0,
          googleOriginalPurchaseToken: 0,
          loginAttempts: 0,
          lockoutUntil: 0,
          fcmToken: 0,
          dailySwipes: 0,
          dailySwipesDate: 0,
          blockedUsers: 0,
          __v: 0,
          resetCode: 0,
          resetCodeExpiry: 0,
          otpCode: 0,
          otpExpiry: 0,
        },
      },
    ];

    const docs = await User.aggregate(pipeline);
    const fsMap = await followStatusMap(me._id, docs.map((d) => d._id));
    const likers = await incomingLikerSet(me._id, docs.map((d) => d._id));
    const others = docs.map((u) => ({
      ...u,
      id: u._id.toString(),
      distance: formatDistance(u.distanceMeters),
      distKm: u.distanceMeters != null ? +(u.distanceMeters / 1000).toFixed(2) : null,
      avatarIdx: hashToIdx(u._id.toString()),
      followStatus: fsMap.get(u._id.toString()) || 'none',
      likedByThem: isPremiumActive(me) && likers.has(u._id.toString()),
      popularity: (u.totalLikesReceived || 0) + (u.followersCount || 0),
      ...presenceFields(u),
    }));

    // Prepend the current user as a "0.0 km" tile so they see themselves in
    // the grid (product-decided behavior — surfaces own profile entry point).
    const selfPublic = me.toPublicJSON();
    const self = {
      ...selfPublic,
      sharedTags: me.interests || [],
      distance: '0 m',
      distKm: 0,
      avatarIdx: hashToIdx(me._id.toString()),
    };

    ok(res, [self, ...others]);
  } catch (e) {
    next(e);
  }
});

// Deterministic 0–9 from an ObjectId hex string. Drives the placeholder
// gradient palette index for users without an avatar photo.
function hashToIdx(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

module.exports = router;
