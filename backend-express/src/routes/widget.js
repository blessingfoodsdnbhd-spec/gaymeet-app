const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');
const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');

// ── GET /api/widget-data ──────────────────────────────────────────────────────
// Returns lightweight widget data: nearby online count, recent chats.
router.get('/', auth, async (req, res, next) => {
  try {
    const user = req.user;
    const [lng, lat] = user.location?.coordinates ?? [0, 0];

    // Count online users within 50 km
    const nearbyOnline = await User.countDocuments({
      _id: { $ne: user._id },
      isOnline: true,
      'preferences.hideFromNearby': { $ne: true },
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 50000,
        },
      },
    }).catch(() => 0);

    // Closest online user distance (metres → km)
    let closestKm = null;
    const closest = await User.findOne({
      _id: { $ne: user._id },
      isOnline: true,
      'preferences.hideFromNearby': { $ne: true },
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 50000,
        },
      },
    }).select('location').lean().catch(() => null);

    if (closest?.location?.coordinates) {
      const [clng, clat] = closest.location.coordinates;
      const R = 6371;
      const dLat = ((clat - lat) * Math.PI) / 180;
      const dLng = ((clng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((clat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      closestKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    // Last 3 conversations
    const matches = await Match.find({ users: user._id, isActive: true })
      .sort({ lastMessageAt: -1 })
      .limit(3)
      .populate('users', 'nickname avatarUrl isOnline')
      .lean()
      .catch(() => []);

    const recentChats = await Promise.all(
      matches.map(async (m) => {
        const other = (m.users || []).find(
          (u) => u && u._id.toString() !== user._id.toString()
        );
        if (!other) return null;
        const last = await Message.findOne({ match: m._id })
          .sort({ createdAt: -1 })
          .select('content type')
          .lean()
          .catch(() => null);
        return {
          matchId: m._id.toString(),
          userId: other._id.toString(),
          nickname: other.nickname,
          avatarUrl: other.avatarUrl || null,
          isOnline: other.isOnline || false,
          lastMessage: last
            ? last.type === 'text'
              ? last.content
              : '[sticker]'
            : '',
        };
      })
    ).then((r) => r.filter(Boolean));

    ok(res, { nearbyOnline, closestKm, recentChats });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
