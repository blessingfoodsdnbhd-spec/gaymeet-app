const router = require('express').Router();
const User = require('../models/User');
const Match = require('../models/Match');
const Follow = require('../models/Follow');
const Moment = require('../models/Moment');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// The 16 canonical interest tag ids — must match
// app-rn/src/data/interestTags.ts.
const VALID_TAG_IDS = new Set([
  'city-walk', 'coffee', 'vinyl', 'film', 'indie-rock', 'bookclub',
  'hiking', 'matcha', 'pottery', 'skate', 'cat', 'cooking',
  'movie', 'yoga', 'boardgame', 'anime',
]);

const MIN_TAGS = 3;
const MAX_TAGS = 16;

// ── PATCH /api/me/interests ───────────────────────────────────────────────────
// Body: { interests: string[] }
// Validates against the canonical 16, dedupes, enforces 3 ≤ N ≤ 16.
// Sets interestsOnboardedAt when this is the first time the user submits a
// valid list — that's the signal the client uses to leave the onboarding gate.
router.patch('/interests', auth, async (req, res, next) => {
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests)) {
      return err(res, 'interests must be an array of tag ids');
    }

    const unique = [...new Set(interests)];
    const invalid = unique.filter((id) => !VALID_TAG_IDS.has(id));
    if (invalid.length > 0) {
      return err(res, `Unknown tag ids: ${invalid.join(', ')}`);
    }
    if (unique.length < MIN_TAGS) {
      return err(res, `Pick at least ${MIN_TAGS} interests`);
    }
    if (unique.length > MAX_TAGS) {
      return err(res, `Pick at most ${MAX_TAGS} interests`);
    }

    const update = {
      interests: unique,
      interestsOnboardedAt: req.user.interestsOnboardedAt ?? new Date(),
    };

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/me/prompts ─────────────────────────────────────────────────────
// Body: { prompts: [{ q, a }, ...] }
router.patch('/prompts', auth, async (req, res, next) => {
  try {
    const { prompts } = req.body;
    if (!Array.isArray(prompts)) {
      return err(res, 'prompts must be an array of { q, a } objects');
    }
    const cleaned = prompts
      .filter((p) => p && typeof p.q === 'string' && typeof p.a === 'string')
      .map((p) => ({ q: p.q.trim(), a: p.a.trim() }))
      .filter((p) => p.q && p.a)
      .slice(0, 6);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { prompts: cleaned },
      { new: true },
    );
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/me/privacy ─────────────────────────────────────────────────────
// Body: { nearbyVisible?: bool, showDistance?: bool }
// Wraps the existing preferences.hideFromNearby / hideDistance toggles in
// the affirmative naming used by the v2 design.
router.patch('/privacy', auth, async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.nearbyVisible === 'boolean') {
      update['preferences.hideFromNearby'] = !req.body.nearbyVisible;
    }
    if (typeof req.body.showDistance === 'boolean') {
      update['preferences.hideDistance'] = !req.body.showDistance;
    }
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    ok(res, user.toPublicJSON());
  } catch (e) {
    next(e);
  }
});

// ── GET /api/me/stats ────────────────────────────────────────────────────────
// Powers the three counters on the profile screen: 同频 (matched users),
// 好友 (people I follow), 动态 (moments I've posted).
//
// The matches count must agree with what the MatchesListScreen actually
// renders (which calls GET /api/conversations). That endpoint:
//   1. filters Match by { users: me, isActive: true }
//   2. drops entries where the OTHER user has been deleted (populate → null)
//   3. the client further filters to source === 'match'
// A naive Match.countDocuments({ users: me, isActive: true }) inflates the
// number — it includes source='dm' rows AND rows whose other user has been
// deleted. Mirror the same join + filter here so the stat matches the list.
router.get('/stats', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;
    const [matchDocs, following, moments] = await Promise.all([
      Match.find({ users: uid, isActive: true, source: 'match' })
        .select('users source')
        .populate('users', '_id')
        .lean(),
      Follow.countDocuments({ follower: uid }),
      Moment.countDocuments({ user: uid, isActive: true }),
    ]);
    const matches = matchDocs.filter((m) => {
      const validUsers = (m.users || []).filter(Boolean);
      const other = validUsers.find((u) => u._id.toString() !== uid.toString());
      return !!other;
    }).length;
    ok(res, { matches, following, moments });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/me/pricing ───────────────────────────────────────────────────────
// Premium subscription tiers (Meyou 密友 v2 — single SKU, billed in MYR).
// Public — same numbers for everyone, no auth needed.
router.get('/pricing', async (_req, res) => {
  ok(res, {
    monthly: { price: 39.9, currency: 'MYR', period: 'month' },
    annual:  { price: 399.9, currency: 'MYR', period: 'year' },
  });
});

module.exports = router;
