const router = require('express').Router();
const Message = require('../models/Message');
const { ok, err } = require('../utils/respond');
const r2 = require('../services/r2Service');

/**
 * Per-call cap on how many rows we'll process in one cleanup pass.
 * Keeps the request bounded so a runaway cleanup can't hold the dyno.
 */
const CLEANUP_BATCH = 500;

/**
 * Grace period AFTER the 30-day TTL during which the GET handler
 * already serves expired:true to the client but we keep the B2 URL
 * around — gives clients time to render the placeholder without
 * 404-spamming any cached cards, and gives moderation a window for
 * report-review on recently-expired media.
 */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Header-token auth. We deliberately don't use the normal `auth`
 * middleware here so the endpoint never accepts a regular user JWT.
 * Instead it requires X-Admin-Token header == process.env.ADMIN_TOKEN.
 * If ADMIN_TOKEN is unset (fresh deploy), the endpoint fails CLOSED
 * — 503 with a clear reason, rather than silently being usable.
 */
function adminAuth(req, res, next) {
  if (!process.env.ADMIN_TOKEN) {
    return err(res, 'Admin endpoint disabled — ADMIN_TOKEN env var not set', 503);
  }
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return err(res, 'Forbidden', 403);
  }
  next();
}

// ── POST /api/admin/cleanup-expired-photos ────────────────────────────────────
// Find image messages past TTL + grace, drop the B2 object, nullify
// mediaUrl, stamp cleanedAt. Capped at CLEANUP_BATCH rows per call so
// the same endpoint can be re-run safely (or wired to a cron / scheduled
// task later) without backing up.
router.post('/cleanup-expired-photos', adminAuth, async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - GRACE_MS);
    const candidates = await Message.find({
      type: 'image',
      mediaUrl: { $ne: null },
      expiresAt: { $lt: cutoff },
    })
      .limit(CLEANUP_BATCH)
      .select('_id mediaUrl');

    let b2Ok = 0;
    let b2Fail = 0;
    let b2Skip = 0;
    for (const m of candidates) {
      const key = r2.keyFromUrl(m.mediaUrl);
      if (key) {
        try {
          await r2.deleteFile(key);
          b2Ok++;
        } catch {
          b2Fail++;
        }
      } else {
        // URL doesn't match the R2 host (legacy disk path etc) — nothing to delete
        b2Skip++;
      }
      await Message.updateOne(
        { _id: m._id },
        { $set: { mediaUrl: null, cleanedAt: new Date() } },
      );
    }

    ok(res, {
      processed: candidates.length,
      b2Ok,
      b2Fail,
      b2Skip,
      batchCap: CLEANUP_BATCH,
      graceDays: GRACE_MS / (24 * 60 * 60 * 1000),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
