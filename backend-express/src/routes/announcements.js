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
// Returns the most recent isActive announcement whose start/end window
// contains "now". `null` data when nothing applies — client interprets
// that as "skip the modal".
router.get('/current', auth, async (req, res, next) => {
  try {
    const now = new Date();
    const ann = await Announcement.findOne({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ createdAt: -1 });

    if (!ann) return ok(res, null);
    ok(res, {
      id: ann._id.toString(),
      imageUrl: ann.imageUrl,
      ctaUrl: ann.ctaUrl,
      title: ann.title,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
