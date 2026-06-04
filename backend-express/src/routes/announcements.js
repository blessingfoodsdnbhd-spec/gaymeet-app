// Meyou 密友 — public-facing announcement route.
//
// The admin creates Announcement docs via /api/admin/announcements; the
// client polls THIS endpoint on each app launch (post-login arrival) to
// decide whether to show its AnnouncementModal. We expose only the bare
// minimum the client needs (id + imageUrl + ctaUrl + title) so that
// listing all rows / inspecting timestamps stays on the admin side.
const router = require('express').Router();
const Announcement = require('../models/Announcement');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

// ── GET /api/announcements/current ──────────────────────────────────────────
// Returns ALL isActive announcements whose start/end window contains "now",
// newest first — the client renders them as a swipeable carousel. An empty
// array means "skip the modal".
//
// Back-compat: `?single=true` returns the single newest one (or null), the
// pre-carousel shape, so an older client keeps working.
router.get('/current', auth, async (req, res, next) => {
  try {
    const now = new Date();
    const list = await Announcement.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ createdAt: -1 });

    const mapped = list.map((ann) => ({
      id: ann._id.toString(),
      imageUrl: ann.imageUrl,
      ctaUrl: ann.ctaUrl,
      title: ann.title,
    }));

    if (req.query.single === 'true') {
      return ok(res, mapped[0] ?? null);
    }
    ok(res, mapped);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
