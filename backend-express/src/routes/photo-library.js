const router = require('express').Router();
const PhotoLibrary = require('../models/PhotoLibrary');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { enforceRateLimit } = require('../middleware/antiSpam');
const r2 = require('../services/r2Service');

const FREE_MAX = 30;
const PREMIUM_MAX = 100;

function maxFor(user) {
  return isPremiumActive(user) ? PREMIUM_MAX : FREE_MAX;
}

// ── GET /api/photo-library ────────────────────────────────────────────────────
// LRU view: most-recently-used first. Returns capacity metadata so the
// client can render a "n / max" gauge without a second round-trip.
router.get('/', auth, async (req, res, next) => {
  try {
    const photos = await PhotoLibrary.find({ user: req.user._id })
      .sort({ lastUsedAt: -1 })
      .select('_id url uploadedAt lastUsedAt')
      .lean();
    ok(res, {
      photos,
      count: photos.length,
      max: maxFor(req.user),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/photo-library ───────────────────────────────────────────────────
// Body: { url } — the B2 URL produced by /api/upload (client uploads,
// then registers the URL here). Server does NOT pull/re-upload.
//
// Capacity: Free 30, Premium 100. Over the cap returns HTTP 413 with a
// structured body { error: 'LIBRARY_FULL', count, max, message } so the
// client can branch on `error === 'LIBRARY_FULL'` without parsing the
// human message. We DO NOT auto-LRU-evict — user must explicitly delete.
router.post('/', auth, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || !String(url).trim()) return err(res, 'url required', 400);

    // Anti-spam: cap photo uploads per hour / day (per tier).
    if (await enforceRateLimit(req, res, 'photo')) return;

    const count = await PhotoLibrary.countDocuments({ user: req.user._id });
    const max = maxFor(req.user);
    if (count >= max) {
      return res.status(413).json({
        error: 'LIBRARY_FULL',
        count,
        max,
        message: `Library full (${count} / ${max}). Delete some photos to free space.`,
      });
    }

    const photo = await PhotoLibrary.create({
      user: req.user._id,
      url: String(url).trim(),
    });

    created(res, {
      photo: {
        _id: photo._id,
        url: photo.url,
        uploadedAt: photo.uploadedAt,
        lastUsedAt: photo.lastUsedAt,
      },
      count: count + 1,
      max,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/photo-library/:id ─────────────────────────────────────────────
// Explicit user delete. Best-effort B2 cleanup; if the bucket call fails
// the DB row still goes away so the user isn't blocked. R2 URLs that
// don't parse via keyFromUrl (e.g. legacy disk paths) skip the B2 step.
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const photo = await PhotoLibrary.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!photo) return err(res, 'Photo not found', 404);

    const key = r2.keyFromUrl(photo.url);
    if (key) {
      r2.deleteFile(key).catch(() => {});
    }

    await photo.deleteOne();
    ok(res, { deletedId: req.params.id });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/photo-library/:id/touch ─────────────────────────────────────────
// Mark the photo as just-used. Called from the client right after the
// photo is sent in a chat message / posted to a moment / etc., so the
// LRU sort floats frequently-used photos to the top.
router.post('/:id/touch', auth, async (req, res, next) => {
  try {
    const photo = await PhotoLibrary.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { lastUsedAt: new Date() } },
      { new: true },
    ).select('_id url uploadedAt lastUsedAt');
    if (!photo) return err(res, 'Photo not found', 404);
    ok(res, { photo });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
