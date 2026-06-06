const router = require('express').Router();
const mongoose = require('mongoose');
const Note = require('../models/Note');
const NoteBlock = require('../models/NoteBlock');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { isPremiumActive } = require('../utils/premium');
const { notify } = require('../services/notificationService');

const BODY_MAX = 200;
const QUOTA_FREE = 1;
const QUOTA_PREMIUM = 5;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// How many notes the user has already sent today.
async function sentToday(userId) {
  return Note.countDocuments({ senderId: userId, createdAt: { $gte: startOfToday() } });
}

// ── POST /api/notes ───────────────────────────────────────────────────────────
// Send an anonymous note. Daily quota: free=1, premium=5. Rejected if the
// recipient has blocked the sender (anonymously) or the recipient is self.
router.post('/', auth, async (req, res, next) => {
  try {
    const { recipientId } = req.body || {};
    const body = String(req.body?.body ?? '').trim();
    if (!mongoose.isValidObjectId(recipientId)) return err(res, 'Invalid recipient');
    if (recipientId === req.user._id.toString()) return err(res, "Can't send a note to yourself");
    if (!body) return err(res, 'Note is empty');
    if (body.length > BODY_MAX) return err(res, `Note too long (max ${BODY_MAX})`);

    // Block check — recipient may have blocked this (hidden) sender earlier.
    const blocked = await NoteBlock.exists({
      blockerUserId: recipientId,
      blockedUserId: req.user._id,
    });
    if (blocked) return err(res, 'Note could not be delivered', 403);

    const premium = isPremiumActive(req.user);
    const limit = premium ? QUOTA_PREMIUM : QUOTA_FREE;
    const used = await sentToday(req.user._id);
    if (used >= limit) {
      return res.status(429).json({
        error: 'Daily note limit reached',
        code: 'NOTE_QUOTA',
        limit,
        isPremium: premium,
      });
    }

    const note = await Note.create({ senderId: req.user._id, recipientId, body });
    // Anonymous — never reveal the sender in the push.
    notify(recipientId, 'note', {
      title: '你收到一张小纸条 📝',
      body: '有人给你写了一张匿名小纸条',
      data: {},
    }).catch(() => {});
    created(res, {
      _id: note._id,
      createdAt: note.createdAt.toISOString(),
      remaining: Math.max(0, limit - (used + 1)),
      limit,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notes/quota ──────────────────────────────────────────────────────
// Today's remaining send quota — drives the composer counter.
router.get('/quota', auth, async (req, res, next) => {
  try {
    const premium = isPremiumActive(req.user);
    const limit = premium ? QUOTA_PREMIUM : QUOTA_FREE;
    const used = await sentToday(req.user._id);
    ok(res, { used, limit, remaining: Math.max(0, limit - used), isPremium: premium });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notes/unread ─────────────────────────────────────────────────────
// Cheap unread count for the 信息 tab badge.
router.get('/unread', auth, async (req, res, next) => {
  try {
    const count = await Note.countDocuments({
      recipientId: req.user._id,
      deletedByRecipient: false,
      readByRecipient: false,
    });
    ok(res, { count });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notes/inbox ──────────────────────────────────────────────────────
// Notes received. ANONYMOUS — sender identity is never included.
router.get('/inbox', auth, async (req, res, next) => {
  try {
    const notes = await Note.find({
      recipientId: req.user._id,
      deletedByRecipient: false,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unreadCount = notes.filter((n) => !n.readByRecipient).length;
    ok(res, {
      unreadCount,
      notes: notes.map((n) => ({
        _id: n._id,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        replyBody: n.replyBody ?? null,
        repliedAt: n.repliedAt ? n.repliedAt.toISOString() : null,
        read: !!n.readByRecipient,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/notes/sent ───────────────────────────────────────────────────────
// Notes I sent. The sender chose the recipient, so the recipient is identified.
router.get('/sent', auth, async (req, res, next) => {
  try {
    const notes = await Note.find({ senderId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('recipientId', 'nickname avatarUrl')
      .lean();
    ok(res, {
      notes: notes
        .filter((n) => n.recipientId) // populate → null if recipient deleted
        .map((n) => {
          const recipient = {
            _id: n.recipientId._id,
            nickname: n.recipientId.nickname,
            avatarUrl: n.recipientId.avatarUrl ?? null,
          };
          return {
            _id: n._id,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
            replyBody: n.replyBody ?? null,
            repliedAt: n.repliedAt ? n.repliedAt.toISOString() : null,
            recipient,
            // Replying = consent to be identified to the sender. The replier is
            // simply the original recipient; surface it explicitly when a reply
            // exists so the sender's outbox can show who answered. The forward
            // inbox direction stays anonymous (see GET /notes/inbox).
            replier: n.replyBody
              ? { _id: recipient._id, displayName: recipient.nickname, avatarUrl: recipient.avatarUrl }
              : null,
          };
        }),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notes/read ──────────────────────────────────────────────────────
// Mark all my inbox notes read (called when the inbox opens) → clears the badge.
router.post('/read', auth, async (req, res, next) => {
  try {
    await Note.updateMany(
      { recipientId: req.user._id, deletedByRecipient: false, readByRecipient: false },
      { $set: { readByRecipient: true } },
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notes/:id/reply ─────────────────────────────────────────────────
// Recipient replies anonymously, exactly once.
router.post('/:id/reply', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const body = String(req.body?.body ?? '').trim();
    if (!body) return err(res, 'Reply is empty');
    if (body.length > BODY_MAX) return err(res, `Reply too long (max ${BODY_MAX})`);

    const note = await Note.findOne({ _id: req.params.id, recipientId: req.user._id });
    if (!note || note.deletedByRecipient) return err(res, 'Note not found', 404);
    if (note.replyBody) return err(res, 'Already replied');

    note.replyBody = body;
    note.repliedAt = new Date();
    note.readByRecipient = true;
    await note.save();
    ok(res, { _id: note._id, replyBody: note.replyBody, repliedAt: note.repliedAt.toISOString() });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/notes/:id ─────────────────────────────────────────────────────
// Recipient soft-deletes a note from their inbox.
router.delete('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { $set: { deletedByRecipient: true } },
    );
    if (!note) return err(res, 'Note not found', 404);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/notes/:id/block ─────────────────────────────────────────────────
// Recipient blocks the hidden sender + soft-deletes the note. Identity is never
// revealed to the recipient — the block is by id only, server-side.
router.post('/:id/block', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return err(res, 'Invalid id');
    const note = await Note.findOne({ _id: req.params.id, recipientId: req.user._id });
    if (!note) return err(res, 'Note not found', 404);

    await NoteBlock.updateOne(
      { blockerUserId: req.user._id, blockedUserId: note.senderId },
      { $setOnInsert: { blockerUserId: req.user._id, blockedUserId: note.senderId } },
      { upsert: true },
    );
    note.blocked = true;
    note.deletedByRecipient = true;
    await note.save();
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
