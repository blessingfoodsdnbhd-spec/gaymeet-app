const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { uploadMem, uploadDir } = require('../middleware/upload');
const r2 = require('../services/r2Service');
const { ok, err } = require('../utils/respond');

/**
 * Store a multer memory-buffer either in R2 (if configured) or on disk.
 * Returns the public URL.
 */
async function storePhoto(file, req) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const r2Url = await r2.uploadFile(file.buffer, key, file.mimetype);
  if (r2Url) return r2Url;

  // Disk fallback
  await fs.promises.writeFile(path.join(uploadDir, key), file.buffer);
  return `${req.protocol}://${req.get('host')}/uploads/${key}`;
}

// ── POST /api/users/photos ────────────────────────────────────────────────────
router.post('/photos', auth, uploadMem.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    const url = await storePhoto(req.file, req);

    const user = await User.findById(req.user._id);
    user.photos.push(url);
    user.avatarUrl = user.photos[0]; // always photos[0] = avatarUrl

    await user.save();
    ok(res, { url, avatarUrl: user.avatarUrl, photos: user.photos });
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

    // Best-effort delete from R2 or disk
    const r2Key = r2.keyFromUrl(url);
    if (r2Key) {
      r2.deleteFile(r2Key).catch(() => {});
    } else {
      try {
        const filename = path.basename(new URL(url).pathname);
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
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
