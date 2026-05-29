// Meyou 密友 — Topic Personas cross-topic unlock requests.
//
//   POST   /api/topic-unlocks/request          — me → owner, idempotent
//   POST   /api/topic-unlocks/:id/approve      — owner only
//   POST   /api/topic-unlocks/:id/reject       — owner only
//   POST   /api/topic-unlocks/:id/revoke       — owner only (previously approved)
//   GET    /api/topic-unlocks/incoming         — pending toward me
//   GET    /api/topic-unlocks/outgoing         — my pending out
//   GET    /api/topic-unlocks/approved         — owners who approved me +
//                                                viewers I've approved
//
// Premium gating:
//   Free:    3 outgoing requests per rolling 24h
//   Premium: unlimited
//
// All endpoints require auth.
const router = require('express').Router();
const mongoose = require('mongoose');
const TopicUnlock = require('../models/TopicUnlock');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { sendPushToUser } = require('../utils/push');

// Best-effort WS emit. We require socketService at call time (not at
// module top) to avoid a circular import — socketService.js itself
// requires routes via app.js. Same pattern as conversations.js.
function emitToUser(userId, event, payload) {
  try {
    const { getIO } = require('../services/socketService');
    const io = getIO();
    if (io) io.to(`user:${String(userId)}`).emit(event, payload);
  } catch (_) {}
}

const FREE_DAILY_REQUEST_LIMIT = 3;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

function shape(unlock) {
  return {
    id: unlock._id.toString(),
    ownerId: unlock.ownerId.toString(),
    viewerId: unlock.viewerId.toString(),
    status: unlock.status,
    requestedAt: unlock.requestedAt
      ? unlock.requestedAt.toISOString()
      : null,
    approvedAt: unlock.approvedAt ? unlock.approvedAt.toISOString() : null,
    rejectedAt: unlock.rejectedAt ? unlock.rejectedAt.toISOString() : null,
    revokedAt: unlock.revokedAt ? unlock.revokedAt.toISOString() : null,
  };
}

async function attachUser(unlock, side, projection) {
  if (!unlock) return unlock;
  const id = unlock[side];
  const u = await User.findById(id, projection).lean();
  return { ...shape(unlock), [side === 'ownerId' ? 'owner' : 'viewer']: u };
}

// ── POST /api/topic-unlocks/request ───────────────────────────────────────
// Body: { ownerId }. Idempotent — if a row exists, update it back to
// pending (unless already approved, in which case return as-is).
router.post('/request', auth, async (req, res, next) => {
  try {
    const { ownerId } = req.body || {};
    if (!mongoose.isValidObjectId(ownerId)) {
      return err(res, 'ownerId required');
    }
    if (req.user._id.toString() === String(ownerId)) {
      return err(res, "Can't request unlock from yourself");
    }

    // Verify the owner exists (and isn't soft-deleted at the User level).
    const owner = await User.findById(ownerId).lean();
    if (!owner) return err(res, 'Owner not found', 404);

    const premium = isPremiumActive(req.user);
    if (!premium) {
      // Count outgoing requests sent in the rolling 24h window. We count
      // any (re-)request mtime via requestedAt — that's what got bumped
      // last time the viewer hit this endpoint.
      const since = new Date(Date.now() - ROLLING_WINDOW_MS);
      const recentCount = await TopicUnlock.countDocuments({
        viewerId: req.user._id,
        requestedAt: { $gte: since },
      });
      if (recentCount >= FREE_DAILY_REQUEST_LIMIT) {
        return res.status(402).json({
          error: `Daily limit reached (${FREE_DAILY_REQUEST_LIMIT}). Upgrade to Premium for unlimited requests.`,
          reason: 'premium_required',
        });
      }
    }

    const existing = await TopicUnlock.findOne({
      ownerId,
      viewerId: req.user._id,
    });

    if (existing) {
      // Already approved → return as-is without modifying timestamps.
      if (existing.status === 'approved') {
        return ok(res, shape(existing));
      }
      // Revive any other state (pending / rejected / revoked) back to
      // pending. Bump requestedAt so owner inbox surfaces the new ask.
      existing.status = 'pending';
      existing.requestedAt = new Date();
      // Don't clear approvedAt/rejectedAt/revokedAt — they're audit data.
      await existing.save();
      return ok(res, shape(existing));
    }

    const fresh = await TopicUnlock.create({
      ownerId,
      viewerId: req.user._id,
      status: 'pending',
      requestedAt: new Date(),
    });

    // Notify the owner — WS push for the in-app inbox to refresh, and a
    // best-effort FCM/APNs push so they see it cold. Detached so the
    // HTTP response isn't gated on push delivery.
    emitToUser(ownerId, 'topic-unlock:requested', shape(fresh));
    (async () => {
      try {
        const viewer = await User.findById(req.user._id)
          .select('nickname')
          .lean();
        await sendPushToUser(ownerId, {
          title: 'Meyou',
          body: `${viewer?.nickname || 'Someone'} wants to see your other topics`,
          data: { type: 'topic_unlock_requested', unlockId: fresh._id.toString() },
        });
      } catch (_) {}
    })();

    created(res, shape(fresh));
  } catch (e) {
    next(e);
  }
});

// Owner-only mutations share a small guard.
async function loadOwnedUnlock(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    err(res, 'Invalid id');
    return null;
  }
  const unlock = await TopicUnlock.findById(id);
  if (!unlock) {
    err(res, 'Unlock not found', 404);
    return null;
  }
  if (unlock.ownerId.toString() !== req.user._id.toString()) {
    err(res, 'Forbidden', 403);
    return null;
  }
  return unlock;
}

// ── POST /api/topic-unlocks/:id/approve ───────────────────────────────────
router.post('/:id/approve', auth, async (req, res, next) => {
  try {
    const unlock = await loadOwnedUnlock(req, res);
    if (!unlock) return;
    unlock.status = 'approved';
    unlock.approvedAt = new Date();
    await unlock.save();

    // Notify the viewer — they get cross-topic visibility now.
    emitToUser(unlock.viewerId, 'topic-unlock:approved', shape(unlock));
    // Also tell the owner (other devices / tabs) so the inbox refreshes.
    emitToUser(unlock.ownerId, 'topic-unlock:approved', shape(unlock));
    (async () => {
      try {
        const owner = await User.findById(unlock.ownerId)
          .select('nickname')
          .lean();
        await sendPushToUser(unlock.viewerId, {
          title: 'Meyou',
          body: `${owner?.nickname || 'They'} let you see their other topics`,
          data: { type: 'topic_unlock_approved', unlockId: unlock._id.toString(), ownerId: unlock.ownerId.toString() },
        });
      } catch (_) {}
    })();

    ok(res, shape(unlock));
  } catch (e) {
    next(e);
  }
});

// ── POST /api/topic-unlocks/:id/reject ────────────────────────────────────
router.post('/:id/reject', auth, async (req, res, next) => {
  try {
    const unlock = await loadOwnedUnlock(req, res);
    if (!unlock) return;
    unlock.status = 'rejected';
    unlock.rejectedAt = new Date();
    await unlock.save();
    // No push notification on reject — that would be needlessly bruising.
    // Just an inbox refresh ping for the owner's other devices.
    emitToUser(unlock.ownerId, 'topic-unlock:rejected', shape(unlock));
    ok(res, shape(unlock));
  } catch (e) {
    next(e);
  }
});

// ── POST /api/topic-unlocks/:id/revoke ────────────────────────────────────
// Only valid against a previously-approved row (otherwise pointless).
// Defensive 400 if used on a non-approved row.
router.post('/:id/revoke', auth, async (req, res, next) => {
  try {
    const unlock = await loadOwnedUnlock(req, res);
    if (!unlock) return;
    if (unlock.status !== 'approved') {
      return err(res, 'Only approved unlocks can be revoked', 400);
    }
    unlock.status = 'revoked';
    unlock.revokedAt = new Date();
    await unlock.save();
    // Tell the viewer their access dropped + owner's other devices.
    emitToUser(unlock.viewerId, 'topic-unlock:revoked', shape(unlock));
    emitToUser(unlock.ownerId, 'topic-unlock:revoked', shape(unlock));
    ok(res, shape(unlock));
  } catch (e) {
    next(e);
  }
});

// ── GET /api/topic-unlocks/incoming ───────────────────────────────────────
// Pending requests where I'm the owner. Joined with viewer user.
router.get('/incoming', auth, async (req, res, next) => {
  try {
    const list = await TopicUnlock.find({
      ownerId: req.user._id,
      status: 'pending',
    })
      .sort({ requestedAt: -1 })
      .lean();

    const viewerIds = list.map((u) => u.viewerId);
    const viewers = await User.find(
      { _id: { $in: viewerIds } },
      { nickname: 1, avatarUrl: 1, age: 1 },
    ).lean();
    const map = new Map(viewers.map((u) => [u._id.toString(), u]));

    ok(
      res,
      list.map((u) => ({
        ...shape(u),
        viewer: map.get(u.viewerId.toString()) || null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/topic-unlocks/outgoing ───────────────────────────────────────
// Requests I (the viewer) have sent. Includes pending/rejected/revoked
// so the client can show "request again" affordances on dead rows.
router.get('/outgoing', auth, async (req, res, next) => {
  try {
    const list = await TopicUnlock.find({ viewerId: req.user._id })
      .sort({ requestedAt: -1 })
      .lean();

    const ownerIds = list.map((u) => u.ownerId);
    const owners = await User.find(
      { _id: { $in: ownerIds } },
      { nickname: 1, avatarUrl: 1, age: 1 },
    ).lean();
    const map = new Map(owners.map((u) => [u._id.toString(), u]));

    ok(
      res,
      list.map((u) => ({
        ...shape(u),
        owner: map.get(u.ownerId.toString()) || null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/topic-unlocks/approved ───────────────────────────────────────
// Two-way: viewers I've approved AND owners who've approved me. The
// client splits by ownerId === me.
router.get('/approved', auth, async (req, res, next) => {
  try {
    const list = await TopicUnlock.find({
      status: 'approved',
      $or: [{ ownerId: req.user._id }, { viewerId: req.user._id }],
    })
      .sort({ approvedAt: -1 })
      .lean();

    const otherIds = list.map((u) =>
      u.ownerId.toString() === req.user._id.toString() ? u.viewerId : u.ownerId,
    );
    const others = await User.find(
      { _id: { $in: otherIds } },
      { nickname: 1, avatarUrl: 1, age: 1 },
    ).lean();
    const map = new Map(others.map((u) => [u._id.toString(), u]));

    ok(
      res,
      list.map((u) => {
        const meIsOwner = u.ownerId.toString() === req.user._id.toString();
        return {
          ...shape(u),
          role: meIsOwner ? 'owner' : 'viewer',
          other: map.get(
            meIsOwner ? u.viewerId.toString() : u.ownerId.toString(),
          ) || null,
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

module.exports = router;
