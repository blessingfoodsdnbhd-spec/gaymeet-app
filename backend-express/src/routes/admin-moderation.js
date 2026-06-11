// Admin moderation tools (ADMIN1). Account bans (permanent + granular chat /
// photo-upload), content deletion (photos / moments / vote entries) and the
// audit-log feed. Every state-changing action is recorded to AdminAction and
// the affected user is notified via the existing notification system.
//
// Auth: requireAdminAuth — X-Admin-Token header OR a Bearer JWT whose account
// is official / in ADMIN_EMAILS. See middleware/adminAuth.js.
const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Moment = require('../models/Moment');
const VoteEntry = require('../models/VoteEntry');
const VoteEvent = require('../models/VoteEvent');
const Vote = require('../models/Vote');
const AdminAction = require('../models/AdminAction');
const r2 = require('../services/r2Service');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { logAdminAction } = require('../services/adminAudit');
const { notify } = require('../services/notificationService');
const { ok, err } = require('../utils/respond');

router.use(requireAdminAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const reasonOf = (req) => String(req.body?.reason || '').slice(0, 500);

// Best-effort blob cleanup for a removed photo URL (R2 key or disk filename).
function deletePhotoBlob(url) {
  try {
    const key = r2.keyFromUrl(url);
    if (key) r2.deleteFile(key).catch(() => {});
  } catch (_) {}
}

// ── GET /api/admin/users/:id — full moderation view ───────────────────────────
// Returns the target's moderation status + content lists (photos, recent
// moments, vote entries) so the admin UI can render delete affordances.
router.get('/users/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return err(res, 'Invalid user id');
    const user = await User.findById(req.params.id).lean();
    if (!user) return err(res, 'User not found', 404);

    const [moments, entries] = await Promise.all([
      Moment.find({ user: user._id, isActive: true })
        .select('content images createdAt visibility')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      VoteEntry.find({ submitterId: user._id })
        .populate('eventId', 'title')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    ok(res, {
      user: {
        id: String(user._id),
        nickname: user.nickname,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        photos: user.photos || [],
        privatePhotos: user.privatePhotos || [],
        isVerified: !!user.isVerified,
        isOfficial: !!user.isOfficial,
        createdAt: user.createdAt,
        // Moderation state
        isBanned: !!user.isBanned,
        bannedAt: user.bannedAt || null,
        banReason: user.banReason || null,
        chatBanned: !!user.chatBanned,
        photoUploadBanned: !!user.photoUploadBanned,
      },
      moments: moments.map((m) => ({
        id: String(m._id),
        content: m.content || '',
        images: m.images || [],
        visibility: m.visibility,
        createdAt: m.createdAt,
      })),
      voteEntries: entries.map((e) => ({
        id: String(e._id),
        eventId: e.eventId ? String(e.eventId._id) : null,
        eventTitle: e.eventId?.title || '—',
        photoUrl: e.photoUrl,
        caption: e.caption || '',
        voteCount: e.voteCount || 0,
        createdAt: e.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ── Helper: load target user or 404 ───────────────────────────────────────────
async function loadTarget(req, res) {
  if (!isId(req.params.id)) {
    err(res, 'Invalid user id');
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    err(res, 'User not found', 404);
    return null;
  }
  return user;
}

// ── POST /api/admin/users/:id/ban — permanent ban (登录拦截) ───────────────────
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await loadTarget(req, res);
    if (!user) return;
    const reason = reasonOf(req);
    user.isBanned = true;
    user.bannedAt = new Date();
    user.banReason = reason || null;
    user.bannedBy = req.user?._id || null;
    await user.save();

    await logAdminAction(req.user, 'ban', {
      targetUser: user._id, targetType: 'user', targetId: user._id, reason,
    });
    notify(user._id, 'account_banned', {
      title: '账号已被封禁',
      body: reason ? `原因：${reason}` : '你的账号已被管理员封禁。',
      data: { type: 'account_banned' },
    });
    ok(res, { id: String(user._id), isBanned: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/users/:id/unban ───────────────────────────────────────────
router.post('/users/:id/unban', async (req, res, next) => {
  try {
    const user = await loadTarget(req, res);
    if (!user) return;
    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = null;
    user.bannedBy = null;
    await user.save();

    await logAdminAction(req.user, 'unban', {
      targetUser: user._id, targetType: 'user', targetId: user._id, reason: reasonOf(req),
    });
    notify(user._id, 'account_unbanned', {
      title: '账号封禁已解除',
      body: '你的账号已恢复正常。',
      data: { type: 'account_unbanned' },
    });
    ok(res, { id: String(user._id), isBanned: false });
  } catch (e) {
    next(e);
  }
});

// ── Capability bans: chat-send + photo-upload ─────────────────────────────────
// Each is a thin toggle pair so the client has explicit, idempotent endpoints.
function capabilityRoute(path, field, action, notif) {
  router.post(`/users/:id/${path}`, async (req, res, next) => {
    try {
      const user = await loadTarget(req, res);
      if (!user) return;
      const reason = reasonOf(req);
      user[field] = action.endsWith('_unban') ? false : true;
      await user.save();
      await logAdminAction(req.user, action, {
        targetUser: user._id, targetType: 'user', targetId: user._id, reason,
      });
      notify(user._id, notif.type, {
        title: notif.title,
        body: reason && !action.endsWith('_unban') ? `${notif.body}（原因：${reason}）` : notif.body,
        data: { type: notif.type },
      });
      ok(res, { id: String(user._id), [field]: user[field] });
    } catch (e) {
      next(e);
    }
  });
}
capabilityRoute('chat-ban', 'chatBanned', 'chat_ban', {
  type: 'chat_banned', title: '聊天功能受限', body: '你已被禁止发送消息，但仍可查看消息。',
});
capabilityRoute('chat-unban', 'chatBanned', 'chat_unban', {
  type: 'chat_unbanned', title: '聊天功能已恢复', body: '你现在可以重新发送消息了。',
});
capabilityRoute('photo-ban', 'photoUploadBanned', 'photo_ban', {
  type: 'photo_banned', title: '照片上传受限', body: '你已被禁止上传照片。',
});
capabilityRoute('photo-unban', 'photoUploadBanned', 'photo_unban', {
  type: 'photo_unbanned', title: '照片上传已恢复', body: '你现在可以重新上传照片了。',
});

// ── DELETE /api/admin/users/:id/photos — remove a photo ───────────────────────
// Body: { url, kind: 'public' | 'private' | 'avatar' }. The removed URL is
// preserved in the audit log (this is the "soft delete" record); the blob is
// best-effort purged from storage.
router.delete('/users/:id/photos', async (req, res, next) => {
  try {
    const user = await loadTarget(req, res);
    if (!user) return;
    const url = String(req.body?.url || '').trim();
    const kind = req.body?.kind || 'public';
    if (!url) return err(res, 'url required');

    if (kind === 'private') {
      const before = user.privatePhotos.length;
      user.privatePhotos = user.privatePhotos.filter((p) => p !== url);
      if (user.privatePhotos.length === before) return err(res, 'Photo not found', 404);
    } else {
      // public or avatar: both live in user.photos (photos[0] is the avatar)
      const before = user.photos.length;
      user.photos = user.photos.filter((p) => p !== url);
      if (user.photos.length === before && user.avatarUrl !== url) {
        return err(res, 'Photo not found', 404);
      }
      if (user.avatarUrl === url) user.avatarUrl = user.photos[0] || null;
    }
    await user.save();
    deletePhotoBlob(url);

    await logAdminAction(req.user, 'delete_photo', {
      targetUser: user._id, targetType: 'photo', targetId: url,
      reason: reasonOf(req), meta: { kind },
    });
    ok(res, { photos: user.photos, privatePhotos: user.privatePhotos, avatarUrl: user.avatarUrl });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/moments/:momentId — soft-delete a moment/post ───────────
router.delete('/moments/:momentId', async (req, res, next) => {
  try {
    if (!isId(req.params.momentId)) return err(res, 'Invalid id');
    const moment = await Moment.findById(req.params.momentId);
    if (!moment) return err(res, 'Moment not found', 404);
    moment.isActive = false;
    await moment.save();

    await logAdminAction(req.user, 'delete_moment', {
      targetUser: moment.user, targetType: 'moment', targetId: moment._id, reason: reasonOf(req),
    });
    ok(res, { id: String(moment._id), deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/vote-entries/:entryId — remove a user's vote entry ──────
// Hard-deletes the entry and its cast votes, and fixes the event counters
// (mirrors the admin path in routes/votes.js). The audit log is the record.
router.delete('/vote-entries/:entryId', async (req, res, next) => {
  try {
    if (!isId(req.params.entryId)) return err(res, 'Invalid id');
    const entry = await VoteEntry.findById(req.params.entryId);
    if (!entry) return err(res, 'Vote entry not found', 404);

    const votes = await Vote.deleteMany({ entryId: entry._id });
    await VoteEntry.deleteOne({ _id: entry._id });
    await VoteEvent.updateOne(
      { _id: entry.eventId },
      { $inc: { entryCount: -1, voteCount: -(votes.deletedCount || 0) } },
    );

    await logAdminAction(req.user, 'delete_vote_entry', {
      targetUser: entry.submitterId, targetType: 'vote_entry', targetId: entry._id,
      reason: reasonOf(req), meta: { eventId: String(entry.eventId) },
    });
    ok(res, { id: String(entry._id), deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/audit-log — recent admin actions, newest first ─────────────
// Query: ?targetUser=<id>&limit=<n> (default 100, max 200).
router.get('/audit-log', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.targetUser && isId(req.query.targetUser)) q.targetUser = req.query.targetUser;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const rows = await AdminAction.find(q)
      .populate('admin', 'nickname')
      .populate('targetUser', 'nickname')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    ok(res, {
      actions: rows.map((r) => ({
        id: String(r._id),
        action: r.action,
        admin: r.admin?.nickname || r.adminEmail || '—',
        targetUser: r.targetUser?.nickname || null,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason || '',
        meta: r.meta || {},
        createdAt: r.createdAt,
      })),
      count: rows.length,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
