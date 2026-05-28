const router   = require('express').Router();
const path      = require('path');
const fs        = require('fs');
const User        = require('../models/User');
const PhotoRequest = require('../models/PhotoRequest');
const { auth }    = require('../middleware/auth');
const { uploadMem, uploadDir } = require('../middleware/upload');
const r2          = require('../services/r2Service');
const { ok, created, err } = require('../utils/respond');
const { sendPushToUser } = require('../utils/push');

const MAX_PRIVATE_PHOTOS = 5;
const REJECT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Persist a multer memory-buffer either to R2 (preferred) or to local disk
 * as a fallback. Mirrors photos.js storePhoto — keep both in sync. Render's
 * filesystem is ephemeral, so disk fallback is only safe for local dev.
 */
async function storePhoto(file, req) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const r2Url = await r2.uploadFile(file.buffer, key, file.mimetype);
  if (r2Url) return r2Url;
  await fs.promises.writeFile(path.join(uploadDir, key), file.buffer);
  return `${req.protocol}://${req.get('host')}/uploads/${key}`;
}

// ── POST /api/users/private-photos/relock — revoke all approved viewers ──────
// Owner-initiated kill switch. Every PhotoRequest where owner=me and
// status=approved becomes 'revoked', so those viewers immediately lose access.
// Their rows are kept (not deleted) for audit + to stop instant re-request.
router.post('/private-photos/relock', auth, async (req, res, next) => {
  try {
    const result = await PhotoRequest.updateMany(
      { owner: req.user._id, status: 'approved' },
      { $set: { status: 'revoked', respondedAt: new Date() } }
    );
    console.log(
      `[private-photos.relock] owner=${req.user._id} revoked=${result.modifiedCount}`
    );
    ok(res, { revoked: result.modifiedCount });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/private-photos/approved-count — count of active viewers ────
router.get('/private-photos/approved-count', auth, async (req, res, next) => {
  try {
    const count = await PhotoRequest.countDocuments({
      owner: req.user._id,
      status: 'approved',
    });
    ok(res, { count });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/private-photos — upload a private photo ──────────────────
router.post('/private-photos', auth, uploadMem.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    const user = await User.findById(req.user._id);
    if (user.privatePhotos.length >= MAX_PRIVATE_PHOTOS) {
      return err(res, `Maximum ${MAX_PRIVATE_PHOTOS} private photos allowed`);
    }

    const url = await storePhoto(req.file, req);

    user.privatePhotos.push(url);
    await user.save();

    ok(res, { url, count: user.privatePhotos.length });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/users/private-photos — remove a private photo ────────────────
router.delete('/private-photos', auth, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return err(res, 'url required');

    const user = await User.findById(req.user._id);
    if (!user.privatePhotos.includes(url)) {
      return err(res, 'Photo not found', 404);
    }

    user.privatePhotos = user.privatePhotos.filter((p) => p !== url);
    await user.save();

    // Best-effort delete from R2 first; fall through to local disk for old
    // pre-R2 uploads that may still be on the ephemeral filesystem.
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

    ok(res, { privatePhotos: user.privatePhotos });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/:id/request-photos — send a photo unlock request ─────────
router.post('/:id/request-photos', auth, async (req, res, next) => {
  try {
    const ownerId = req.params.id;
    if (ownerId === req.user._id.toString()) {
      return err(res, 'Cannot request your own photos');
    }

    const owner = await User.findById(ownerId);
    if (!owner) return err(res, 'User not found', 404);
    if (owner.privatePhotos.length === 0) {
      return err(res, 'This user has no private photos');
    }

    // Block check (both directions). Either party blocking the other should
    // hide the entire request flow.
    const meBlockedOwner = (req.user.blockedUsers || []).some(
      (id) => id.toString() === ownerId
    );
    const ownerBlockedMe = (owner.blockedUsers || []).some(
      (id) => id.toString() === req.user._id.toString()
    );
    if (meBlockedOwner || ownerBlockedMe) {
      return err(res, 'Cannot request photos from this user', 403);
    }

    // Dedupe active requests.
    const existing = await PhotoRequest.findOne({
      requester: req.user._id,
      owner: ownerId,
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      return err(res, `Request already ${existing.status}`, 409);
    }

    // 7-day cooldown after a rejection — prevents harassment loops where
    // someone keeps re-requesting after being denied.
    const recentReject = await PhotoRequest.findOne({
      requester: req.user._id,
      owner: ownerId,
      status: 'rejected',
      respondedAt: { $gt: new Date(Date.now() - REJECT_COOLDOWN_MS) },
    });
    if (recentReject) {
      return err(res, 'You can request again 7 days after a rejection', 429);
    }

    const request = await PhotoRequest.create({
      requester: req.user._id,
      owner: ownerId,
    });

    // Push the owner. Best-effort; never fail the request on push errors.
    sendPushToUser(ownerId, {
      title: 'New photo request',
      body: `${req.user.nickname || 'Someone'} wants to see your private photos`,
      data: {
        type: 'photo_request',
        requestId: request._id.toString(),
        fromUserId: req.user._id.toString(),
      },
    }).catch(() => {});

    created(res, { requestId: request._id, status: request.status });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/photo-requests/inbox — pending requests I received ───────────────
router.get('/inbox', auth, async (req, res, next) => {
  try {
    const requests = await PhotoRequest.find({
      owner: req.user._id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .populate('requester', 'nickname avatarUrl level isOnline distance');

    // Drop entries where the requester was deleted (populate returns null) —
    // same defense-in-depth pattern as /users/likes. count stays consistent.
    const filtered = requests.filter((r) => r.requester);
    ok(res, { requests: filtered });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/photo-requests/:id/respond — approve or reject ─────────────────
router.post('/:id/respond', auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return err(res, "status must be 'approved' or 'rejected'");
    }

    const request = await PhotoRequest.findOne({
      _id: req.params.id,
      owner: req.user._id,
      status: 'pending',
    });
    if (!request) return err(res, 'Request not found', 404);

    request.status      = status;
    request.respondedAt = new Date();
    await request.save();

    // Push the requester ONLY when approved — silent reject avoids the
    // "you were rejected" notification spam (and the awkward back-and-forth).
    if (status === 'approved') {
      sendPushToUser(request.requester, {
        title: 'Photo request approved',
        body: `${req.user.nickname || 'Someone'} approved your photo request`,
        data: {
          type: 'photo_request_approved',
          ownerId: req.user._id.toString(),
        },
      }).catch(() => {});
    }

    ok(res, { requestId: request._id, status: request.status });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/users/:id/private-photos — view private photos (if approved) ─────
router.get('/:id/private-photos', auth, async (req, res, next) => {
  try {
    const ownerId = req.params.id;

    // Owner can always see their own photos
    if (ownerId === req.user._id.toString()) {
      const me = await User.findById(req.user._id).select('privatePhotos');
      return ok(res, { photos: me.privatePhotos, status: 'owner' });
    }

    const approved = await PhotoRequest.findOne({
      requester: req.user._id,
      owner: ownerId,
      status: 'approved',
    });
    if (!approved) {
      // Return pending status if they have a pending request
      const pending = await PhotoRequest.findOne({
        requester: req.user._id,
        owner: ownerId,
        status: 'pending',
      });
      if (pending) return ok(res, { photos: [], status: 'pending' });
      return ok(res, { photos: [], status: 'none' });
    }

    const owner = await User.findById(ownerId).select('privatePhotos');
    ok(res, { photos: owner.privatePhotos, status: 'approved' });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/photo-requests/sent — my sent requests + status ──────────────────
router.get('/sent', auth, async (req, res, next) => {
  try {
    const requests = await PhotoRequest.find({ requester: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('owner', 'nickname avatarUrl level');

    const filtered = requests.filter((r) => r.owner);
    ok(res, { requests: filtered });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
