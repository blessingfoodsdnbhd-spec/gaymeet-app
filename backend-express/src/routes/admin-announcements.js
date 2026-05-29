// Meyou 密友 — admin announcement CRUD.
//
// Gated by X-Admin-Token header (same pattern as admin-cleanup.js and the
// google-status diagnostic). If ADMIN_TOKEN env is unset on the deploy,
// the entire router responds 503 — so a forgotten env var can never
// silently expose CRUD on user-facing modals.
//
// Mounted at /api/admin (see app.js), so the full URLs become:
//   POST   /api/admin/announcements
//   GET    /api/admin/announcements
//   PATCH  /api/admin/announcements/:id
//   DELETE /api/admin/announcements/:id   (soft — flips isActive=false)
const router = require('express').Router();
const Announcement = require('../models/Announcement');
const { ok, created, err } = require('../utils/respond');

function adminAuth(req, res, next) {
  if (!process.env.ADMIN_TOKEN) {
    return err(
      res,
      'Admin endpoint disabled — ADMIN_TOKEN env var not set',
      503,
    );
  }
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return err(res, 'Forbidden', 403);
  }
  next();
}

router.use(adminAuth);

// Coerce an ISO/epoch input to Date or null. Bad input → undefined so
// callers can detect "you sent a bad value" vs "you sent null on purpose".
function parseDate(v) {
  if (v === null) return null;
  if (v === undefined || v === '') return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : undefined;
}

// ── POST /api/admin/announcements ──────────────────────────────────────────
router.post('/announcements', async (req, res, next) => {
  try {
    const { imageUrl, ctaUrl, title, startsAt, endsAt } = req.body || {};
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return err(res, 'imageUrl required');
    }

    const startsAtParsed = parseDate(startsAt);
    if (startsAtParsed === undefined && startsAt !== undefined && startsAt !== '') {
      return err(res, 'Invalid startsAt');
    }
    const endsAtParsed = parseDate(endsAt);
    if (endsAtParsed === undefined && endsAt !== undefined && endsAt !== '') {
      return err(res, 'Invalid endsAt');
    }

    const doc = await Announcement.create({
      imageUrl: imageUrl.trim(),
      ctaUrl: typeof ctaUrl === 'string' && ctaUrl.trim() ? ctaUrl.trim() : null,
      title: typeof title === 'string' && title.trim() ? title.trim() : null,
      startsAt: startsAtParsed ?? null,
      endsAt: endsAtParsed ?? null,
    });

    created(res, doc.toObject());
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/announcements ───────────────────────────────────────────
// All rows, newest first. Inactive (soft-deleted) included so the admin
// can resurrect by PATCHing isActive=true.
router.get('/announcements', async (_req, res, next) => {
  try {
    const list = await Announcement.find({}).sort({ createdAt: -1 }).lean();
    ok(res, list);
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/admin/announcements/:id ─────────────────────────────────────
// Partial update. Only whitelisted keys allowed — silently ignores others.
router.patch('/announcements/:id', async (req, res, next) => {
  try {
    const updates = {};
    const b = req.body || {};

    if (b.imageUrl !== undefined) {
      if (typeof b.imageUrl !== 'string' || !b.imageUrl.trim()) {
        return err(res, 'Invalid imageUrl');
      }
      updates.imageUrl = b.imageUrl.trim();
    }
    if (b.ctaUrl !== undefined) {
      updates.ctaUrl =
        typeof b.ctaUrl === 'string' && b.ctaUrl.trim() ? b.ctaUrl.trim() : null;
    }
    if (b.title !== undefined) {
      updates.title =
        typeof b.title === 'string' && b.title.trim() ? b.title.trim() : null;
    }
    if (b.startsAt !== undefined) {
      const p = parseDate(b.startsAt);
      if (p === undefined && b.startsAt !== '' && b.startsAt !== null) {
        return err(res, 'Invalid startsAt');
      }
      updates.startsAt = p ?? null;
    }
    if (b.endsAt !== undefined) {
      const p = parseDate(b.endsAt);
      if (p === undefined && b.endsAt !== '' && b.endsAt !== null) {
        return err(res, 'Invalid endsAt');
      }
      updates.endsAt = p ?? null;
    }
    if (b.isActive !== undefined) {
      updates.isActive = !!b.isActive;
    }

    const doc = await Announcement.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!doc) return err(res, 'Announcement not found', 404);
    ok(res, doc.toObject());
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/announcements/:id ────────────────────────────────────
// Soft-delete: flip isActive=false. We keep the row so the admin can
// audit what was previously shipped and so we can resurrect via PATCH
// if needed.
router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const doc = await Announcement.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!doc) return err(res, 'Announcement not found', 404);
    ok(res, { id: doc._id.toString(), isActive: doc.isActive });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
