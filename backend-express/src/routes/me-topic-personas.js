// Meyou 密友 — manage MY own topic personas.
//
//   GET    /api/me/topic-personas              — list mine
//   POST   /api/me/topic-personas              — create or upsert
//   PATCH  /api/me/topic-personas/:topicSlug   — update nickname / photos
//   DELETE /api/me/topic-personas/:topicSlug   — soft-leave (isActive=false)
//
// Premium gating (free → premium):
//   - max active personas:  2 → 8
//   - max photos per persona: 3 → 5
//
// All endpoints require auth.
const router = require('express').Router();
const Topic = require('../models/Topic');
const TopicPersona = require('../models/TopicPersona');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');

const FREE_MAX_PERSONAS = 2;
const PREMIUM_MAX_PERSONAS = 8;
const FREE_MAX_PHOTOS = 3;
const PREMIUM_MAX_PHOTOS = 5;
const NICKNAME_MAX = 30;

function getCaps(user) {
  const premium = isPremiumActive(user);
  return {
    maxPersonas: premium ? PREMIUM_MAX_PERSONAS : FREE_MAX_PERSONAS,
    maxPhotos: premium ? PREMIUM_MAX_PHOTOS : FREE_MAX_PHOTOS,
    premium,
  };
}

function shapePersona(p) {
  return {
    id: p._id.toString(),
    topicSlug: p.topicSlug,
    nickname: p.nickname,
    photos: p.photos || [],
    isActive: p.isActive,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  };
}

function sanitizePhotos(input, maxPhotos) {
  if (!Array.isArray(input)) return [];
  const clean = input
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim());
  return clean.slice(0, maxPhotos);
}

// ── GET /api/me/topic-personas ────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const list = await TopicPersona.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    ok(res, list.map(shapePersona));
  } catch (e) {
    next(e);
  }
});

// ── POST /api/me/topic-personas ───────────────────────────────────────────
// Body: { topicSlug, nickname, photos: [url] }. Upserts.
router.post('/', auth, async (req, res, next) => {
  try {
    const { topicSlug, nickname, photos } = req.body || {};
    if (!topicSlug || typeof topicSlug !== 'string' || !topicSlug.trim()) {
      return err(res, 'topicSlug required');
    }
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      return err(res, 'nickname required');
    }
    const slug = topicSlug.trim();
    const nick = nickname.trim().slice(0, NICKNAME_MAX);

    // Validate topic exists + active
    const topic = await Topic.findOne({ slug, isActive: true }).lean();
    if (!topic) return err(res, 'Topic not found', 404);

    const caps = getCaps(req.user);

    // Cap check applies on CREATE only — if a persona for this slug
    // already exists we're allowing the upsert through regardless of
    // count (it's a no-op on count).
    const existing = await TopicPersona.findOne({
      userId: req.user._id,
      topicSlug: slug,
    });

    if (!existing) {
      const activeCount = await TopicPersona.countDocuments({
        userId: req.user._id,
        isActive: true,
      });
      if (activeCount >= caps.maxPersonas) {
        return res.status(402).json({
          error: `Persona limit reached (${caps.maxPersonas}). Upgrade to Premium for more.`,
          reason: 'premium_required',
        });
      }
    }

    const photoList = sanitizePhotos(photos, caps.maxPhotos);

    const updated = await TopicPersona.findOneAndUpdate(
      { userId: req.user._id, topicSlug: slug },
      {
        $set: {
          nickname: nick,
          photos: photoList,
          isActive: true,
        },
        $setOnInsert: {
          userId: req.user._id,
          topicSlug: slug,
        },
      },
      { new: true, upsert: true },
    );

    if (existing) {
      ok(res, shapePersona(updated));
    } else {
      created(res, shapePersona(updated));
    }
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/me/topic-personas/:topicSlug ───────────────────────────────
router.patch('/:topicSlug', auth, async (req, res, next) => {
  try {
    const slug = String(req.params.topicSlug || '').trim();
    if (!slug) return err(res, 'topicSlug required');

    const persona = await TopicPersona.findOne({
      userId: req.user._id,
      topicSlug: slug,
    });
    if (!persona) return err(res, 'Persona not found', 404);

    const caps = getCaps(req.user);
    const b = req.body || {};

    if (b.nickname !== undefined) {
      if (typeof b.nickname !== 'string' || !b.nickname.trim()) {
        return err(res, 'Invalid nickname');
      }
      persona.nickname = b.nickname.trim().slice(0, NICKNAME_MAX);
    }
    if (b.photos !== undefined) {
      persona.photos = sanitizePhotos(b.photos, caps.maxPhotos);
    }
    if (b.isActive !== undefined) {
      persona.isActive = !!b.isActive;
    }

    await persona.save();
    ok(res, shapePersona(persona));
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/me/topic-personas/:topicSlug ──────────────────────────────
// Soft delete (isActive=false). Row stays so unlock recipients still
// have history; user can re-POST to re-activate.
router.delete('/:topicSlug', auth, async (req, res, next) => {
  try {
    const slug = String(req.params.topicSlug || '').trim();
    const persona = await TopicPersona.findOneAndUpdate(
      { userId: req.user._id, topicSlug: slug },
      { $set: { isActive: false } },
      { new: true },
    );
    if (!persona) return err(res, 'Persona not found', 404);
    ok(res, shapePersona(persona));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
