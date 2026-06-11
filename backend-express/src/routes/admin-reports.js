// Admin reports dashboard (REPORT1). Lists unresolved reports across content
// types and lets an admin mark them resolved. Gated by requireAdminAuth
// (X-Admin-Token header OR a Bearer JWT whose email is in ADMIN_EMAILS).
const router = require('express').Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { ok, err } = require('../utils/respond');
const WorldChatReport = require('../models/WorldChatReport');
const VoteReport = require('../models/VoteReport');
const UserReport = require('../models/UserReport');
const Message = require('../models/Message');
const FlaggedImage = require('../models/FlaggedImage');
const WorldChatMessage = require('../models/WorldChatMessage');
const WorldChatBan = require('../models/WorldChatBan');
const VoteEntry = require('../models/VoteEntry');
const VoteEvent = require('../models/VoteEvent');

router.use(requireAdminAuth);

// Auto-hidden moderation queue (anti-spam Phase 1, defense #4). Maps the
// admin-facing `kind` to its content model + the field holding the author id,
// so one set of handlers serves all three content types.
const AUTO_HIDE_KINDS = {
  worldChat: { Model: WorldChatMessage, authorField: 'userId' },
  voteEntry: { Model: VoteEntry, authorField: 'submitterId' },
  voteEvent: { Model: VoteEvent, authorField: 'creatorId' },
};

// ── GET /api/admin/reports — all unresolved reports, newest first ─────────────
router.get('/reports', async (_req, res, next) => {
  try {
    const [chat, vote, user, scam, images] = await Promise.all([
      WorldChatReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('reportedUserId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      VoteReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      // User-profile reports (filed via POST /api/users/:id/report). Each also
      // auto-blocked the target; surfacing them lets admins review/ban.
      UserReport.find({ handled: false })
        .populate('reporterId', 'nickname')
        .populate('reportedUserId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      // Soft-flagged scam/phishing DMs awaiting review (item 11).
      Message.find({ flagged: true, flagHandled: false })
        .populate('senderId', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      // NSFW-heuristic flagged images awaiting review (item 10).
      FlaggedImage.find({ handled: false })
        .populate('user', 'nickname')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const reports = [
      ...chat.map((r) => ({
        id: String(r._id),
        kind: 'worldChat',
        reason: r.reason || r.body || '',
        reporter: r.reporterId?.nickname || '—',
        target: r.reportedUserId?.nickname || '(message)',
        createdAt: r.createdAt,
      })),
      ...vote.map((r) => ({
        id: String(r._id),
        kind: 'vote',
        reason: r.reason || '',
        reporter: r.reporterId?.nickname || '—',
        target: r.targetType === 'entry' ? '(entry)' : '(event)',
        createdAt: r.createdAt,
      })),
      ...user.map((r) => ({
        id: String(r._id),
        kind: 'user',
        reason: `[${r.reason}${r.context && r.context !== 'profile' ? ` · ${r.context}` : ''}]${r.note ? ` ${r.note}` : ''}`,
        reporter: r.reporterId?.nickname || '—',
        target: r.reportedUserId?.nickname || '(user)',
        createdAt: r.createdAt,
      })),
      ...scam.map((m) => ({
        id: String(m._id),
        kind: 'scamMessage',
        reason: `[${m.flagReason || 'flagged'}] ${(m.content || '').slice(0, 120)}`,
        reporter: '(auto)',
        target: m.senderId?.nickname || '(user)',
        createdAt: m.createdAt,
      })),
      ...images.map((im) => ({
        id: String(im._id),
        kind: 'nsfwImage',
        reason: `skin ${Math.round((im.score || 0) * 100)}% — ${im.url}`,
        reporter: '(auto)',
        target: im.user?.nickname || '(user)',
        createdAt: im.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    ok(res, { reports, count: reports.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/reports/:kind/:id/resolve — mark handled ──────────────────
router.post('/reports/:kind/:id/resolve', async (req, res, next) => {
  try {
    if (req.params.kind === 'scamMessage') {
      const m = await Message.findByIdAndUpdate(
        req.params.id,
        { flagHandled: true, flagged: false },
        { new: true },
      );
      if (!m) return err(res, 'Message not found', 404);
      return ok(res, { success: true });
    }
    if (req.params.kind === 'nsfwImage') {
      const im = await FlaggedImage.findByIdAndUpdate(req.params.id, { handled: true }, { new: true });
      if (!im) return err(res, 'Image not found', 404);
      return ok(res, { success: true });
    }
    const Model =
      req.params.kind === 'vote'
        ? VoteReport
        : req.params.kind === 'user'
        ? UserReport
        : WorldChatReport;
    const r = await Model.findByIdAndUpdate(req.params.id, { handled: true }, { new: true });
    if (!r) return err(res, 'Report not found', 404);
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/auto-hidden — content auto-hidden by report threshold ──────
router.get('/auto-hidden', async (_req, res, next) => {
  try {
    const [msgs, entries, events] = await Promise.all([
      WorldChatMessage.find({ moderationStatus: 'auto_hidden' })
        .populate('userId', 'nickname')
        .sort({ autoHiddenAt: -1 })
        .limit(200)
        .lean(),
      VoteEntry.find({ moderationStatus: 'auto_hidden' })
        .populate('submitterId', 'nickname')
        .sort({ autoHiddenAt: -1 })
        .limit(200)
        .lean(),
      VoteEvent.find({ moderationStatus: 'auto_hidden' })
        .populate('creatorId', 'nickname')
        .sort({ autoHiddenAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const items = [
      ...msgs.map((m) => ({
        kind: 'worldChat',
        id: String(m._id),
        author: m.userId?.nickname || '—',
        authorId: m.userId?._id ? String(m.userId._id) : null,
        content: m.type === 'photo' ? `[photo] ${m.caption || ''}` : m.type === 'voice' ? '[voice]' : m.body || '',
        reason: m.autoHiddenReason || '',
        autoHiddenAt: m.autoHiddenAt,
      })),
      ...entries.map((e) => ({
        kind: 'voteEntry',
        id: String(e._id),
        author: e.submitterId?.nickname || '—',
        authorId: e.submitterId?._id ? String(e.submitterId._id) : null,
        content: `[entry] ${e.caption || e.photoUrl || ''}`,
        reason: e.autoHiddenReason || '',
        autoHiddenAt: e.autoHiddenAt,
      })),
      ...events.map((ev) => ({
        kind: 'voteEvent',
        id: String(ev._id),
        author: ev.creatorId?.nickname || '—',
        authorId: ev.creatorId?._id ? String(ev.creatorId._id) : null,
        content: `[contest] ${ev.title || ''}`,
        reason: ev.autoHiddenReason || '',
        autoHiddenAt: ev.autoHiddenAt,
      })),
    ].sort((a, b) => new Date(b.autoHiddenAt || 0) - new Date(a.autoHiddenAt || 0));

    ok(res, { items, count: items.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/auto-hidden/:kind/:id/restore — false positive ────────────
router.post('/auto-hidden/:kind/:id/restore', async (req, res, next) => {
  try {
    const spec = AUTO_HIDE_KINDS[req.params.kind];
    if (!spec) return err(res, 'Unknown kind', 400);
    const doc = await spec.Model.findByIdAndUpdate(
      req.params.id,
      { $set: { hidden: false, moderationStatus: 'restored', autoHiddenAt: null, autoHiddenReason: null } },
      { new: true },
    );
    if (!doc) return err(res, 'Not found', 404);
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/auto-hidden/:kind/:id/confirm — keep hidden ───────────────
// Body: { escalate?: boolean } — escalate additionally bans the author from
// World Chat (the only suspension primitive that exists today). For other
// kinds the author id is returned so an admin can act via existing tools.
router.post('/auto-hidden/:kind/:id/confirm', async (req, res, next) => {
  try {
    const spec = AUTO_HIDE_KINDS[req.params.kind];
    if (!spec) return err(res, 'Unknown kind', 400);
    const doc = await spec.Model.findByIdAndUpdate(
      req.params.id,
      { $set: { hidden: true, moderationStatus: 'confirmed' } },
      { new: true },
    );
    if (!doc) return err(res, 'Not found', 404);

    const authorId = doc[spec.authorField] || null;
    let escalated = false;
    if (req.body?.escalate && authorId) {
      // World Chat ban is the only suspension primitive in the codebase today.
      await WorldChatBan.updateOne(
        { userId: authorId },
        { $setOnInsert: { userId: authorId, reason: 'auto-hide escalated' } },
        { upsert: true },
      ).catch(() => {});
      escalated = true;
    }
    ok(res, { success: true, authorId: authorId ? String(authorId) : null, escalated });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
