/**
 * remediate-demo-isolation.js — P0. Isolates seed/demo/review accounts from
 * real users. Steps:
 *   0. BACKUP the collections it touches → outputs/db-backup-<ts>/
 *   1. Mark the confirmed demo accounts isDemo=true.
 *   2. STOPGAP (works on the CURRENT live backend, which lacks isDemo filters):
 *      set stealthMode + hideFromNearby on demo accounts (removes them from
 *      nearby/cards/discover/moments-by-nearby immediately) and set their
 *      moments isActive=false + isDemo=true (removes them from the feed).
 *   3. Backfill Moment.isDemo for demo authors.
 *   4. POLLUTION cleanup: delete demo→real comments/likes/follows/chats.
 *
 * meyou-bot (Meyou 官方) is intentionally EXCLUDED — it's a legit official
 * account already hidden via isOfficial/NOT_OFFICIAL.
 *
 * Idempotent. Run: cd backend-express && node scripts/remediate-demo-isolation.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Confirmed demo accounts (Phase 1 list, minus meyou-bot).
const DEMO_EMAILS = [
  'apple-review@meyou.uk',
  'demo-jordan@meyou.uk',
  'demo-sam@meyou.uk',
  'demo-kai@meyou.uk',
  'demo-noah@meyou.uk',
  'demo-rio@meyou.uk',
  'qa-premium@meyou.test',
  'seed-lemon@meyou.uk',
  'hafiz@example.com',
  'mf82z5c4jm@privaterelay.appleid.com', // "John Apple" — SIWA review artifact
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('· connected to', mongoose.connection.name, '\n');

  const User = require('../src/models/User');
  const Moment = require('../src/models/Moment');
  const MomentComment = require('../src/models/MomentComment');
  const Match = require('../src/models/Match');
  const Message = require('../src/models/Message');
  const Follow = require('../src/models/Follow');

  // ── 0. Backup ───────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '..', '..', 'outputs', `db-backup-${ts}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const dump = async (name, model, query = {}) => {
    const docs = await model.find(query).lean();
    fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(docs, null, 2));
    return docs.length;
  };
  console.log('BACKUP →', backupDir);
  for (const [n, m] of [
    ['users', User], ['moments', Moment], ['momentcomments', MomentComment],
    ['matches', Match], ['follows', Follow],
  ]) {
    console.log(`  ${n}: ${await dump(n, m)}`);
  }

  // ── Resolve demo ids ────────────────────────────────────────────────────────
  const demoUsers = await User.find({ email: { $in: DEMO_EMAILS } }, '_id email nickname').lean();
  const demoIds = demoUsers.map((u) => u._id);
  console.log(`\nDEMO ACCOUNTS resolved: ${demoIds.length}/${DEMO_EMAILS.length}`);
  demoUsers.forEach((u) => console.log(`  ${u.email}  (${u.nickname})`));
  // Backup demo-related messages before any chat deletion.
  await dump('messages_demo', Message, { senderId: { $in: demoIds } });

  // ── 1 + 2. Flag + stopgap ───────────────────────────────────────────────────
  const flagged = await User.updateMany(
    { _id: { $in: demoIds } },
    {
      $set: {
        isDemo: true,
        'preferences.stealthMode': true,
        'preferences.hideFromNearby': true,
        // End any live nearby check-in immediately too.
        nearbyCheckedInAt: null,
        nearbyCheckinExpiresAt: null,
      },
    },
  );
  console.log(`\n① isDemo + ② stopgap(stealth/hideFromNearby/uncheck): ${flagged.modifiedCount} users`);

  // ── 3. Backfill Moment.isDemo + hide from live feed ─────────────────────────
  const moms = await Moment.updateMany(
    { user: { $in: demoIds } },
    { $set: { isDemo: true, isActive: false } },
  );
  console.log(`③ demo moments → isDemo + isActive=false (off live feed): ${moms.modifiedCount}`);

  // ── 4. Pollution cleanup (demo ↔ real only; demo↔demo kept for reviewer) ────
  const demoIdStrs = new Set(demoIds.map((id) => id.toString()));
  const isDemo = (id) => id && demoIdStrs.has(id.toString());

  // 4a. Comments by demo on NON-demo moments.
  const demoComments = await MomentComment.find({ user: { $in: demoIds } }, '_id moment').lean();
  let delComments = 0;
  if (demoComments.length) {
    const momIds = [...new Set(demoComments.map((c) => c.moment?.toString()).filter(Boolean))];
    const momAuthors = await Moment.find({ _id: { $in: momIds } }, '_id user').lean();
    const authorOf = new Map(momAuthors.map((m) => [m._id.toString(), m.user?.toString()]));
    const toDelete = demoComments
      .filter((c) => c.moment && !isDemo(authorOf.get(c.moment.toString())))
      .map((c) => c._id);
    if (toDelete.length) {
      delComments = (await MomentComment.deleteMany({ _id: { $in: toDelete } })).deletedCount;
    }
  }
  console.log(`④a demo comments on real moments deleted: ${delComments}`);

  // 4b. Demo likes on real moments.
  const likePull = await Moment.updateMany(
    { user: { $nin: demoIds }, likes: { $in: demoIds } },
    { $pull: { likes: { $in: demoIds } } },
  );
  console.log(`④b real moments with a demo like cleaned: ${likePull.modifiedCount}`);

  // 4c. Follows crossing demo/real (either direction). demo↔demo kept.
  const crossFollows = await Follow.deleteMany({
    $or: [
      { follower: { $in: demoIds }, following: { $nin: demoIds } },
      { follower: { $nin: demoIds }, following: { $in: demoIds } },
    ],
  });
  console.log(`④c demo↔real follows deleted: ${crossFollows.deletedCount}`);

  // 4d. Chats (Match + Messages) between a demo and a real user. demo↔demo kept.
  const demoMatches = await Match.find({ users: { $in: demoIds } }, '_id users').lean();
  const crossMatchIds = demoMatches
    .filter((m) => (m.users || []).some((u) => !isDemo(u))) // has a real participant
    .map((m) => m._id);
  let delMatches = 0, delMsgs = 0;
  if (crossMatchIds.length) {
    delMsgs = (await Message.deleteMany({ matchId: { $in: crossMatchIds } })).deletedCount;
    delMatches = (await Match.deleteMany({ _id: { $in: crossMatchIds } })).deletedCount;
  }
  console.log(`④d demo↔real chats deleted: ${delMatches} matches, ${delMsgs} messages`);

  console.log('\n=== REMEDIATION DONE ===');
  console.log(`Backup at: ${backupDir}`);
  console.log('Demo accounts are now stealthed + off nearby/feed on the LIVE backend.');
  console.log('Next: deploy isDemo query filters, then un-stealth demo for reviewer.');
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('REMEDIATION FAILED:', e);
  process.exit(1);
});
