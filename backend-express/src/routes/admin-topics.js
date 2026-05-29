// Meyou 密友 — admin CRUD for Topic + idempotent seed endpoint.
//
//   POST   /api/admin/seed-topics     — upsert the 8 default topics
//   GET    /api/admin/topics          — list ALL (with persona counts)
//   POST   /api/admin/topics          — create
//   PATCH  /api/admin/topics/:slug    — update
//   DELETE /api/admin/topics/:slug    — soft delete (isActive=false)
//
// Gated by X-Admin-Token header; same fail-closed 503-when-unset
// pattern as admin-cleanup + admin-announcements + google-status.
const router = require('express').Router();
const Topic = require('../models/Topic');
const TopicPersona = require('../models/TopicPersona');
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

// Seed list. Order is the visual order in the topic tab strip.
// User-supplied spec lists 8 slugs; we add a small emoji for each
// (the spec omitted one for `tattoo`, picked 🎨 as a neutral default —
// admin can PATCH later).
const SEED_TOPICS = [
  { slug: 'white-socks', name: { en: 'White Socks', zh: '白襪' }, icon: '🧦', order: 10 },
  { slug: 'glasses',     name: { en: 'Glasses',     zh: '眼鏡' }, icon: '👓', order: 20 },
  { slug: 'tibet',       name: { en: 'Tibet',       zh: '西藏' }, icon: '⛰️', order: 30 },
  { slug: 'muscle',      name: { en: 'Muscle',      zh: '肌肉' }, icon: '💪', order: 40 },
  { slug: 'bearded',     name: { en: 'Bearded',     zh: '絡腮鬍' }, icon: '🧔', order: 50 },
  { slug: 'tattoo',      name: { en: 'Tattoo',      zh: '紋身' }, icon: '🎨', order: 60 },
  { slug: 'sports',      name: { en: 'Sports',      zh: '運動' }, icon: '🏃', order: 70 },
  { slug: 'trendy',      name: { en: 'Trendy',      zh: '潮流' }, icon: '✨', order: 80 },
];

// ── POST /api/admin/seed-topics ───────────────────────────────────────────
// Idempotent: upserts each seed topic. On re-run, name/icon/order are
// refreshed to spec values (so an admin can re-call after editing this
// file to push corrections without manually PATCHing each slug). Set
// isActive=true so soft-deleted seeds get resurrected.
router.post('/seed-topics', async (_req, res, next) => {
  try {
    const ops = SEED_TOPICS.map((t) => ({
      updateOne: {
        filter: { slug: t.slug },
        update: {
          $set: {
            name: t.name,
            icon: t.icon,
            order: t.order,
            isActive: true,
          },
          $setOnInsert: { slug: t.slug },
        },
        upsert: true,
      },
    }));
    const result = await Topic.bulkWrite(ops);
    ok(res, {
      upserts: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      seeded: SEED_TOPICS.map((t) => t.slug),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/topics ─────────────────────────────────────────────────
// All topics, including soft-deleted; persona counts attached so the
// admin sees how many users opted into each before mutating it.
router.get('/topics', async (_req, res, next) => {
  try {
    const topics = await Topic.find({}).sort({ order: 1, createdAt: 1 }).lean();
    const slugs = topics.map((t) => t.slug);
    const counts = await TopicPersona.aggregate([
      { $match: { topicSlug: { $in: slugs }, isActive: true } },
      { $group: { _id: '$topicSlug', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    ok(
      res,
      topics.map((t) => ({
        ...t,
        personaCount: countMap.get(t.slug) || 0,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/topics ────────────────────────────────────────────────
router.post('/topics', async (req, res, next) => {
  try {
    const { slug, name, icon, order } = req.body || {};
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return err(res, 'slug required');
    }
    if (
      !name ||
      typeof name !== 'object' ||
      !name.en ||
      !name.zh
    ) {
      return err(res, 'name { en, zh } required');
    }
    const trimmedSlug = slug.trim();
    const exists = await Topic.findOne({ slug: trimmedSlug }).lean();
    if (exists) return err(res, 'slug already exists', 409);

    const topic = await Topic.create({
      slug: trimmedSlug,
      name: { en: String(name.en).trim(), zh: String(name.zh).trim() },
      icon: typeof icon === 'string' ? icon : '',
      order: Number.isFinite(order) ? order : 100,
      isActive: true,
    });
    created(res, topic.toObject());
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/admin/topics/:slug ─────────────────────────────────────────
router.patch('/topics/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const updates = {};
    const b = req.body || {};
    if (b.name !== undefined) {
      if (
        !b.name ||
        typeof b.name !== 'object' ||
        !b.name.en ||
        !b.name.zh
      ) {
        return err(res, 'name must be { en, zh }');
      }
      updates.name = { en: String(b.name.en).trim(), zh: String(b.name.zh).trim() };
    }
    if (b.icon !== undefined) updates.icon = String(b.icon || '');
    if (b.order !== undefined && Number.isFinite(b.order)) {
      updates.order = b.order;
    }
    if (b.isActive !== undefined) updates.isActive = !!b.isActive;

    const topic = await Topic.findOneAndUpdate({ slug }, updates, { new: true });
    if (!topic) return err(res, 'Topic not found', 404);
    ok(res, topic.toObject());
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/topics/:slug ────────────────────────────────────────
// Soft delete (isActive=false). The personas remain in the collection;
// they just stop appearing in the topic-tab strip.
router.delete('/topics/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const topic = await Topic.findOneAndUpdate(
      { slug },
      { $set: { isActive: false } },
      { new: true },
    );
    if (!topic) return err(res, 'Topic not found', 404);
    ok(res, { slug: topic.slug, isActive: topic.isActive });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
