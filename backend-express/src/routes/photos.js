const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { uploadMem, uploadDir } = require('../middleware/upload');
const r2 = require('../services/r2Service');
const { ok, err } = require('../utils/respond');

const MAX_PUBLIC_PHOTOS = 5;

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
// Multipart fields:
//   photo   – the file
//   primary – '0' / 'false' to opt out of the avatar-change behaviour and
//             just append to the gallery. Defaults to true (the avatar
//             picker is the only known caller today; any future
//             gallery-add flow should pass primary=0 explicitly).
router.post('/photos', auth, uploadMem.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    // Admin photo-upload ban.
    if (req.user.photoUploadBanned) return err(res, '你已被禁止上传照片', 403);

    const user = await User.findById(req.user._id);
    const raw = req.body?.primary;
    const asPrimary = !(raw === '0' || raw === 'false' || raw === false);

    // Enforce 5-photo cap. The avatar-swap path replaces photos[0] (net
    // delta +1 if the URL is new); the append path also adds one. Either
    // way, refuse when already at the cap.
    if (user.photos.length >= MAX_PUBLIC_PHOTOS) {
      return err(res, `Maximum ${MAX_PUBLIC_PHOTOS} public photos allowed`);
    }

    const url = await storePhoto(req.file, req);

    // NSFW heuristic (item 10) — non-blocking: flag suspicious images for admin
    // review without delaying or rejecting the upload.
    (async () => {
      try {
        const { checkImage } = require('../utils/imageModeration');
        const { flagged, score } = await checkImage(req.file.buffer);
        if (flagged) {
          const FlaggedImage = require('../models/FlaggedImage');
          await FlaggedImage.create({ user: req.user._id, url, context: 'photo', score });
        }
      } catch (_) {
        /* moderation must never break uploads */
      }
    })();

    if (asPrimary) {
      // Avatar-change semantics: new photo becomes photos[0] (the avatar)
      // and any pre-existing copy of this URL is removed.
      user.photos = [url, ...user.photos.filter((p) => p !== url)];
    } else {
      user.photos.push(url);
    }
    user.avatarUrl = user.photos[0]; // photos[0] is always the avatar

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
