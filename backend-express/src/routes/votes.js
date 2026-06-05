const router = require('express').Router();
const mongoose = require('mongoose');
const VoteEvent = require('../models/VoteEvent');
const VoteEntry = require('../models/VoteEntry');
const Vote = require('../models/Vote');
const UserHighlight = require('../models/UserHighlight');
const VoteReport = require('../models/VoteReport');
const VoteEventUpdate = require('../models/VoteEventUpdate');
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

/** Evenly split [startAt, endAt] into `count` sequential elimination rounds. */
function buildRounds(startAt, endAt, count, advanceMode, advanceValue) {
  const span = (endAt.getTime() - startAt.getTime()) / count;
  const rounds = [];
  for (let i = 0; i < count; i++) {
    rounds.push({
      index: i,
      startAt: new Date(startAt.getTime() + span * i),
      endAt: new Date(startAt.getTime() + span * (i + 1)),
      advanceMode,
      advanceValue,
    });
  }
  rounds[count - 1].endAt = new Date(endAt); // exact end
  return rounds;
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
    type: ev.type ?? 'single',
    rounds: (ev.rounds ?? []).map((r) => ({
      index: r.index,
      startAt: new Date(r.startAt).toISOString(),
      endAt: new Date(r.endAt).toISOString(),
      advanceMode: r.advanceMode,
      advanceValue: r.advanceValue,
    })),
    currentRoundIndex: ev.currentRoundIndex ?? 0,
    status: effectiveStatus(ev),
    entryCount: ev.entryCount ?? 0,
    voteCount: ev.voteCount ?? 0,
    topEntries: (ev.topEntries ?? []).map((t) => ({ entryId: t.entryId?.toString?.() ?? null, rank: t.rank })),
    createdAt: new Date(ev.createdAt).toISOString(),
  };
}

// ── Background close sweep ────────────────────────────────────────────────────
// Finalize a contest: top-3 among still-active entries → winner status +
// topEntries + UserHighlight + push, mark ended. Works for single-round (all
// entries are 'active') and the last round of a multiRound event.
async function finalizeEvent(ev, now) {
  const top = await VoteEntry.find({ eventId: ev._id, status: { $ne: 'eliminated' } })
    .sort({ voteCount: -1, createdAt: 1 })
    .limit(3)
    .lean();
  ev.topEntries = top.map((e, i) => ({ entryId: e._id, rank: i + 1 }));
  ev.status = 'ended';
  await ev.save();

  for (let i = 0; i < top.length; i++) {
    const e = top[i];
    await VoteEntry.updateOne({ _id: e._id }, { $set: { status: `winner${i + 1}` } });
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

// Eliminate the bottom N still-active entries at the current round's end and
// advance currentRoundIndex. Always keeps ≥3 active so a later round can yield
// a podium, and never eliminates everyone.
async function advanceRound(ev) {
  const round = ev.rounds[ev.currentRoundIndex] || {};
  const active = await VoteEntry.find({ eventId: ev._id, status: 'active' })
    .sort({ voteCount: 1, createdAt: 1 }) // worst-first
    .lean();
  let n = round.advanceMode === 'fixed'
    ? round.advanceValue
    : Math.floor(active.length * ((round.advanceValue || 0) / 100));
  n = Math.min(Math.max(0, n), Math.max(0, active.length - 3));
  const toEliminate = active.slice(0, n);
  if (toEliminate.length) {
    await VoteEntry.updateMany(
      { _id: { $in: toEliminate.map((e) => e._id) } },
      { $set: { status: 'eliminated', eliminatedAtRoundIndex: ev.currentRoundIndex } },
    );
  }
  ev.currentRoundIndex += 1;
  await ev.save();
}

async function closeEndedEvents() {
  const now = new Date();
  try {
    await VoteEvent.updateMany(
      { status: 'pending', startAt: { $lte: now }, endAt: { $gt: now } },
      { $set: { status: 'active' } },
    );

    // Single-round events past their end → finalize.
    const singles = await VoteEvent.find({
      type: { $ne: 'multiRound' },
      status: { $ne: 'ended' },
      endAt: { $lte: now },
    });
    for (const ev of singles) await finalizeEvent(ev, now);

    // Multi-round events: process each elapsed round deadline (may advance
    // several rounds if a sweep was missed), finalizing on the last round.
    const multis = await VoteEvent.find({ type: 'multiRound', status: { $ne: 'ended' } });
    for (const ev of multis) {
      if (ev.status === 'pending' && now >= new Date(ev.startAt)) {
        ev.status = 'active';
        await ev.save();
      }
      let guard = 0;
      while (
        ev.status !== 'ended' &&
        ev.rounds[ev.currentRoundIndex] &&
        now >= new Date(ev.rounds[ev.currentRoundIndex].endAt) &&
        guard++ < 10
      ) {
        if (ev.currentRoundIndex >= ev.rounds.length - 1) await finalizeEvent(ev, now);
        else await advanceRound(ev);
      }
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

    // Multi-round (淘汰赛): build N evenly-split elimination rounds. We derive
    // rounds from a count + advance rule (simpler client) rather than a per-round
    // date form; the schema still stores full per-round dates for flexibility.
    const type = b.type === 'multiRound' ? 'multiRound' : 'single';
    let rounds = [];
    if (type === 'multiRound') {
      const count = Math.min(Math.max(parseInt(b.roundCount, 10) || 0, 2), 5);
      if (count < 2) return err(res, 'Multi-round needs 2–5 rounds');
      const advanceMode = ['percent', 'fixed'].includes(b.advanceMode) ? b.advanceMode : 'percent';
      const advanceValue = Number(b.advanceValue) > 0 ? Number(b.advanceValue) : 50;
      rounds = buildRounds(startAt, endAt, count, advanceMode, advanceValue);
    }

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
      type,
      rounds,
      currentRoundIndex: 0,
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
    const st = effectiveStatus(ev);
    if (st === 'ended') return err(res, "Can't edit an ended contest", 409);

    const b = req.body || {};

    // While ACTIVE the creator may only SUPPLEMENT — add description detail,
    // append cover/reference photos, update the link. Anything that would
    // affect entry/vote integrity (title, category, dates, rules, rounds) is
    // locked. Photos are append-only (no removals/shortening).
    if (st === 'active') {
      const lockedTouched = ['title', 'category', 'startAt', 'endAt', 'rules', 'type', 'rounds'].filter(
        (k) => b[k] !== undefined,
      );
      if (lockedTouched.length) {
        return err(res, `Can't change ${lockedTouched.join(', ')} while the contest is active`, 400);
      }
      if (b.description !== undefined) ev.description = String(b.description).slice(0, DESC_MAX);
      if (Array.isArray(b.coverPhotos)) {
        const next = b.coverPhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
        if (next.length < ev.coverPhotos.length || !ev.coverPhotos.every((u) => next.includes(u))) {
          return err(res, "Cover photos are append-only while active", 400);
        }
        ev.coverPhotos = next;
      }
      if (Array.isArray(b.referencePhotos)) {
        const next = b.referencePhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
        if (next.length < ev.referencePhotos.length || !ev.referencePhotos.every((u) => next.includes(u))) {
          return err(res, "Reference photos are append-only while active", 400);
        }
        ev.referencePhotos = next;
      }
      if (b.externalLink !== undefined) {
        if (b.externalLink && !isHttpUrl(b.externalLink)) return err(res, 'Invalid external link');
        ev.externalLink = b.externalLink || null;
      }
      await ev.save();
      return ok(res, serializeEvent(ev, req.user));
    }

    // PENDING → full edit.
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

// ── DELETE /api/votes/:id  (creator, any status — full cascade) ───────────────
// The creator can delete their own event at any time. Cascades to all child
// docs (entries, votes, updates, reports) and the winner Highlights that
// reference it (denormalized, so they'd otherwise dangle). B2 blobs are left
// as harmless orphans. Returns 204.
router.delete('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id).lean();
    if (!ev) return err(res, 'Not found', 404);
    if (ev.creatorId.toString() !== req.user._id.toString()) return err(res, 'Not your event', 403);

    await Promise.all([
      VoteEvent.deleteOne({ _id: ev._id }),
      VoteEntry.deleteMany({ eventId: ev._id }),
      Vote.deleteMany({ eventId: ev._id }),
      VoteEventUpdate.deleteMany({ eventId: ev._id }),
      VoteReport.deleteMany({ eventId: ev._id }),
      UserHighlight.deleteMany({ eventId: ev._id }),
    ]);
    res.status(204).end();
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

    if (scope === 'mine') {
      q.creatorId = req.user._id;
    } else if (scope === 'following') {
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

    const entriesRaw = await VoteEntry.find({ eventId: ev._id })
      .sort({ voteCount: -1, createdAt: 1 })
      .populate('submitterId', 'nickname avatarUrl')
      .lean();
    // Multi-round: surviving/winner entries first, eliminated last (each already
    // ordered by voteCount desc from the query above).
    const entries = entriesRaw
      .slice()
      .sort((a, b) => (a.status === 'eliminated' ? 1 : 0) - (b.status === 'eliminated' ? 1 : 0));

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
          status: e.status ?? 'active',
          eliminatedAtRoundIndex: e.eliminatedAtRoundIndex ?? null,
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
    // Multi-round: entries are only accepted during the first round.
    if (ev.type === 'multiRound' && (ev.currentRoundIndex ?? 0) > 0) {
      return err(res, 'Submissions are closed for this round', 409);
    }
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
    if (entry.status === 'eliminated') return err(res, 'This entry was eliminated', 409);
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

// ── Event updates (活动动态) ───────────────────────────────────────────────────
// POST /api/votes/:id/updates — creator posts a status update (body + ≤3 photos).
router.post('/:id/updates', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id).lean();
    if (!ev) return err(res, 'Not found', 404);
    if (ev.creatorId.toString() !== req.user._id.toString()) return err(res, 'Not your event', 403);
    const body = String(req.body?.body ?? '').trim();
    if (!body) return err(res, 'Update is empty');
    if (body.length > DESC_MAX) return err(res, `Update too long (max ${DESC_MAX})`);
    const photos = Array.isArray(req.body?.photos) ? req.body.photos.filter(isHttpUrl).slice(0, 3) : [];
    const upd = await VoteEventUpdate.create({ eventId: ev._id, body, photos });
    created(res, {
      id: upd._id.toString(),
      body: upd.body,
      photos: upd.photos,
      createdAt: upd.createdAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/votes/:id/updates?before=&limit= — newest first; any auth user.
router.get('/:id/updates', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const q = { eventId: req.params.id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) {
      q._id = { $lt: new mongoose.Types.ObjectId(req.query.before) };
    }
    const [rows, total] = await Promise.all([
      VoteEventUpdate.find(q).sort({ _id: -1 }).limit(limit).lean(),
      VoteEventUpdate.countDocuments({ eventId: req.params.id }),
    ]);
    ok(res, {
      total,
      updates: rows.map((u) => ({
        id: u._id.toString(),
        body: u.body,
        photos: u.photos ?? [],
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/votes/:id/updates/:updateId — creator-only.
router.delete('/:id/updates/:updateId', auth, async (req, res, next) => {
  try {
    const { id, updateId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(updateId)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(id).lean();
    if (!ev) return err(res, 'Not found', 404);
    if (ev.creatorId.toString() !== req.user._id.toString()) return err(res, 'Not your event', 403);
    await VoteEventUpdate.deleteOne({ _id: updateId, eventId: id });
    ok(res, { ok: true });
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
