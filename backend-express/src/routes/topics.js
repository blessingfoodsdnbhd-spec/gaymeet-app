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
const { blockedIdSet } = require('../utils/blocking');

const PAGE_DEFAULT = 24;
const PAGE_MAX = 60;

// Resolve the set of user ids the requester should never see in any
// listing — anyone they've blocked, anyone who's blocked them. Same
// pattern as routes/discover.js. Self is NOT included: the topic-tab
// list deliberately shows the user's own persona at the top with an
// "isSelf" flag so they can confirm their upload actually went
// through (user feedback: "I uploaded a photo but the topic looks
// empty" — that was because we were filtering self out).
// Thin wrapper over the shared symmetric helper (utils/blocking.js) — kept as a
// named local so the call sites below read the same as before.
const getBlockedIds = (me) => blockedIdSet(me);

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
// the cursor. Blocked users excluded. Self is INCLUDED with an
// `isSelf: true` flag and sorted to the top of the first page — so
// users can see their own persona appears in the topic they joined
// (otherwise "I uploaded but nothing's there!" UX).
//
// Self-sort applies only to the first page (no cursor). On subsequent
// pages there's no self to surface anyway.
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
    const isFirstPage = !beforeDate || Number.isNaN(beforeDate?.getTime?.());
    const cursorClause = isFirstPage
      ? {}
      : { updatedAt: { $lt: beforeDate } };

    const blocked = await getBlockedIds(req.user);
    const meId = req.user._id.toString();

    const personas = await TopicPersona.find({
      topicSlug: slug,
      isActive: true,
      userId: { $nin: Array.from(blocked) },
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
      { age: 1, dob: 1, lastActiveAt: 1 },
    ).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const items = slice.map((p) => {
      const u = userMap.get(p.userId.toString()) || {};
      const pidStr = p.userId.toString();
      return {
        userId: pidStr,
        nickname: p.nickname,
        photo0: p.photos[0] || null,
        photoCount: p.photos.length,
        age: u.age ?? null,
        dob: u.dob ? new Date(u.dob).toISOString() : null,
        lastActiveAt: u.lastActiveAt
          ? new Date(u.lastActiveAt).toISOString()
          : null,
        isSelf: pidStr === meId,
      };
    });

    // First-page self-sort: pin the requester's row to the top so the
    // empty-topic UX doesn't hide their own upload.
    if (isFirstPage) {
      items.sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0));
    }

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

    const blocked = await getBlockedIds(req.user);
    if (blocked.has(targetId)) {
      // Treat as 404 rather than 403 — we don't tell the requester that
      // a block exists (privacy + symmetry with discover).
      return err(res, 'Persona not found', 404);
    }
    // Self IS allowed to fetch their own persona detail (so the user
    // can preview what others see). The mainProfile attach below is
    // a no-op for self — TopicUnlock(self, self) never exists.

    const persona = await TopicPersona.findOne({
      userId: targetId,
      topicSlug: slug,
      isActive: true,
    }).lean();
    if (!persona) return err(res, 'Persona not found', 404);

    const owner = await User.findById(targetId, {
      age: 1,
      dob: 1,
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
      dob: owner.dob ? owner.dob.toISOString() : null,
      bio: owner.bio || null,
      lastActiveAt: owner.lastActiveAt
        ? owner.lastActiveAt.toISOString()
        : null,
      // Lets the client show an "edit your photos" CTA instead of the
      // cross-topic unlock request when the viewer is looking at themselves.
      isSelf: targetId === req.user._id.toString(),
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
