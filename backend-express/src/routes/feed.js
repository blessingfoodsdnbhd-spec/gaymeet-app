const router = require('express').Router();
const Moment = require('../models/Moment');
const Event = require('../models/Event');
const Follow = require('../models/Follow');
const Place = require('../models/Place');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUser(u) {
  if (!u) return null;
  return {
    id: u._id,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    isPremium: u.isPremium,
    countryCode: u.countryCode,
  };
}

function formatMoment(m, place, currentUserId) {
  const hasPlace = !!place;
  return {
    id: m._id,
    type: hasPlace ? 'place' : 'moment',
    user: formatUser(m.user),
    content: m.content,
    media: m.images || [],
    location: m.hasLocation ? m.location : null,
    createdAt: m.createdAt,
    likeCount: (m.likes || []).length,
    isLiked: (m.likes || []).some((id) => id.toString() === currentUserId.toString()),
    commentsCount: m.commentsCount || 0,
    visibility: m.visibility,
    meta: hasPlace ? { placeName: place.name, placeId: place._id } : {},
  };
}

function formatEvent(e) {
  return {
    id: e._id,
    type: 'event',
    user: formatUser(e.organizer),
    content: e.description || '',
    media: e.coverImage ? [e.coverImage] : [],
    location: e.location && e.location.coordinates ? e.location : null,
    createdAt: e.createdAt,
    likeCount: 0,
    isLiked: false,
    commentsCount: 0,
    visibility: 'public',
    meta: {
      eventTitle: e.title,
      eventDate: e.date,
      venue: e.venue,
      category: e.category,
      attendeeCount: (e.attendees || []).filter((a) => a.status === 'going').length,
      maxAttendees: e.maxAttendees,
      price: e.price,
      currency: e.currency,
    },
  };
}

// Batch look up nearest Place (≤200m) for moments that have a location.
async function resolvePlaces(moments) {
  const withLoc = moments.filter(
    (m) => m.hasLocation && m.location && m.location.coordinates
  );
  const results = await Promise.all(
    withLoc.map((m) =>
      Place.findOne({
        isActive: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: m.location.coordinates },
            $maxDistance: 200,
          },
        },
      })
        .select('name')
        .lean()
        .catch(() => null)
    )
  );
  const map = new Map();
  withLoc.forEach((m, i) => {
    if (results[i]) map.set(m._id.toString(), results[i]);
  });
  return map;
}

// ── GET /api/feed ──────────────────────────────────────────────────────────────
// Unified feed: moments + events (excluding past events), respecting visibility.
// Query: ?tab=discover|following&page=1&limit=20
router.get('/', auth, async (req, res, next) => {
  try {
    const tab = req.query.tab === 'following' ? 'following' : 'discover';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Fetch 2x per source so the merge doesn't starve either stream.
    const perSourceFetch = limit * 2;

    let followingIds = null;
    if (tab === 'following') {
      const followDocs = await Follow.find({ follower: req.user._id })
        .select('following')
        .lean();
      followingIds = followDocs.map((f) => f.following);
    }

    const momentFilter =
      tab === 'following'
        ? {
            isActive: true,
            user: { $in: followingIds },
            visibility: { $in: ['public', 'friends'] },
          }
        : { isActive: true, visibility: 'public' };

    // Events: only future + active. In following tab, only followed organizers;
    // in discover, all public events.
    const now = new Date();
    const eventFilter = {
      isActive: true,
      date: { $gt: now },
      ...(tab === 'following' && followingIds
        ? { organizer: { $in: followingIds } }
        : {}),
    };

    const [moments, events] = await Promise.all([
      Moment.find(momentFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perSourceFetch)
        .populate('user', 'nickname avatarUrl isPremium countryCode')
        .lean(),
      Event.find(eventFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perSourceFetch)
        .populate('organizer', 'nickname avatarUrl isPremium countryCode')
        .lean(),
    ]);

    const placeMap = await resolvePlaces(moments);

    const formattedMoments = moments.map((m) =>
      formatMoment(m, placeMap.get(m._id.toString()) || null, req.user._id)
    );
    const formattedEvents = events.map(formatEvent);

    const merged = [...formattedMoments, ...formattedEvents].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Slice to the page size. Everything past `limit` is dropped — the next
    // page will re-fetch via skip. Acceptable at current scale; revisit if
    // either source dominates and starves the other.
    const pageItems = merged.slice(0, limit);

    console.log(
      `[feed] user=${req.user._id} tab=${tab} page=${page} ` +
        `moments=${moments.length} events=${events.length} ` +
        `places=${placeMap.size} merged=${merged.length} returned=${pageItems.length}`
    );

    ok(res, pageItems);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
