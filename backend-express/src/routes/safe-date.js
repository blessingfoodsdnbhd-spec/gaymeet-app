const router = require('express').Router();
const SafeDate = require('../models/SafeDate');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

// ── POST /api/safe-date/start ─────────────────────────────────────────────────
router.post('/start', auth, async (req, res, next) => {
  try {
    // End any existing active session first
    await SafeDate.updateMany(
      { user: req.user._id, isActive: true },
      { isActive: false, endedAt: new Date() }
    );

    const { trustedContactIds = [], meetingWith = '', venue = '', expectedEndTime } = req.body;

    // Resolve trusted contact nicknames
    const contacts = [];
    if (trustedContactIds.length > 0) {
      const users = await User.find({ _id: { $in: trustedContactIds } })
        .select('nickname')
        .lean();
      users.forEach((u) => contacts.push({ userId: u._id, nickname: u.nickname }));
    }

    const session = await SafeDate.create({
      user: req.user._id,
      trustedContacts: contacts,
      meetingWith,
      venue,
      expectedEndTime: expectedEndTime ? new Date(expectedEndTime) : null,
      startedAt: new Date(),
    });

    created(res, session);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/safe-date/update-location ──────────────────────────────────────
router.post('/update-location', auth, async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return err(res, 'lat and lng required');

    const session = await SafeDate.findOneAndUpdate(
      { user: req.user._id, isActive: true },
      {
        'location.coordinates': [parseFloat(lng), parseFloat(lat)],
        lastCheckinAt: new Date(),
      },
      { new: true }
    );
    if (!session) return err(res, 'No active session', 404);
    ok(res, session);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/safe-date/panic ─────────────────────────────────────────────────
router.post('/panic', auth, async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    const update = { panicTriggered: true, panicAt: new Date() };
    if (lat != null && lng != null) {
      update['location.coordinates'] = [parseFloat(lng), parseFloat(lat)];
    }

    const session = await SafeDate.findOneAndUpdate(
      { user: req.user._id, isActive: true },
      update,
      { new: true }
    );
    if (!session) return err(res, 'No active session', 404);

    // TODO: Send push notifications to trustedContacts via FCM here.
    // For now, trusted contacts can poll /api/safe-date/alerts.
    // In production: iterate session.trustedContacts, look up FCM tokens, fire alerts.

    ok(res, {
      ok: true,
      alerted: session.trustedContacts.length,
      session,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/safe-date/end ───────────────────────────────────────────────────
router.post('/end', auth, async (req, res, next) => {
  try {
    const session = await SafeDate.findOneAndUpdate(
      { user: req.user._id, isActive: true },
      { isActive: false, endedAt: new Date() },
      { new: true }
    );
    if (!session) return err(res, 'No active session', 404);
    ok(res, session);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/safe-date/active ─────────────────────────────────────────────────
router.get('/active', auth, async (req, res, next) => {
  try {
    const session = await SafeDate.findOne({
      user: req.user._id,
      isActive: true,
    }).lean();
    ok(res, session);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/safe-date/alerts ─────────────────────────────────────────────────
// Panic alerts where I am a trusted contact.
router.get('/alerts', auth, async (req, res, next) => {
  try {
    const alerts = await SafeDate.find({
      'trustedContacts.userId': req.user._id,
      panicTriggered: true,
    })
      .sort({ panicAt: -1 })
      .limit(20)
      .populate('user', 'nickname avatarUrl')
      .lean();

    ok(res, alerts);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
