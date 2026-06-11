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

/**
 * Persist a PRIVATE multer memory-buffer.
 *
 * Preference order:
 *   1. Private B2 bucket → returns a `b2priv://<key>` sentinel (bytes are NOT
 *      publicly reachable; served only via short-lived signed URLs). C-1.
 *   2. Public B2 bucket (legacy) → returns a public URL. Used until the
 *      private-bucket envs are set; logs a warning at startup (r2Service).
 *   3. Local disk (dev only — Render's FS is ephemeral).
 */
async function storePhoto(file, req) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const key = `private/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  // 1) Private bucket (preferred).
  const privRef = await r2.uploadPrivate(file.buffer, key, file.mimetype);
  if (privRef) return privRef;

  // 2) Public bucket fallback.
  const r2Url = await r2.uploadFile(file.buffer, key, file.mimetype);
  if (r2Url) return r2Url;

  // 3) Local disk (dev).
  const flatKey = key.replace(/\//g, '_');
  await fs.promises.writeFile(path.join(uploadDir, flatKey), file.buffer);
  return `${req.protocol}://${req.get('host')}/uploads/${flatKey}`;
}

/**
 * Resolve a list of stored private-photo refs into URLs the client can load.
 * Private-bucket refs (`b2priv://…`) become short-lived signed URLs; legacy
 * public URLs pass through unchanged. Returns objects so the client can tell
 * signed (expiring) from direct, and re-fetch before expiry.
 * @param {string[]} refs
 * @param {number} [ttl=300]
 */
async function resolvePrivatePhotos(refs, ttl = 300) {
  const out = [];
  for (const ref of refs || []) {
    if (r2.isPrivateRef(ref)) {
      const url = await r2.signedGetUrl(ref, ttl);
      out.push({ url, ref, signed: true, expiresIn: ttl });
    } else {
      out.push({ url: ref, ref, signed: false });
    }
  }
  return out;
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
    // Accept polymorphic input for resilience across client versions:
    //   - legacy URL string            "https://…jpg"        (matches DB)
    //   - private-bucket key string    "b2priv://…"          (matches DB)
    //   - detailed object              { url, ref }          (resolve to ref)
    // and, as a last resort, a SIGNED url (token query string) that no longer
    // string-equals the stored b2priv:// ref — match by base/containment.
    let target = req.body.url ?? req.body.ref;
    if (typeof target === 'object' && target !== null) {
      target = target.ref ?? target.url;
    }
    if (!target) return err(res, 'url required');

    const user = await User.findById(req.user._id);

    if (!user.privatePhotos.includes(target)) {
      // Last resort: the client sent a signed/display URL. Try to map it back
      // to a stored ref by base-URL containment (strip the ?token query).
      const base = String(target).split('?')[0];
      const match = user.privatePhotos.find(
        (p) => String(target).startsWith(p) || p.includes(base)
      );
      if (!match) return err(res, 'Photo not found', 404);
      target = match;
    }

    const url = target; // canonical stored value from here on

    user.privatePhotos = user.privatePhotos.filter((p) => p !== url);
    await user.save();

    // Best-effort delete of the underlying object.
    if (r2.isPrivateRef(url)) {
      // Private-bucket object.
      const key = r2.keyFromPrivateRef(url);
      r2.deleteFile(key, r2.PRIVATE_BUCKET_ID).catch(() => {});
    } else {
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

    // Dedupe only on active states. rejected and revoked rows are kept
    // as audit history but don't block a fresh request — the user can
    // try again immediately after a denial.
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
      .populate('requester', 'nickname avatarUrl level isOnline distance isOfficial isVerified isPremium');

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
      const detailed = await resolvePrivatePhotos(me.privatePhotos);
      // `photos` is a string[] of loadable URLs — the contract every shipped
      // client expects (regression from PR #77, which made it an object array
      // and broke display/delete). `photosDetailed` carries the {url, ref,
      // signed, expiresIn} objects for future signed-URL refresh logic.
      return ok(res, {
        photos: detailed.map((p) => p.url),
        photosDetailed: detailed,
        status: 'owner',
      });
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
      if (pending) return ok(res, { photos: [], photosDetailed: [], status: 'pending' });
      return ok(res, { photos: [], photosDetailed: [], status: 'none' });
    }

    const owner = await User.findById(ownerId).select('privatePhotos');
    const detailed = await resolvePrivatePhotos(owner.privatePhotos);
    ok(res, {
      photos: detailed.map((p) => p.url),
      photosDetailed: detailed,
      status: 'approved',
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/users/private-photos/signed-url — refresh an expiring URL ───────
// Mints a fresh short-lived signed URL for ONE private-bucket photo. Gated:
// the caller must be the owner OR have an approved PhotoRequest, AND the ref
// must actually belong to that owner. Body: { ownerId, ref }.
// (POST, not GET — keeps the object key out of access logs / URLs.)
router.post('/private-photos/signed-url', auth, async (req, res, next) => {
  try {
    const { ownerId, ref } = req.body;
    if (!ownerId || !ref) return err(res, 'ownerId and ref required');
    if (!r2.isPrivateRef(ref)) {
      // Legacy public URL — nothing to sign, hand it back as-is.
      return ok(res, { url: ref, signed: false });
    }

    const isOwner = ownerId === req.user._id.toString();
    if (!isOwner) {
      const approved = await PhotoRequest.findOne({
        requester: req.user._id,
        owner: ownerId,
        status: 'approved',
      });
      if (!approved) return err(res, 'Not authorized to view these photos', 403);
    }

    // The ref must belong to the named owner — stops a user with one approval
    // from signing arbitrary keys.
    const owner = await User.findById(ownerId).select('privatePhotos');
    if (!owner || !(owner.privatePhotos || []).includes(ref)) {
      return err(res, 'Photo not found', 404);
    }

    const url = await r2.signedGetUrl(ref, 300);
    if (!url) return err(res, 'Signed URLs unavailable', 503);
    ok(res, { url, signed: true, expiresIn: 300 });
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
