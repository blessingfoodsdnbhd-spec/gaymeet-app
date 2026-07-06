const router = require('express').Router();
const mongoose = require('mongoose');
const VoteEvent = require('../models/VoteEvent');
const VoteEntry = require('../models/VoteEntry');
const Vote = require('../models/Vote');
const VoteReadState = require('../models/VoteReadState');
const UserHighlight = require('../models/UserHighlight');
const VoteReport = require('../models/VoteReport');
const VoteEventUpdate = require('../models/VoteEventUpdate');
const { recordContentReport, hiddenFilter } = require('../services/report');
const Follow = require('../models/Follow');
const { auth } = require('../middleware/auth');
const { voteCreateIpLimiter, voteCreateUserLimiter } = require('../middleware/rateLimit');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, created, err } = require('../utils/respond');
const { sendPushToUser } = require('../utils/push');
const { notify, coalesceOk } = require('../services/notificationService');
const User = require('../models/User');
const { COIN_REWARDS } = require('../utils/coins');
const { blockedIdSet } = require('../utils/blocking');
const { hasProfanity } = require('../utils/profanityFilter');

const TITLE_MAX = 80;
const DESC_MAX = 500;
const CAPTION_MAX = 200;
const MAX_PHOTOS = 5;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Contests now run a fixed 15-day window, server-controlled (the create form no
// longer has start/end pickers). endAt = startAt + 15d, overriding any client value.
const EVENT_DURATION_MS = 15 * 24 * 60 * 60 * 1000;
const CATEGORIES = ['photography', 'outfit', 'food', 'travel', 'talent', 'pets'];
const MODES = ['one', 'fivePerDay', 'unlimited'];
// Max entries attached per event in the feed carousel. Bounds payload/work
// across a page of ≤50 events (≤600 entry docs); deeper browsing uses the
// detail screen. Surfaced as a `log` line when any event is truncated.
const FEED_ENTRIES_CAP = 12;

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
      ? { id: creator._id.toString(), displayName: creator.nickname, avatarUrl: creator.avatarUrl ?? null, isOfficial: creator.isOfficial ?? false, isVerified: creator.isVerified ?? false, isPremium: creator.isPremium ?? false }
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

// Attach a per-event entry CAROUSEL + the viewer's read progress to a page of
// serialized feed events. Batches every DB read (entries, my votes, read state)
// so the feed stays O(1) round trips regardless of page size. Mutates `events`
// in place, adding { entries[], cover, myProgress } to each. Resilient to events
// with zero entries (legacy / pre-backfill) → entries:[], cover from coverPhotos.
async function attachFeedEntries(events, viewerId, blockedSet) {
  if (!events.length) return;
  const blocked = blockedSet || new Set();
  const ids = events.map((e) => new mongoose.Types.ObjectId(e.id));

  const [allEntries, myVoteEntryIds, readStates] = await Promise.all([
    VoteEntry.find({ eventId: { $in: ids } })
      .sort({ voteCount: -1, createdAt: 1 }) // ranked leaderboard order
      .populate('submitterId', 'nickname avatarUrl isOfficial isVerified isPremium')
      .lean(),
    Vote.find({ voterId: viewerId, eventId: { $in: ids } }).distinct('entryId'),
    VoteReadState.find({ userId: viewerId, voteEventId: { $in: ids } }).lean(),
  ]);

  const votedSet = new Set(myVoteEntryIds.map((id) => id.toString()));
  const readByEvent = new Map(readStates.map((r) => [r.voteEventId.toString(), r]));
  const byEvent = new Map();
  const viewerStr = viewerId?.toString();
  for (const e of allEntries) {
    if (!e.submitterId) continue; // skip entries whose submitter was deleted
    if (blocked.has(e.submitterId._id.toString())) continue; // mutual block: hide their entry
    // Auto-hidden entry: skip unless the viewer is its submitter (审核中).
    if (e.hidden && e.submitterId._id.toString() !== viewerStr) continue;
    const k = e.eventId.toString();
    (byEvent.get(k) || byEvent.set(k, []).get(k)).push(e);
  }

  let truncated = 0;
  for (const ev of events) {
    const ranked = byEvent.get(ev.id) || []; // already voteCount-desc, createdAt-asc
    if (!ranked.length) {
      ev.entries = [];
      ev.cover = ev.coverPhotos?.[0] ?? null;
      ev.myProgress = { lastSeenEntryId: null, lastSeenIndex: 0, unseenCount: 0 };
      continue;
    }
    const read = readByEvent.get(ev.id);
    const lastSeenAt = read?.lastSeenAt ? new Date(read.lastSeenAt) : null;
    const lastSeenIndex = read?.lastSeenIndex ?? 0;
    const rankOf = new Map(ranked.map((e, i) => [e._id.toString(), i + 1]));

    // Carousel order: top1·top2·top3, then NEW (created after lastSeenAt, newest
    // first), then RESUME (remaining ranked from the last-seen position, wrapping
    // to fill). Set-deduped so a top-3 entry never repeats later. Capped.
    const seen = new Set();
    const order = [];
    const tagFor = (entry, tag) => {
      const k = entry._id.toString();
      if (seen.has(k)) return;
      seen.add(k);
      order.push({ entry, tag });
    };
    ['top1', 'top2', 'top3'].forEach((tag, i) => ranked[i] && tagFor(ranked[i], tag));
    if (lastSeenAt) {
      ranked
        .filter((e) => new Date(e.createdAt) > lastSeenAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .forEach((e) => tagFor(e, 'new'));
    }
    const start = Math.min(Math.max(lastSeenIndex, 0), ranked.length);
    for (let i = start; i < ranked.length; i++) tagFor(ranked[i], 'resume');
    for (let i = 0; i < ranked.length; i++) tagFor(ranked[i], 'resume');

    if (order.length > FEED_ENTRIES_CAP) truncated++;
    const capped = order.slice(0, FEED_ENTRIES_CAP);

    ev.entries = capped.map(({ entry, tag }) => ({
      entryId: entry._id.toString(),
      photoUrl: entry.photoUrl,
      submitter: {
        id: entry.submitterId._id.toString(),
        displayName: entry.submitterId.nickname,
        avatarUrl: entry.submitterId.avatarUrl ?? null,
        isOfficial: entry.submitterId.isOfficial ?? false,
        isVerified: entry.submitterId.isVerified ?? false,
        isPremium: entry.submitterId.isPremium ?? false,
      },
      voteCount: entry.voteCount ?? 0,
      votedByMe: votedSet.has(entry._id.toString()),
      rank: rankOf.get(entry._id.toString()),
      tag,
    }));
    ev.cover = ev.entries[0]?.photoUrl ?? ev.coverPhotos?.[0] ?? null; // dynamic top-1 cover
    ev.myProgress = {
      lastSeenEntryId: read?.lastSeenEntryId ? read.lastSeenEntryId.toString() : null,
      lastSeenIndex,
      unseenCount: lastSeenAt
        ? ranked.filter((e) => new Date(e.createdAt) > lastSeenAt).length
        : ranked.length, // never opened → every entry is unseen
    };
  }
  if (truncated) {
    console.log(`[votes feed] capped entries at ${FEED_ENTRIES_CAP} for ${truncated} event(s)`);
  }
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
    notify(e.submitterId, 'vote_result', {
      title: `${medal} You placed #${i + 1}!`,
      body: ev.title,
      data: { eventId: ev._id.toString() },
    }).catch(() => {});
  }
  notify(ev.creatorId, 'vote_ended', {
    title: 'Your contest ended 🎉',
    body: ev.title,
    data: { eventId: ev._id.toString() },
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
// Rate limited: 3/hour per IP AND 3/hour per user (anti spam-bot contest floods).
router.post('/', auth, voteCreateIpLimiter, voteCreateUserLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = String(b.title ?? '').trim();
    if (!title) return err(res, 'Title is required');
    if (title.length > TITLE_MAX) return err(res, `Title too long (max ${TITLE_MAX})`);
    const description = String(b.description ?? '').trim();
    if (!description) return err(res, 'Description is required');
    if (!CATEGORIES.includes(b.category)) return err(res, 'Invalid category');

    // The initiator is now a contestant: creating a contest requires the
    // creator's own entry photo, auto-added as VoteEntry #1 below. That entry
    // photo also seeds the dynamic cover (top-ranked entry's photo) — there are
    // no separate cover/reference photos, caption, external link, or format.
    const entryPhotoUrl = String(b.entryPhotoUrl ?? '');
    if (!isHttpUrl(entryPhotoUrl)) return err(res, 'Your entry photo is required');

    // Fixed 15-day window, server-controlled (client time pickers removed). The
    // contest starts now and is active immediately.
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + EVENT_DURATION_MS);

    const ev = await VoteEvent.create({
      creatorId: req.user._id,
      title,
      description: description.slice(0, DESC_MAX),
      category: b.category,
      coverPhotos: [],
      referencePhotos: [],
      externalLink: null,
      startAt,
      endAt,
      // One vote per entry, unlimited entries (不限/每个作品一票) — no rule UI.
      rules: { mode: 'unlimited' },
      type: 'single',
      rounds: [],
      currentRoundIndex: 0,
      status: 'active',
      entryCount: 1, // initiator's auto-entry, created below
      location: req.user.location ?? undefined,
    });

    // Initiator IS contestant: auto-create the creator's entry (they start as
    // the sole entry → rank #1; they still can't vote for their own entry).
    await VoteEntry.create({
      eventId: ev._id,
      submitterId: req.user._id,
      photoUrl: entryPhotoUrl,
      caption: '',
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

    // While ACTIVE the creator may SUPPLEMENT or RESTYLE the presentation —
    // description, cover/reference photos (full replace: add + remove, ≤5,
    // valid URLs), and the link. Anything that would affect entry/vote
    // integrity (title, category, dates, rules, rounds) stays locked.
    if (st === 'active') {
      const lockedTouched = ['title', 'category', 'startAt', 'endAt', 'rules', 'type', 'rounds'].filter(
        (k) => b[k] !== undefined,
      );
      if (lockedTouched.length) {
        return err(res, `Can't change ${lockedTouched.join(', ')} while the contest is active`, 400);
      }
      if (b.description !== undefined) ev.description = String(b.description).slice(0, DESC_MAX);
      if (Array.isArray(b.coverPhotos)) ev.coverPhotos = b.coverPhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
      if (Array.isArray(b.referencePhotos)) ev.referencePhotos = b.referencePhotos.filter(isHttpUrl).slice(0, MAX_PHOTOS);
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
      VoteReadState.deleteMany({ voteEventId: ev._id }),
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

    // Mutual block: hide contests created by — and entries submitted by — anyone
    // in a block with the viewer. Resolved once; the `$nin` is composed into
    // each scope's creatorId clause below so a scope filter can't drop it.
    const blockedSet = await blockedIdSet(req.user);
    const blockedArr = [...blockedSet];

    if (scope === 'mine') {
      q.creatorId = req.user._id; // your own contests — self can't be blocked
    } else if (scope === 'following') {
      const ids = await Follow.find({ follower: req.user._id }).distinct('following');
      q.creatorId = blockedArr.length ? { $in: ids, $nin: blockedArr } : { $in: ids };
    } else {
      if (blockedArr.length) q.creatorId = { $nin: blockedArr };
      if (scope === 'nearby') {
        const coords = req.user.location?.coordinates;
        if (coords && (coords[0] || coords[1])) {
          q.location = { $near: { $geometry: { type: 'Point', coordinates: coords }, $maxDistance: 100000 } };
        }
      }
    }

    // Auto-hidden events are dropped for everyone except their own creator
    // (who still sees them with an 审核中 badge). In `mine` scope the creator==viewer
    // clause always matches, so own hidden events remain visible.
    Object.assign(q, hiddenFilter(req.user._id, 'creatorId'));

    // Active first, then newest. ($near already imposes distance order when used.)
    const sort = q.location ? undefined : { status: 1, _id: -1 };
    let cursor = VoteEvent.find(q).limit(limit).populate('creatorId', 'nickname avatarUrl isOfficial isVerified isPremium');
    if (sort) cursor = cursor.sort(sort);
    const rows = await cursor.lean();
    // 'active' sorts before 'ended'/'pending' alphabetically — good enough; the
    // client mainly requests status=active for the carousel anyway.
    const events = rows.map((ev) => serializeEvent(ev, ev.creatorId));
    await attachFeedEntries(events, req.user._id, blockedSet); // adds entries[]/cover/myProgress per event
    ok(res, { events });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/votes/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const ev = await VoteEvent.findById(req.params.id).populate('creatorId', 'nickname avatarUrl isOfficial isVerified isPremium').lean();
    if (!ev) return err(res, 'Not found', 404);

    // Mutual block: a blocked creator's contest is "not found"; blocked
    // submitters' entries are filtered out below.
    const blockedSet = await blockedIdSet(req.user);
    const creatorIdStr = ev.creatorId?._id?.toString() ?? ev.creatorId?.toString();
    if (blockedSet.has(creatorIdStr)) return err(res, 'Not found', 404);

    // Auto-hidden event: invisible to everyone except its creator (审核中).
    const viewerStr = req.user._id.toString();
    if (ev.hidden && creatorIdStr !== viewerStr) return err(res, 'Not found', 404);

    const entriesRaw = await VoteEntry.find({ eventId: ev._id })
      .sort({ voteCount: -1, createdAt: 1 })
      .populate('submitterId', 'nickname avatarUrl isOfficial isVerified isPremium')
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
        .filter((e) => e.submitterId && !blockedSet.has(e.submitterId._id.toString()))
        // Auto-hidden entries drop out for everyone except their own submitter.
        .filter((e) => !e.hidden || e.submitterId._id.toString() === viewerStr)
        .map((e) => ({
          id: e._id.toString(),
          submitter: {
            id: e.submitterId._id.toString(),
            displayName: e.submitterId.nickname,
            avatarUrl: e.submitterId.avatarUrl ?? null,
            isOfficial: e.submitterId.isOfficial ?? false,
            isVerified: e.submitterId.isVerified ?? false,
            isPremium: e.submitterId.isPremium ?? false,
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

    const caption = String(req.body?.caption ?? '').slice(0, CAPTION_MAX);
    if (hasProfanity(caption)) return err(res, 'Inappropriate content', 422);

    const entry = await VoteEntry.create({
      eventId: ev._id,
      submitterId: req.user._id,
      photoUrl,
      caption,
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

    // Daily vote bonus — first vote of the UTC day earns coins. Atomic once/day
    // via the date guard; never blocks the response on failure.
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (req.user.coinRewards?.lastVoteBonusDate !== today) {
        await User.updateOne(
          { _id: req.user._id, 'coinRewards.lastVoteBonusDate': { $ne: today } },
          { $set: { 'coinRewards.lastVoteBonusDate': today }, $inc: { coins: COIN_REWARDS.voteDaily } },
        );
      }
    } catch (_) {}

    // First-vote nudge to the entrant (entry.voteCount is the pre-increment
    // value). Coalesced to ~1/hour per entry as a safety net against races.
    if ((entry.voteCount || 0) === 0 && coalesceOk(`firstvote:${entryId}`, 60 * 60 * 1000)) {
      notify(entry.submitterId, 'vote_first_vote', {
        title: '你的作品收到第一票!🎉',
        body: ev.title,
        data: { eventId: id },
      }).catch(() => {});
    }

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

// ── POST /api/votes/:id/progress  (carousel read state) ───────────────────────
// The client debounces this as the viewer swipes the feed carousel; we record
// the last-seen entry/index so the next feed fetch can resume and compute the
// "🆕 N new entries" badge. Upsert keeps it one doc per (user, event).
router.post('/:id/progress', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const entryId =
      req.body?.entryId && mongoose.isValidObjectId(req.body.entryId) ? req.body.entryId : null;
    const index = Math.max(0, parseInt(req.body?.index, 10) || 0);
    await VoteReadState.updateOne(
      { userId: req.user._id, voteEventId: req.params.id },
      { $set: { lastSeenEntryId: entryId, lastSeenIndex: index, lastSeenAt: new Date() } },
      { upsert: true },
    );
    ok(res, { ok: true });
  } catch (e) {
    if (e && e.code === 11000) return ok(res, { ok: true }); // concurrent upsert race — benign
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
    // Admin triage queue (VoteReport) — one row per report.
    await VoteReport.create({
      reporterId: req.user._id,
      targetType: 'event',
      eventId: req.params.id,
      reason: String(req.body?.reason ?? '').slice(0, 300),
    });
    // Auto-hide engine (unique-reporter count → hide at 3). Best-effort so a
    // moderation hiccup never fails the user's report.
    recordContentReport({
      reporterId: req.user._id,
      reporter: req.user, // admin reporter → immediate hide (weight 3)
      targetType: 'voteEvent',
      targetId: req.params.id,
      reason: req.body?.reason,
    }).catch(() => {});
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/entries/:entryId/report', auth, async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) return err(res, 'Invalid id');
    // Admin triage queue (VoteReport) — one row per report.
    await VoteReport.create({
      reporterId: req.user._id,
      targetType: 'entry',
      eventId: id,
      entryId,
      reason: String(req.body?.reason ?? '').slice(0, 300),
    });
    // Auto-hide engine (unique-reporter count → hide at 3).
    recordContentReport({
      reporterId: req.user._id,
      reporter: req.user, // admin reporter → immediate hide (weight 3)
      targetType: 'voteEntry',
      targetId: entryId,
      reason: req.body?.reason,
    }).catch(() => {});
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
      VoteReadState.deleteMany({ voteEventId: req.params.id }),
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
