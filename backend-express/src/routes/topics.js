// Meyou 密友 — public read-side of the Topic Personas system.
//
// Three endpoints, all auth-gated:
//   GET /api/topics                           — list active topics
//   GET /api/topics/:slug/personas            — paginated personas
//   GET /api/topics/:slug/personas/:userId    — single persona detail
//
// Per the product spec, browsing a topic deliberately hides cross-topic
// information: you can see the persona's nickname + photos + age + bio
// for the topic, but NOT which other topics that user has joined or
// what their main-profile name is. To learn that, the viewer must go
// through the TopicUnlock approval flow (see routes/topic-unlocks.js).
// On the persona-detail endpoint we attach a `mainProfile` payload
// IFF a TopicUnlock(ownerId=target, viewerId=me, status='approved')
// row exists.
const router = require('express').Router();
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const TopicPersona = require('../models/TopicPersona');
const TopicUnlock = require('../models/TopicUnlock');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const PAGE_DEFAULT = 24;
const PAGE_MAX = 60;

// Resolve the set of user ids the requester should never see in any
// listing — me, anyone I've blocked, anyone who's blocked me. Same
// pattern as routes/discover.js.
async function getExclusionIds(me) {
  const usersWhoBlockedMe = await User.find(
    { blockedUsers: me._id },
    { _id: 1 },
  ).lean();
  return new Set([
    me._id.toString(),
    ...(me.blockedUsers || []).map((id) => id.toString()),
    ...usersWhoBlockedMe.map((u) => u._id.toString()),
  ]);
}

// ── GET /api/topics ────────────────────────────────────────────────────────
// Active topics, ordered. The client uses this to build the topic-tab
// strip after the fixed 推薦 / 附近 tabs.
router.get('/', auth, async (_req, res, next) => {
  try {
    const topics = await Topic.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    ok(
      res,
      topics.map((t) => ({
        slug: t.slug,
        name: t.name,
        icon: t.icon || '',
        order: t.order,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/topics/:slug/personas ─────────────────────────────────────────
// Cursor pagination: ?before=<ISO updatedAt> returns rows older than
// the cursor. Self + blocked excluded. Each row carries enough for the
// grid card to render without a second roundtrip (nickname, first
// photo, photo count, age).
router.get('/:slug/personas', auth, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return err(res, 'slug required');

    // Confirm topic is active so we don't leak soft-deleted ones.
    const topic = await Topic.findOne({ slug, isActive: true }).lean();
    if (!topic) return err(res, 'Topic not found', 404);

    const limit = Math.max(
      1,
      Math.min(PAGE_MAX, parseInt(req.query.limit, 10) || PAGE_DEFAULT),
    );
    const beforeRaw = req.query.before;
    const beforeDate = beforeRaw ? new Date(String(beforeRaw)) : null;
    const cursorClause =
      beforeDate && !Number.isNaN(beforeDate.getTime())
        ? { updatedAt: { $lt: beforeDate } }
        : {};

    const excluded = await getExclusionIds(req.user);

    const personas = await TopicPersona.find({
      topicSlug: slug,
      isActive: true,
      userId: { $nin: Array.from(excluded) },
      ...cursorClause,
    })
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = personas.length > limit;
    const slice = hasMore ? personas.slice(0, limit) : personas;

    // Join user for age + online state in one round-trip.
    const userIds = slice.map((p) => p.userId);
    const users = await User.find(
      { _id: { $in: userIds } },
      { age: 1, lastActiveAt: 1 },
    ).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const items = slice.map((p) => {
      const u = userMap.get(p.userId.toString()) || {};
      return {
        userId: p.userId.toString(),
        nickname: p.nickname,
        photo0: p.photos[0] || null,
        photoCount: p.photos.length,
        age: u.age ?? null,
        lastActiveAt: u.lastActiveAt
          ? new Date(u.lastActiveAt).toISOString()
          : null,
      };
    });

    const cursor = hasMore
      ? slice[slice.length - 1].updatedAt.toISOString()
      : null;
    ok(res, { items, cursor });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/topics/:slug/personas/:userId ─────────────────────────────────
// Single persona detail. If the requester has an APPROVED unlock for
// this owner, additionally attach `mainProfile` with cross-topic info.
router.get('/:slug/personas/:userId', auth, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const targetId = String(req.params.userId || '').trim();
    if (!slug || !mongoose.isValidObjectId(targetId)) {
      return err(res, 'Invalid slug or userId');
    }

    const excluded = await getExclusionIds(req.user);
    if (excluded.has(targetId)) {
      // Treat as 404 rather than 403 — we don't tell the requester that
      // a block exists (privacy + symmetry with discover).
      return err(res, 'Persona not found', 404);
    }

    const persona = await TopicPersona.findOne({
      userId: targetId,
      topicSlug: slug,
      isActive: true,
    }).lean();
    if (!persona) return err(res, 'Persona not found', 404);

    const owner = await User.findById(targetId, {
      age: 1,
      bio: 1,
      lastActiveAt: 1,
      nickname: 1,
      avatarUrl: 1,
      photos: 1,
    }).lean();
    if (!owner) return err(res, 'Persona not found', 404);

    const base = {
      userId: targetId,
      topicSlug: slug,
      nickname: persona.nickname,
      photos: persona.photos,
      age: owner.age ?? null,
      bio: owner.bio || null,
      lastActiveAt: owner.lastActiveAt
        ? owner.lastActiveAt.toISOString()
        : null,
    };

    // Conditional cross-topic attach. Only on approved unlock.
    const unlock = await TopicUnlock.findOne({
      ownerId: targetId,
      viewerId: req.user._id,
      status: 'approved',
    }).lean();

    if (unlock) {
      const otherPersonas = await TopicPersona.find({
        userId: targetId,
        isActive: true,
        topicSlug: { $ne: slug },
      })
        .select('topicSlug nickname photos')
        .lean();
      base.mainProfile = {
        nickname: owner.nickname,
        avatarUrl: owner.avatarUrl || null,
        photos: (owner.photos || []).slice(0, 5),
        otherTopics: otherPersonas.map((p) => ({
          topicSlug: p.topicSlug,
          nickname: p.nickname,
          photo0: p.photos[0] || null,
        })),
      };
    }

    ok(res, base);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
