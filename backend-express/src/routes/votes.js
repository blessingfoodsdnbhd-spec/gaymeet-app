const router = require('express').Router();
const mongoose = require('mongoose');
const VoteEvent = require('../models/VoteEvent');
const VoteEntry = require('../models/VoteEntry');
const Vote = require('../models/Vote');
const UserHighlight = require('../models/UserHighlight');
const VoteReport = require('../models/VoteReport');
const Follow = require('../models/Follow');
const { auth } = require('../middleware/auth');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, created, err } = require('../utils/respond');
const { sendPushToUser } = require('../utils/push');

const TITLE_MAX = 80;
const DESC_MAX = 500;
const CAPTION_MAX = 200;
const MAX_PHOTOS = 5;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const CATEGORIES = ['photography', 'outfit', 'food', 'travel', 'talent', 'pets'];
const MODES = ['one', 'fivePerDay', 'unlimited'];

function isHttpUrl(s) {
  return typeof s === 'string' && /^https?:\/\/.+/i.test(s);
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Effective status between 60s close sweeps (denormalized status can lag). */
function effectiveStatus(ev, now = new Date()) {
  if (ev.status === 'ended' || now >= new Date(ev.endAt)) return 'ended';
  if (now >= new Date(ev.startAt)) return 'active';
  return 'pending';
}

function serializeEvent(ev, creator) {
  return {
    id: ev._id.toString(),
    creatorId: ev.creatorId?._id?.toString?.() ?? ev.creatorId.toString(),
    creator: creator
      ? { id: creator._id.toString(), displayName: creator.nickname, avatarUrl: creator.avatarUrl ?? null }
      : undefined,
    title: ev.title,
    description: ev.description,
    category: ev.category,
    coverPhotos: ev.coverPhotos ?? [],
    referencePhotos: ev.referencePhotos ?? [],
    externalLink: ev.externalLink ?? null,
    startAt: new Date(ev.startAt).toISOString(),
    endAt: new Date(ev.endAt).toISOString(),
    rules: ev.rules ?? { mode: 'one' },
    status: effectiveStatus(ev),
    entryCount: ev.entryCount ?? 0,
    voteCount: ev.voteCount ?? 0,
    topEntries: (ev.topEntries ?? []).map((t) => ({ entryId: t.entryId?.toString?.() ?? null, rank: t.rank })),
    createdAt: new Date(ev.createdAt).toISOString(),
  };
}

// ── Background close sweep ────────────────────────────────────────────────────
// pending→active, then close events past endAt: compute top-3, write topEntries,
// upsert UserHighlight for top-3 (with votes), push-notify winners + creator.
async function closeEndedEvents() {
  const now = new Date();
  try {
    await VoteEvent.updateMany(
      { status: 'pending', startAt: { $lte: now }, endAt: { $gt: now } },
      { $set: { status: 'active' } },
    );
    const toClose = await VoteEvent.find({ status: { $ne: 'ended' }, endAt: { $lte: now } });
    for (const ev of toClose) {
      const top = await VoteEntry.find({ eventId: ev._id })
        .sort({ voteCount: -1, createdAt: 1 })
        .limit(3)
        .lean();
      ev.topEntries = top.map((e, i) => ({ entryId: e._id, rank: i + 1 }));
      ev.status = 'ended';
      await ev.save();

      for (let i = 0; i < top.length; i++) {
        const e = top[i];
        if ((e.voteCount || 0) <= 0) continue; // no highlight for zero-vote placements
        await UserHighlight.updateOne(
          { userId: e.submitterId, eventId: ev._id },
          { $set: { eventTitle: ev.title, entryPhotoUrl: e.photoUrl, rank: i + 1, endedAt: now } },
          { upsert: true },
        );
        const medal = ['🥇', '🥈', '🥉'][i];
        sendPushToUser(e.submitterId, {
          title: `${medal} You placed #${i + 1}!`,
          body: ev.title,
          data: { type: 'vote_result', eventId: ev._id.toString() },
        }).catch(() => {});
      }
      sendPushToUser(ev.creatorId, {
        title: 'Your contest ended 🎉',
        body: ev.title,
        data: { type: 'vote_ended', eventId: ev._id.toString() },
      }).catch(() => {});
    }
  } catch (_) {
    // best effort — next sweep retries
  }
}
// Start the 60s sweep once per process. First fire is +60s, after DB is up.
if (process.env.NODE_ENV !== 'test') {
  setInterval(closeEndedEvents, 60_000).unref?.();
}

// ── POST /api/votes ───────────────────────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = String(b.title ?? '').trim();
    if (!title) return err(res, 'Title is required');
    if (title.length > TITLE_MAX) return err(res, `Title too long (max ${TITLE_MAX})`);
    if (!CATEGORIES.includes(b.category)) return err(res, 'Invalid category');
    const coverPhotos = Array.isArray(b.coverPhotos) ? b.coverPhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS) : [];
    if (coverPhotos.length === 0) return err(res, 'At least one cover photo is required');
    const referencePhotos = Array.isArray(b.referencePhotos)
      ? b.referencePhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS)
      : [];
    if (b.externalLink && !isHttpUrl(b.externalLink)) return err(res, 'Invalid external link');
    const mode = MODES.includes(b.rules?.mode) ? b.rules.mode : 'one';

    const startAt = new Date(b.startAt);
    const endAt = new Date(b.endAt);
    if (isNaN(startAt) || isNaN(endAt)) return err(res, 'Invalid dates');
    if (endAt <= startAt) return err(res, 'End must be after start');
    if (endAt - startAt > MAX_DURATION_MS) return err(res, 'Max duration is 30 days');

    const now = new Date();
    const status = now >= startAt ? (now >= endAt ? 'ended' : 'active') : 'pending';

    const ev = await VoteEvent.create({
      creatorId: req.user._id,
      title,
      description: String(b.description ?? '').slice(0, DESC_MAX),
      category: b.category,
      coverPhotos,
      referencePhotos,
      externalLink: b.externalLink || null,
      startAt,
      endAt,
      rules: { mode },
      status,
      location: req.user.location ?? undefined,
    });
    created(res, serializeEvent(ev, req.user));
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/votes/:id  (creator, pending only) ─────────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id);
    if (!ev) return err(res, 'Not found', 404);
    if (ev.creatorId.toString() !== req.user._id.toString()) return err(res, 'Not your event', 403);
    if (effectiveStatus(ev) !== 'pending') return err(res, 'Can only edit before it starts', 409);

    const b = req.body || {};
    if (b.title !== undefined) {
      const t = String(b.title).trim();
      if (!t || t.length > TITLE_MAX) return err(res, 'Invalid title');
      ev.title = t;
    }
    if (b.description !== undefined) ev.description = String(b.description).slice(0, DESC_MAX);
    if (b.category !== undefined) {
      if (!CATEGORIES.includes(b.category)) return err(res, 'Invalid category');
      ev.category = b.category;
    }
    if (Array.isArray(b.coverPhotos)) ev.coverPhotos = b.coverPhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
    if (Array.isArray(b.referencePhotos)) ev.referencePhotos = b.referencePhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
    if (b.externalLink !== undefined) {
      if (b.externalLink && !isHttpUrl(b.externalLink)) return err(res, 'Invalid external link');
      ev.externalLink = b.externalLink || null;
    }
    if (b.rules?.mode !== undefined) {
      if (!MODES.includes(b.rules.mode)) return err(res, 'Invalid rule');
      ev.rules.mode = b.rules.mode;
    }
    if (b.startAt !== undefined || b.endAt !== undefined) {
      const s = b.startAt !== undefined ? new Date(b.startAt) : ev.startAt;
      const e = b.endAt !== undefined ? new Date(b.endAt) : ev.endAt;
      if (isNaN(s) || isNaN(e) || e <= s) return err(res, 'Invalid dates');
      if (e - s > MAX_DURATION_MS) return err(res, 'Max duration is 30 days');
      ev.startAt = s;
      ev.endAt = e;
      ev.status = new Date() >= s ? 'active' : 'pending';
    }
    await ev.save();
    ok(res, serializeEvent(ev, req.user));
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/votes/:id  (creator, pending + no entries) ────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id);
    if (!ev) return err(res, 'Not found', 404);
    if (ev.creatorId.toString() !== req.user._id.toString()) return err(res, 'Not your event', 403);
    if (effectiveStatus(ev) !== 'pending') return err(res, 'Can only delete before it starts', 409);
    if ((ev.entryCount ?? 0) > 0) return err(res, 'Has entries already', 409);
    await VoteEvent.deleteOne({ _id: ev._id });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/votes ────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { status, category, scope, before } = req.query;

    const q = {};
    if (status && status !== 'all' && ['pending', 'active', 'ended'].includes(status)) q.status = status;
    if (category && CATEGORIES.includes(category)) q.category = category;
    if (before && mongoose.isValidObjectId(before)) q._id = { $lt: new mongoose.Types.ObjectId(before) };

    if (scope === 'following') {
      const ids = await Follow.find({ follower: req.user._id }).distinct('following');
      q.creatorId = { $in: ids };
    } else if (scope === 'nearby') {
      const coords = req.user.location?.coordinates;
      if (coords && (coords[0] || coords[1])) {
        q.location = { $near: { $geometry: { type: 'Point', coordinates: coords }, $maxDistance: 100000 } };
      }
    }

    // Active first, then newest. ($near already imposes distance order when used.)
    const sort = q.location ? undefined : { status: 1, _id: -1 };
    let cursor = VoteEvent.find(q).limit(limit).populate('creatorId', 'nickname avatarUrl');
    if (sort) cursor = cursor.sort(sort);
    const rows = await cursor.lean();
    // 'active' sorts before 'ended'/'pending' alphabetically — good enough; the
    // client mainly requests status=active for the carousel anyway.
    const events = rows.map((ev) => serializeEvent(ev, ev.creatorId));
    ok(res, { events });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/votes/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id).populate('creatorId', 'nickname avatarUrl').lean();
    if (!ev) return err(res, 'Not found', 404);

    const entries = await VoteEntry.find({ eventId: ev._id })
      .sort({ voteCount: -1, createdAt: 1 })
      .populate('submitterId', 'nickname avatarUrl')
      .lean();

    // Which entries the viewer has voted for (so the client can show voted state).
    const myVotes = await Vote.find({ voterId: req.user._id, eventId: ev._id }).distinct('entryId');
    const votedSet = new Set(myVotes.map((id) => id.toString()));

    const myEntry = entries.find((e) => e.submitterId && e.submitterId._id.toString() === req.user._id.toString());

    ok(res, {
      event: serializeEvent(ev, ev.creatorId),
      isCreator: ev.creatorId?._id?.toString() === req.user._id.toString(),
      myEntryId: myEntry ? myEntry._id.toString() : null,
      entries: entries
        .filter((e) => e.submitterId)
        .map((e) => ({
          id: e._id.toString(),
          submitter: {
            id: e.submitterId._id.toString(),
            displayName: e.submitterId.nickname,
            avatarUrl: e.submitterId.avatarUrl ?? null,
          },
          photoUrl: e.photoUrl,
          caption: e.caption ?? '',
          voteCount: e.voteCount ?? 0,
          votedByMe: votedSet.has(e._id.toString()),
        })),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/votes/:id/entries ───────────────────────────────────────────────
router.post('/:id/entries', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id);
    if (!ev) return err(res, 'Not found', 404);
    if (effectiveStatus(ev) !== 'active') return err(res, 'Event is not accepting entries', 409);
    if (ev.creatorId.toString() === req.user._id.toString()) {
      return err(res, "The creator can't enter their own contest", 403);
    }
    const photoUrl = String(req.body?.photoUrl ?? '');
    if (!isHttpUrl(photoUrl)) return err(res, 'A photo is required');

    const exists = await VoteEntry.exists({ eventId: ev._id, submitterId: req.user._id });
    if (exists) return err(res, 'You already entered this contest', 409);

    const entry = await VoteEntry.create({
      eventId: ev._id,
      submitterId: req.user._id,
      photoUrl,
      caption: String(req.body?.caption ?? '').slice(0, CAPTION_MAX),
    });
    await VoteEvent.updateOne({ _id: ev._id }, { $inc: { entryCount: 1 } });
    created(res, { id: entry._id.toString() });
  } catch (e) {
    if (e && e.code === 11000) return err(res, 'You already entered this contest', 409);
    next(e);
  }
});

// ── DELETE /api/votes/:id/entries/me ──────────────────────────────────────────
router.delete('/:id/entries/me', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const entry = await VoteEntry.findOne({ eventId: req.params.id, submitterId: req.user._id });
    if (!entry) return err(res, 'No entry to withdraw', 404);
    // Remove its votes + decrement denormalized counters.
    const votesRemoved = await Vote.deleteMany({ entryId: entry._id });
    await VoteEntry.deleteOne({ _id: entry._id });
    await VoteEvent.updateOne(
      { _id: req.params.id },
      { $inc: { entryCount: -1, voteCount: -(votesRemoved.deletedCount || 0) } },
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/votes/:id/entries/:entryId/vote ─────────────────────────────────
router.post('/:id/entries/:entryId/vote', auth, async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(id);
    if (!ev) return err(res, 'Not found', 404);
    if (effectiveStatus(ev) !== 'active') return err(res, 'Voting is closed', 409);

    const entry = await VoteEntry.findOne({ _id: entryId, eventId: id });
    if (!entry) return err(res, 'Entry not found', 404);
    if (entry.submitterId.toString() === req.user._id.toString()) {
      return err(res, "You can't vote for your own entry", 403);
    }

    const mode = ev.rules?.mode || 'one';
    if (mode === 'one') {
      const voted = await Vote.exists({ voterId: req.user._id, eventId: id });
      if (voted) return err(res, 'You already voted in this contest', 409);
    } else if (mode === 'fivePerDay') {
      const todayCount = await Vote.countDocuments({
        voterId: req.user._id,
        eventId: id,
        createdAt: { $gte: startOfToday() },
      });
      if (todayCount >= 5) return err(res, "You've used your 5 votes today", 429);
    }

    try {
      await Vote.create({ voterId: req.user._id, eventId: id, entryId });
    } catch (e) {
      if (e && e.code === 11000) return err(res, 'Already voted for this entry', 409);
      throw e;
    }
    await VoteEntry.updateOne({ _id: entryId }, { $inc: { voteCount: 1 } });
    await VoteEvent.updateOne({ _id: id }, { $inc: { voteCount: 1 } });

    // Coalesced "got a vote" nudge: at most ~1/hour per entry (best-effort —
    // skip if the entry was created very recently to avoid an instant ping).
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/votes/:id/entries/:entryId/vote  (retract; 'one' mode) ────────
router.delete('/:id/entries/:entryId/vote', auth, async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(id);
    if (!ev) return err(res, 'Not found', 404);
    if (effectiveStatus(ev) !== 'active') return err(res, 'Voting is closed', 409);

    const removed = await Vote.deleteOne({ voterId: req.user._id, eventId: id, entryId });
    if (removed.deletedCount > 0) {
      await VoteEntry.updateOne({ _id: entryId }, { $inc: { voteCount: -1 } });
      await VoteEvent.updateOne({ _id: id }, { $inc: { voteCount: -1 } });
    }
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/votes/users/:userId/highlights  (public) ─────────────────────────
router.get('/users/:userId/highlights', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return err(res, 'Invalid id');
    const rows = await UserHighlight.find({ userId: req.params.userId })
      .sort({ endedAt: -1 })
      .limit(20)
      .lean();
    ok(res, {
      highlights: rows.map((h) => ({
        id: h._id.toString(),
        eventId: h.eventId ? h.eventId.toString() : null,
        eventTitle: h.eventTitle,
        entryPhotoUrl: h.entryPhotoUrl,
        rank: h.rank,
        endedAt: new Date(h.endedAt).toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ── Reports (Apple 1.2) ───────────────────────────────────────────────────────
router.post('/:id/report', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    await VoteReport.create({
      reporterId: req.user._id,
      targetType: 'event',
      eventId: req.params.id,
      reason: String(req.body?.reason ?? '').slice(0, 300),
    });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/entries/:entryId/report', auth, async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) return err(res, 'Invalid id');
    await VoteReport.create({
      reporterId: req.user._id,
      targetType: 'entry',
      eventId: id,
      entryId,
      reason: String(req.body?.reason ?? '').slice(0, 300),
    });
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin moderation ──────────────────────────────────────────────────────────
router.delete('/admin/:id', requireAdminAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    await Promise.all([
      VoteEvent.deleteOne({ _id: req.params.id }),
      VoteEntry.deleteMany({ eventId: req.params.id }),
      Vote.deleteMany({ eventId: req.params.id }),
    ]);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/admin/:id/entries/:entryId', requireAdminAuth, async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) return err(res, 'Invalid id');
    const votes = await Vote.deleteMany({ entryId });
    await VoteEntry.deleteOne({ _id: entryId });
    await VoteEvent.updateOne(
      { _id: id },
      { $inc: { entryCount: -1, voteCount: -(votes.deletedCount || 0) } },
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.closeEndedEvents = closeEndedEvents;
