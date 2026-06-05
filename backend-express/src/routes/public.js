const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Announcement = require('../models/Announcement');

const BIO_MAX = 140;

// Truly-public, unauthenticated, read-only. Allow any origin (no credentials)
// so the meyou.uk landing page (and link scrapers) can read it from anywhere.
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Cache-Control', 'public, max-age=300'); // 5 min — fine for a share page
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── GET /api/public/profile/:userId ───────────────────────────────────────────
// Minimum public fields for the share landing page. NO email/dob/distance/
// location/lastActive/realName — privacy-hardened, identical for everyone
// (auth never grants more here).
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const user = await User.findById(userId)
      .select('nickname bio avatarUrl photos interests prompts isPublicProfile')
      .lean();
    if (!user) return res.status(404).json({ error: 'Not found' });

    // Privacy opt-out → generic shell (no identifying details).
    if (user.isPublicProfile === false) {
      return res.json({ data: { isPrivate: true } });
    }

    const bio = (user.bio || '').trim();
    res.json({
      data: {
        isPrivate: false,
        id: String(user._id),
        displayName: user.nickname,
        avatarUrl: user.avatarUrl || (Array.isArray(user.photos) ? user.photos[0] : null) || null,
        bio: bio.length > BIO_MAX ? `${bio.slice(0, BIO_MAX - 1)}…` : bio,
        interestsCount: Array.isArray(user.interests) ? user.interests.length : 0,
        promptsCount: Array.isArray(user.prompts) ? user.prompts.length : 0,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/public/announcement-hero ─────────────────────────────────────────
// The latest active announcement's image — used as the hero banner on the
// meyou.uk/u/:id landing page. Returns { imageUrl: string | null }.
router.get('/announcement-hero', async (req, res) => {
  try {
    const now = new Date();
    const ann = await Announcement.findOne({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .select('imageUrl')
      .lean();
    res.json({ data: { imageUrl: ann ? ann.imageUrl : null } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
