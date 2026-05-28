const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const MAX_DISTANCE_M = 100_000; // 100 km — Meyou is Malaysia-only at launch

function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
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

    const lat = me.location?.coordinates?.[1] ?? 3.1390;
    const lng = me.location?.coordinates?.[0] ?? 101.6869;
    const myInterests = me.interests || [];

    const baseQuery = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
      isDeleted: { $ne: true },
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
    const cards = docs.map((u) => ({
      ...u,
      id: u._id.toString(),
      distance: formatDistance(u.distanceMeters),
      distKm: u.distanceMeters != null ? +(u.distanceMeters / 1000).toFixed(2) : null,
      avatarIdx: hashToIdx(u._id.toString()),
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
          user: otherUser ? otherUser.toPublicJSON() : null,
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
                user: me.toPublicJSON(),
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
    // Distance handling mirrors /cards (L39-42): missing / 0 / NaN /
    // negative all mean "no user-applied cap" → fall back to MAX_DISTANCE_M.
    // The client sends radiusKm=0 as the "不限/unlimited" sentinel from
    // the FiltersSheet; the prior `|| 10` pattern silently reverted that
    // to a 10km cap, so users saw FEWER results when picking unlimited.
    const radiusKmRaw = parseFloat(req.query.radiusKm);
    const maxDistance = Number.isFinite(radiusKmRaw) && radiusKmRaw > 0
      ? Math.min(radiusKmRaw * 1000, MAX_DISTANCE_M)
      : MAX_DISTANCE_M;

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

    const lat = me.location?.coordinates?.[1] ?? 3.1390;
    const lng = me.location?.coordinates?.[0] ?? 101.6869;
    const myInterests = me.interests || [];

    const baseQuery = {
      _id: { $nin: excludeIds },
      'preferences.hideFromNearby': { $ne: true },
      'preferences.stealthMode': { $ne: true },
      isDeleted: { $ne: true },
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
            $setIntersection: [{ $ifNull: ['$interests', []] }, myInterests],
          },
        },
      },
      { $limit: 80 },
      {
        $project: {
          password: 0,
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
    const others = docs.map((u) => ({
      ...u,
      id: u._id.toString(),
      distance: formatDistance(u.distanceMeters),
      distKm: u.distanceMeters != null ? +(u.distanceMeters / 1000).toFixed(2) : null,
      avatarIdx: hashToIdx(u._id.toString()),
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
