// ⚠️ TEMPORARY ADMIN ROUTES
//
// One-shot maintenance endpoints. Deploy → run once via curl → REMOVE
// in a follow-up PR. Do NOT leave these live for long — they're
// destructive and only guarded by Hafiz email check.
//
// Auth: standard JWT auth middleware + caller's email must equal
// hafiz@example.com (the seed/test admin per CLAUDE.md). The test
// password is widely-known (`password123`), so this is "small window"
// security only — viable because the endpoint is removed in minutes.
const router = require('express').Router();
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const Moment = require('../models/Moment');
const r2 = require('../services/r2Service');

const ADMIN_EMAIL = 'hafiz@example.com';

function requireAdmin(req, res, next) {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    return err(res, 'forbidden', 403);
  }
  next();
}

// POST /api/admin/cleanup-orphan-b2-and-moments
//
// 1. Find all Moment documents with B2-hosted images
// 2. Delete each B2 file via r2Service (Backblaze native API)
//    - continues on failure; collects errors
// 3. Delete all Moment documents
// 4. Independently re-verify B2 files are gone (b2_list_file_versions)
// 5. Return full report
router.post(
  '/cleanup-orphan-b2-and-moments',
  auth,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (!r2.configured) {
        return err(res, 'r2/b2 service not configured on this deploy', 503);
      }

      // ── Discover keys ───────────────────────────────────────────────
      const docs = await Moment.find({
        images: { $regex: 'f005.backblazeb2.com' },
      })
        .select('_id images')
        .lean();
      const keys = [];
      for (const d of docs) {
        for (const url of d.images || []) {
          if (url.includes('f005.backblazeb2.com')) {
            const m = url.match(/\/file\/[^/]+\/(.+)$/);
            if (m) keys.push(m[1]);
          }
        }
      }

      // ── Step 1: B2 deletes (continue on failure) ────────────────────
      const b2Results = { attempted: keys.length, ok: 0, errors: [] };
      for (const key of keys) {
        try {
          await r2.deleteFile(key);
          b2Results.ok += 1;
        } catch (e) {
          b2Results.errors.push({ key, error: e?.message || String(e) });
        }
      }

      // ── Step 2: DB cleanup ──────────────────────────────────────────
      const beforeMoments = await Moment.countDocuments({});
      const delRes = await Moment.deleteMany({});
      const afterMoments = await Moment.countDocuments({});

      // ── Step 3: Independent B2 verify ──────────────────────────────
      let stillPresent = [];
      try {
        const creds = Buffer.from(
          `${process.env.R2_ACCESS_KEY_ID}:${process.env.R2_SECRET_ACCESS_KEY}`,
        ).toString('base64');
        const authRes = await axios.get(
          'https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
          { headers: { Authorization: `Basic ${creds}` } },
        );
        const authData = authRes.data;
        const storageApi = authData.apiInfo?.storageApi ?? {};
        const apiUrl = storageApi.apiUrl || authData.apiUrl;
        let bucketId = storageApi.bucketId;
        if (!bucketId) {
          const lookup = await axios.post(
            `${apiUrl}/b2api/v3/b2_list_buckets`,
            { accountId: authData.accountId, bucketName: process.env.R2_BUCKET },
            { headers: { Authorization: authData.authorizationToken } },
          );
          bucketId = lookup.data.buckets?.[0]?.bucketId;
        }
        for (const key of keys) {
          try {
            const list = await axios.post(
              `${apiUrl}/b2api/v3/b2_list_file_versions`,
              { bucketId, startFileName: key, maxFileCount: 1 },
              { headers: { Authorization: authData.authorizationToken } },
            );
            const found = (list.data.files || []).find((f) => f.fileName === key);
            if (found) stillPresent.push(key);
          } catch (e) {
            stillPresent.push(`${key} (verify-error: ${e?.message})`);
          }
        }
      } catch (e) {
        // Verify step itself failed — surface it but don't fail the response.
        stillPresent = [`verify-step-failed: ${e?.message}`];
      }

      ok(res, {
        keys,
        b2: b2Results,
        db: {
          moments_before: beforeMoments,
          moments_deleted: delRes.deletedCount,
          moments_after: afterMoments,
        },
        verify: {
          still_present_count: stillPresent.length,
          still_present: stillPresent,
          all_clean: stillPresent.length === 0 && afterMoments === 0,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
