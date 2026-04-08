const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { ok, err } = require('../utils/respond');
const env = require('../config/env');

// ── POST /api/users/photos ────────────────────────────────────────────────────
router.post('/photos', auth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    const host = `${req.protocol}://${req.get('host')}`;
    const url = `${host}/uploads/${req.file.filename}`;

    const user = await User.findById(req.user._id);
    user.photos.push(url);

    // First photo becomes avatar
    if (!user.avatarUrl) user.avatarUrl = url;

    await user.save();
    ok(res, { url });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/users/photos ──────────────────────────────────────────────────
router.delete('/photos', auth, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return err(res, 'url required');

    const user = await User.findById(req.user._id);
    user.photos = user.photos.filter((p) => p !== url);

    if (user.avatarUrl === url) {
      user.avatarUrl = user.photos[0] ?? null;
    }

    await user.save();

    // Delete physical file (best-effort)
    try {
      const filename = path.basename(new URL(url).pathname);
      const filePath = path.join(path.resolve(env.UPLOAD_DIR), filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {
      // ignore
    }

    ok(res, { photos: user.photos, avatarUrl: user.avatarUrl });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/users/photos/reorder ──────────────────────────────────────────
router.patch('/photos/reorder', auth, async (req, res, next) => {
  try {
    const { photos } = req.body;
    if (!Array.isArray(photos)) return err(res, 'photos must be an array');

    const user = await User.findById(req.user._id);

    // Validate that all provided URLs belong to this user
    const valid = photos.every((u) => user.photos.includes(u));
    if (!valid) return err(res, 'Invalid photo URLs', 403);

    user.photos = photos;
    user.avatarUrl = photos[0] ?? null;
    await user.save();

    ok(res, { photos: user.photos, avatarUrl: user.avatarUrl });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
