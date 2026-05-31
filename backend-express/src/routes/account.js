/**
 * Account management routes
 *
 * GET    /api/account/export  → export all user data as JSON
 * DELETE /api/account         → permanently delete account
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
const GiftTransaction = require('../models/GiftTransaction');
const Payment = require('../models/Payment');

// ── GET /api/account/export ───────────────────────────────────────────────────
router.get('/export', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;

    // The user's matches (Match.users is an array of the two participants).
    const myMatches = await Match.find({ users: uid }).lean();
    const matchIds = myMatches.map((m) => m._id);

    const [messages, moments, comments, swipes, follows, gifts, payments] =
      await Promise.all([
        // Every message in any conversation the user took part in.
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
// in-app. Most Meyou users sign in via OTP / Apple / Google and never set
// a password, so we cannot require one here. The JWT itself proves the
// caller controls the account.
router.delete('/', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;

    // Resolve the user's match IDs first so we can purge BOTH sides of every
    // conversation (messages are keyed by matchId, not just the sender).
    const matchIds = await Match.find({ users: uid }).distinct('_id');

    // Remove all data that belongs to (or references) this user. Run in
    // parallel; allSettled so one failing collection never blocks the rest.
    const results = await Promise.allSettled([
      // Conversations + every message in them (both directions).
      Message.deleteMany({ matchId: { $in: matchIds } }),
      Message.deleteMany({ senderId: uid }), // belt-and-suspenders
      Match.deleteMany({ users: uid }),
      // Content the user authored.
      Moment.deleteMany({ user: uid }),
      MomentComment.deleteMany({ user: uid }),
      // Interaction graph.
      Swipe.deleteMany({ $or: [{ fromUser: uid }, { toUser: uid }] }),
      Follow.deleteMany({ $or: [{ follower: uid }, { following: uid }] }),
      // Topic personas + cross-topic unlock grants on either side.
      TopicPersona.deleteMany({ userId: uid }),
      TopicUnlock.deleteMany({ $or: [{ ownerId: uid }, { viewerId: uid }] }),
      // Private-photo access requests on either side.
      PhotoRequest.deleteMany({ $or: [{ owner: uid }, { requester: uid }] }),
      // Gifts + payments referencing the user.
      GiftTransaction.deleteMany({ $or: [{ sender: uid }, { receiver: uid }] }),
      Payment.deleteMany({ user: uid }),
      // Scrub the deleted user out of OTHER users' references so we don't
      // leave dangling ObjectIds behind.
      User.updateMany({ blockedUsers: uid }, { $pull: { blockedUsers: uid } }),
      Moment.updateMany({ likes: uid }, { $pull: { likes: uid } }),
      // Finally remove the account itself.
      User.findByIdAndDelete(uid),
    ]);

    // Surface any partial failures in logs without failing the request — the
    // user has the right to delete and a stuck collection shouldn't block it.
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.error(
        `[account.delete] ${failed.length} cascade step(s) failed for ${uid}:`,
        failed.map((f) => f.reason?.message || f.reason)
      );
    }

    ok(res, { success: true, message: 'Account permanently deleted.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
