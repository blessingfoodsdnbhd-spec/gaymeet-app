const router   = require('express').Router();
const path      = require('path');
const fs        = require('fs');
const User        = require('../models/User');
const PhotoRequest = require('../models/PhotoRequest');
const { auth }    = require('../middleware/auth');
const { upload }  = require('../middleware/upload');
const { ok, created, err } = require('../utils/respond');
const env         = require('../config/env');

const MAX_PRIVATE_PHOTOS  = 5;

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
router.post('/private-photos', auth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    const user = await User.findById(req.user._id);
    if (user.privatePhotos.length >= MAX_PRIVATE_PHOTOS) {
      // Clean up uploaded file
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return err(res, `Maximum ${MAX_PRIVATE_PHOTOS} private photos allowed`);
    }

    const host = `${req.protocol}://${req.get('host')}`;
    const url  = `${host}/uploads/${req.file.filename}`;

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

    // Best-effort delete physical file
    try {
      const filename = path.basename(new URL(url).pathname);
      const filePath = path.join(path.resolve(env.UPLOAD_DIR), filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}

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

    // Check for existing active request
    const existing = await PhotoRequest.findOne({
      requester: req.user._id,
      owner: ownerId,
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      return err(res, `Request already ${existing.status}`, 409);
    }

    const request = await PhotoRequest.create({
      requester: req.user._id,
      owner: ownerId,
    });

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

    ok(res, { requests });
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

    ok(res, { requests });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
