// Meyou 密友 — Hidden Photos (隐藏照片) + Request-to-view (申请查看).
//
// Mounted at BOTH prefixes (see app.js):
//   /api/hidden-photos/*        — cross-user request / respond / view
//   /api/me/hidden-photos/*     — owner self-management (toggle / grant / …)
//
// Endpoints
//   POST  /api/hidden-photos/request/:targetUserId  — I ask to view theirs
//   POST  /api/hidden-photos/respond/:requestId     — owner approve|reject
//   GET   /api/hidden-photos/:userId                — fetch (if granted)
//   POST  /api/me/hidden-photos/toggle              — flag a photo hidden|public
//   POST  /api/me/hidden-photos/grant/:userId       — proactively open to someone
//   POST  /api/me/hidden-photos/revoke/:userId      — revoke someone's access
//   GET   /api/me/hidden-photos/grants              — who I've granted
//   GET   /api/me/hidden-photos/requests            — who requested mine (?status=)
//
// Hidden photos are a subset of the owner's OWN profile photos (a toggle moves a
// URL between User.photos and User.hiddenPhotos). Approval writes a PERSISTENT
// grant (User.hiddenPhotoGrants) — unlike private-photos' view-once model.
const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const HiddenPhotoRequest = require('../models/HiddenPhotoRequest');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const { notify } = require('../services/notificationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_DAY = 10; // spam guard: distinct people per rolling 24h

// ── helpers ──────────────────────────────────────────────────────────────────

function isBlockedEitherWay(me, other) {
  const meBlockedOther = (me.blockedUsers || []).some((id) => id.toString() === other._id.toString());
  const otherBlockedMe = (other.blockedUsers || []).some((id) => id.toString() === me._id.toString());
  return meBlockedOther || otherBlockedMe;
}

function hasGrant(owner, viewerId) {
  return (owner.hiddenPhotoGrants || []).some((g) => g.toUserId.toString() === viewerId.toString());
}

// Slim requester/owner card for inbox / grant lists + notification payloads.
const USER_CARD = 'nickname avatarUrl level isOnline isOfficial isVerified isPremium';

function shapeRequest(reqDoc) {
  return {
    id: reqDoc._id.toString(),
    fromUser: reqDoc.fromUserId, // populated
    toUserId: reqDoc.toUserId?.toString?.() ?? String(reqDoc.toUserId),
    status: reqDoc.status,
    createdAt: reqDoc.createdAt,
    respondedAt: reqDoc.respondedAt,
  };
}

// ── GET /me/hidden-photos/grants — who I've opened my hidden photos to ────────
router.get('/grants', auth, async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).select('hiddenPhotoGrants');
    const grants = me.hiddenPhotoGrants || [];
    const ids = grants.map((g) => g.toUserId);
    const users = await User.find({ _id: { $in: ids } }).select(USER_CARD).lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    // Newest grant first; drop grants whose user was deleted.
    const out = grants
      .filter((g) => byId.has(g.toUserId.toString()))
      .sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt))
      .map((g) => ({
        user: byId.get(g.toUserId.toString()),
        grantedAt: g.grantedAt,
        source: g.source,
      }));
    ok(res, { count: out.length, grants: out });
  } catch (e) {
    next(e);
  }
});

// ── GET /me/hidden-photos/requests — who asked to see mine (?status=pending) ──
router.get('/requests', auth, async (req, res, next) => {
  try {
    const q = { toUserId: req.user._id };
    const status = req.query.status;
    if (status && ['pending', 'approved', 'rejected'].includes(status)) q.status = status;
    const requests = await HiddenPhotoRequest.find(q)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('fromUserId', USER_CARD);
    // Drop rows whose requester was deleted (populate → null).
    const out = requests.filter((r) => r.fromUserId).map(shapeRequest);
    ok(res, { requests: out });
  } catch (e) {
    next(e);
  }
});

// ── POST /me/hidden-photos/toggle — flag one photo hidden or public ──────────
// Body: { photoUrl, hidden: true|false }. Moves the URL between User.photos and
// User.hiddenPhotos. Idempotent.
router.post('/toggle', auth, async (req, res, next) => {
  try {
    const { photoUrl, hidden } = req.body || {};
    if (!photoUrl || typeof photoUrl !== 'string') return err(res, 'photoUrl required');
    if (typeof hidden !== 'boolean') return err(res, 'hidden must be a boolean');

    const user = await User.findById(req.user._id);
    user.photos = user.photos || [];
    user.hiddenPhotos = user.hiddenPhotos || [];

    // The URL must be one of the user's own photos (public or already hidden).
    const inPublic = user.photos.includes(photoUrl);
    const inHidden = user.hiddenPhotos.includes(photoUrl);
    if (!inPublic && !inHidden) return err(res, 'Photo not found on your profile', 404);

    if (hidden) {
      // public → hidden
      if (inPublic) {
        user.photos = user.photos.filter((p) => p !== photoUrl);
        if (!inHidden) user.hiddenPhotos.push(photoUrl);
      }
    } else {
      // hidden → public
      if (inHidden) {
        user.hiddenPhotos = user.hiddenPhotos.filter((p) => p !== photoUrl);
        if (!user.photos.includes(photoUrl)) user.photos.push(photoUrl);
      }
    }
    await user.save();

    ok(res, {
      photos: user.photos,
      hiddenPhotos: user.hiddenPhotos,
      hiddenPhotosCount: user.hiddenPhotos.length,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /me/hidden-photos/grant/:userId — proactively open to someone ───────
router.post('/grant/:userId', auth, async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.isValidObjectId(targetId)) return err(res, 'Invalid userId');
    if (targetId === req.user._id.toString()) return err(res, "Can't grant to yourself");

    const target = await User.findById(targetId).select('_id blockedUsers');
    if (!target) return err(res, 'User not found', 404);
    if (isBlockedEitherWay(req.user, target)) return err(res, 'Cannot grant to this user', 403);

    const me = await User.findById(req.user._id);
    if (!hasGrant(me, targetId)) {
      me.hiddenPhotoGrants.push({ toUserId: targetId, grantedAt: new Date(), source: 'manual' });
      await me.save();
      // Let them know they can now see the photos.
      notify(targetId, 'hidden_photo_approved', {
        body: `${me.nickname || 'Someone'} opened their hidden photos to you`,
        data: {
          ownerId: me._id.toString(),
          fromUserName: me.nickname || '',
          fromUserAvatarUrl: me.avatarUrl || '',
        },
        i18n: {
          en: { title: 'Hidden photos unlocked', body: `${me.nickname || 'Someone'} opened their hidden photos to you` },
          zh: { title: '隐藏照片已开放', body: `${me.nickname || '有人'} 向你开放了隐藏照片` },
          ko: { title: '숨긴 사진이 공개되었습니다', body: `${me.nickname || '누군가'}님이 숨긴 사진을 공개했습니다` },
          ja: { title: '非公開写真が公開されました', body: `${me.nickname || '誰か'}があなたに非公開写真を公開しました` },
        },
      }).catch(() => {});
    }
    ok(res, { granted: true, count: me.hiddenPhotoGrants.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /me/hidden-photos/revoke/:userId — revoke someone's access ──────────
router.post('/revoke/:userId', auth, async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.isValidObjectId(targetId)) return err(res, 'Invalid userId');

    const me = await User.findById(req.user._id);
    const before = (me.hiddenPhotoGrants || []).length;
    me.hiddenPhotoGrants = (me.hiddenPhotoGrants || []).filter(
      (g) => g.toUserId.toString() !== targetId,
    );
    const revoked = before - me.hiddenPhotoGrants.length;
    if (revoked > 0) await me.save();
    ok(res, { revoked: revoked > 0, count: me.hiddenPhotoGrants.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /hidden-photos/request/:targetUserId — ask to view someone's ────────
router.post('/request/:targetUserId', auth, async (req, res, next) => {
  try {
    const targetId = req.params.targetUserId;
    if (!mongoose.isValidObjectId(targetId)) return err(res, 'Invalid userId');
    if (targetId === req.user._id.toString()) return err(res, "Can't request your own photos");

    const owner = await User.findById(targetId).select(
      '_id nickname avatarUrl blockedUsers hiddenPhotos hiddenPhotoGrants',
    );
    if (!owner) return err(res, 'User not found', 404);
    if (isBlockedEitherWay(req.user, owner)) return err(res, 'Cannot request from this user', 403);
    if ((owner.hiddenPhotos || []).length === 0) return err(res, 'This user has no hidden photos', 400);

    // Already granted (via a prior request, or the owner opened proactively).
    if (hasGrant(owner, req.user._id)) {
      return ok(res, { status: 'approved', alreadyGranted: true });
    }

    // Existing pending request → idempotent.
    const pending = await HiddenPhotoRequest.findOne({
      fromUserId: req.user._id,
      toUserId: targetId,
      status: 'pending',
    });
    if (pending) return ok(res, { status: 'already_pending', requestId: pending._id.toString() });

    // Rate limit 1/day for the SAME person (any request in the last 24h blocks).
    const recentSame = await HiddenPhotoRequest.findOne({
      fromUserId: req.user._id,
      toUserId: targetId,
      createdAt: { $gte: new Date(Date.now() - DAY_MS) },
    });
    if (recentSame) return err(res, 'You already requested this person today', 429);

    // Spam guard: ≤10 DISTINCT people per rolling 24h.
    const since = new Date(Date.now() - DAY_MS);
    const distinct = await HiddenPhotoRequest.distinct('toUserId', {
      fromUserId: req.user._id,
      createdAt: { $gte: since },
    });
    if (distinct.length >= MAX_REQUESTS_PER_DAY) {
      return err(res, 'Daily request limit reached, try again tomorrow', 429);
    }

    const request = await HiddenPhotoRequest.create({
      fromUserId: req.user._id,
      toUserId: targetId,
    });

    // Persisted notification + push to the owner.
    notify(targetId, 'hidden_photo_request', {
      body: `${req.user.nickname || 'Someone'} wants to see your hidden photos`,
      data: {
        requestId: request._id.toString(),
        fromUserId: req.user._id.toString(),
        fromUserName: req.user.nickname || '',
        fromUserAvatarUrl: req.user.avatarUrl || '',
      },
      i18n: {
        en: { title: 'Hidden photo request', body: `${req.user.nickname || 'Someone'} wants to see your hidden photos` },
        zh: { title: '隐藏照片申请', body: `${req.user.nickname || '有人'} 申请查看你的隐藏照片` },
        ko: { title: '숨긴 사진 요청', body: `${req.user.nickname || '누군가'}님이 회원님의 숨긴 사진을 보고 싶어합니다` },
        ja: { title: '非公開写真のリクエスト', body: `${req.user.nickname || '誰か'}があなたの非公開写真を見たがっています` },
      },
    }).catch(() => {});

    created(res, { status: 'pending', requestId: request._id.toString() });
  } catch (e) {
    // Unique-index race (two concurrent requests) → treat as already pending.
    if (e && e.code === 11000) return ok(res, { status: 'already_pending' });
    next(e);
  }
});

// ── POST /hidden-photos/respond/:requestId — owner approve|reject ────────────
router.post('/respond/:requestId', auth, async (req, res, next) => {
  try {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return err(res, "action must be 'approve' or 'reject'");
    }
    const request = await HiddenPhotoRequest.findOne({
      _id: req.params.requestId,
      toUserId: req.user._id,
      status: 'pending',
    });
    if (!request) return err(res, 'Request not found', 404);

    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.respondedAt = new Date();
    await request.save();

    if (action === 'approve') {
      const me = await User.findById(req.user._id);
      if (!hasGrant(me, request.fromUserId)) {
        me.hiddenPhotoGrants.push({
          toUserId: request.fromUserId,
          grantedAt: new Date(),
          source: 'request',
        });
        await me.save();
      }
      // Notify the requester (gentle). Rejection is silent by default.
      notify(request.fromUserId, 'hidden_photo_approved', {
        body: `${me.nickname || 'Someone'} approved your hidden photo request`,
        data: {
          ownerId: me._id.toString(),
          fromUserName: me.nickname || '',
          fromUserAvatarUrl: me.avatarUrl || '',
        },
        i18n: {
          en: { title: 'Hidden photos unlocked', body: `${me.nickname || 'Someone'} approved your hidden photo request` },
          zh: { title: '隐藏照片已同意', body: `${me.nickname || '有人'} 同意了你的隐藏照片申请` },
          ko: { title: '숨긴 사진이 공개되었습니다', body: `${me.nickname || '누군가'}님이 회원님의 요청을 승인했습니다` },
          ja: { title: '非公開写真が公開されました', body: `${me.nickname || '誰か'}があなたのリクエストを承認しました` },
        },
      }).catch(() => {});
    }

    ok(res, { status: request.status, requestId: request._id.toString() });
  } catch (e) {
    next(e);
  }
});

// ── GET /hidden-photos/:userId — fetch hidden photos (if granted) ────────────
// Owner → own photos. Granted viewer → the URLs. Otherwise → count + granted:false
// (and the requester's current request status so the client shows the right CTA).
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const ownerId = req.params.userId;
    if (!mongoose.isValidObjectId(ownerId)) return err(res, 'Invalid userId');

    const owner = await User.findById(ownerId).select('hiddenPhotos hiddenPhotoGrants');
    if (!owner) return err(res, 'User not found', 404);

    const isOwner = ownerId === req.user._id.toString();
    if (isOwner) {
      return ok(res, {
        granted: true,
        owner: true,
        count: (owner.hiddenPhotos || []).length,
        photos: owner.hiddenPhotos || [],
      });
    }

    if (hasGrant(owner, req.user._id)) {
      return ok(res, {
        granted: true,
        count: (owner.hiddenPhotos || []).length,
        photos: owner.hiddenPhotos || [],
      });
    }

    // Not granted — surface the requester's latest request status for the CTA.
    const latest = await HiddenPhotoRequest.findOne({
      fromUserId: req.user._id,
      toUserId: ownerId,
    }).sort({ createdAt: -1 });
    ok(res, {
      granted: false,
      count: (owner.hiddenPhotos || []).length,
      photos: [],
      requestStatus: latest ? latest.status : 'none',
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
