/**
 * Account management routes
 *
 * GET    /api/account/export  → export all user data as JSON
 * DELETE /api/account         → permanently delete account + cascade
 */

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const MomentComment = require('../models/MomentComment');
const Swipe = require('../models/Swipe');
const Follow = require('../models/Follow');
const TopicPersona = require('../models/TopicPersona');
const TopicUnlock = require('../models/TopicUnlock');
const PhotoRequest = require('../models/PhotoRequest');
const PhotoLibrary = require('../models/PhotoLibrary');
const GiftTransaction = require('../models/GiftTransaction');
const Payment = require('../models/Payment');
const RefreshToken = require('../models/RefreshToken');
const r2 = require('../services/r2Service');

// ── GET /api/account/export ───────────────────────────────────────────────────
router.get('/export', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;

    // The user's matches (Match.users is an array of the two participants).
    const myMatches = await Match.find({ users: uid }).lean();
    const matchIds = myMatches.map((m) => m._id);

    const [messages, moments, comments, swipes, follows, gifts, payments] =
      await Promise.all([
        Message.find({ matchId: { $in: matchIds } }).lean(),
        Moment.find({ user: uid }).lean(),
        MomentComment.find({ user: uid }).lean(),
        Swipe.find({ $or: [{ fromUser: uid }, { toUser: uid }] }).lean(),
        Follow.find({ $or: [{ follower: uid }, { following: uid }] }).lean(),
        GiftTransaction.find({ $or: [{ sender: uid }, { receiver: uid }] }).lean(),
        Payment.find({ user: uid }).lean(),
      ]);

    // self=true → include the owner's own email in their data export.
    const profile = req.user.toPublicJSON(undefined, { self: true });

    ok(res, {
      exportedAt: new Date().toISOString(),
      profile,
      matches: myMatches,
      messages,
      moments,
      comments,
      swipes,
      follows,
      gifts,
      payments,
    });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/account ───────────────────────────────────────────────────────
// Apple guideline 5.1.1(v) — users must be able to delete their account
// in-app. Most Meyou users sign in via OTP / Apple / Google and never set a
// password, so we cannot require one here. The JWT itself proves the caller
// controls the account.
//
// Order: (1) gather every photo URL the user owns BEFORE deleting the rows;
// (2) cascade-delete all DB rows referencing the user; (3) best-effort delete
// the photo objects from R2/B2. Returns a summary of what was removed.
router.delete('/', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;

    // ── (1) Collect all photo URLs owned by this user (public + private +
    //         avatar + topic-persona + moment images + chat-image messages +
    //         photo library) so the bytes can be purged from storage too.
    const matchIds = await Match.find({ users: uid }).distinct('_id');
    const [personas, moments, msgs, libRows] = await Promise.all([
      TopicPersona.find({ userId: uid }, { photos: 1 }).lean(),
      Moment.find({ user: uid }, { imageUrls: 1 }).lean(),
      Message.find(
        { senderId: uid, mediaUrl: { $ne: null } },
        { mediaUrl: 1 }
      ).lean(),
      PhotoLibrary.find({ user: uid }, { photoUrl: 1 }).lean(),
    ]);

    const photoUrls = new Set();
    const add = (v) => { if (v) photoUrls.add(v); };
    add(req.user.avatarUrl);
    (req.user.photos || []).forEach(add);
    (req.user.privatePhotos || []).forEach(add);
    personas.forEach((p) => (p.photos || []).forEach(add));
    moments.forEach((m) => (m.imageUrls || []).forEach(add));
    msgs.forEach((m) => add(m.mediaUrl));
    libRows.forEach((l) => add(l.photoUrl));

    // ── (2) Cascade-delete every DB row referencing the user. allSettled so
    //         one failing collection never blocks the rest.
    const dbResults = await Promise.allSettled([
      Message.deleteMany({ matchId: { $in: matchIds } }),
      Message.deleteMany({ senderId: uid }), // belt-and-suspenders
      Match.deleteMany({ users: uid }),
      Moment.deleteMany({ user: uid }),
      MomentComment.deleteMany({ user: uid }),
      Swipe.deleteMany({ $or: [{ fromUser: uid }, { toUser: uid }] }),
      Follow.deleteMany({ $or: [{ follower: uid }, { following: uid }] }),
      TopicPersona.deleteMany({ userId: uid }),
      TopicUnlock.deleteMany({ $or: [{ ownerId: uid }, { viewerId: uid }] }),
      PhotoRequest.deleteMany({ $or: [{ owner: uid }, { requester: uid }] }),
      PhotoLibrary.deleteMany({ user: uid }),
      GiftTransaction.deleteMany({ $or: [{ sender: uid }, { receiver: uid }] }),
      Payment.deleteMany({ user: uid }),
      // Scrub the deleted user out of OTHER users' references.
      User.updateMany({ blockedUsers: uid }, { $pull: { blockedUsers: uid } }),
      Moment.updateMany({ likes: uid }, { $pull: { likes: uid } }),
      // Revoke every session (refresh tokens) for the deleted account.
      RefreshToken.revokeAllForUser(uid),
      // Finally the account row itself.
      User.findByIdAndDelete(uid),
    ]);

    const dbFailed = dbResults.filter((r) => r.status === 'rejected');
    if (dbFailed.length) {
      console.error(
        `[account.delete] ${dbFailed.length} DB cascade step(s) failed for ${uid}:`,
        dbFailed.map((f) => f.reason?.message || f.reason)
      );
    }

    // ── (3) Best-effort purge of photo objects from storage. deleteByUrl
    //         swallows its own errors; we just count outcomes.
    let photosDeleted = 0;
    const urls = [...photoUrls];
    const photoResults = await Promise.allSettled(
      urls.map((u) => r2.deleteByUrl(u))
    );
    photoResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) photosDeleted += 1;
    });

    ok(res, {
      success: true,
      message: 'Account permanently deleted.',
      deleted: {
        photosFound: urls.length,
        photosDeleted,
        dbStepsFailed: dbFailed.length,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
