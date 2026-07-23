/**
 * inspect-demo-accounts.js — READ ONLY. Lists suspected demo/test/review
 * accounts in the production DB so a human can confirm before any isolation.
 * Does NOT mutate anything.
 *
 * Run:  cd backend-express && node scripts/inspect-demo-accounts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Heuristics for "not a real user".
const EMAIL_RX = /@example\.com$|@meyou\.(uk|test)$|apple-review|review|^demo-|qa-/i;
const NAME_RX = /\(review\)|\breview\b|\btest\b|\bdemo\b|John Apple/i;
const STOCK_AVATAR_RX = /pravatar\.cc|picsum\.photos|i\.pravatar/i;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const dbName = mongoose.connection.name;
  console.log('· connected to', dbName, '\n');

  const User = require('../src/models/User');
  const Moment = require('../src/models/Moment');
  const MomentComment = require('../src/models/MomentComment');
  const Match = require('../src/models/Match');
  const Follow = require('../src/models/Follow');

  // Pull a lean superset, then classify in JS so we can show WHY each matched.
  const all = await User.find(
    {},
    'email nickname avatarUrl createdAt isDemo isPremium isVerified nearbyCheckinExpiresAt location',
  ).lean();

  const now = new Date();
  const suspects = [];
  for (const u of all) {
    const reasons = [];
    if (u.email && EMAIL_RX.test(u.email)) reasons.push('email');
    if (u.nickname && NAME_RX.test(u.nickname)) reasons.push('name');
    if (u.avatarUrl && STOCK_AVATAR_RX.test(u.avatarUrl)) reasons.push('stock-avatar');
    if (u.isDemo === true) reasons.push('already-isDemo');
    if (reasons.length) suspects.push({ u, reasons });
  }

  // Footprint per suspect (content that would pollute real users' views).
  const rows = [];
  for (const { u, reasons } of suspects) {
    const [moments, comments, following, followers, matches] = await Promise.all([
      Moment.countDocuments({ user: u._id }),
      MomentComment.countDocuments({ user: u._id }),
      Follow.countDocuments({ follower: u._id }),
      Follow.countDocuments({ following: u._id }),
      Match.countDocuments({ users: u._id }),
    ]);
    rows.push({
      id: u._id.toString(),
      email: u.email,
      name: u.nickname,
      reasons: reasons.join('+'),
      checkedIn: !!(u.nearbyCheckinExpiresAt && new Date(u.nearbyCheckinExpiresAt) > now),
      isDemo: u.isDemo === true,
      created: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '?',
      moments,
      comments,
      following,
      followers,
      matches,
      avatar: (u.avatarUrl || '').replace(/^https?:\/\//, '').slice(0, 34),
    });
  }

  rows.sort((a, b) => (b.moments + b.comments + b.matches) - (a.moments + a.comments + a.matches));

  console.log(`SUSPECTED DEMO/TEST ACCOUNTS: ${rows.length} of ${all.length} total users\n`);
  console.log(
    ['#', 'email', 'name', 'match', 'checkedIn', 'created', 'mom', 'cmt', 'fl→', 'fl←', 'chat']
      .join('\t'),
  );
  rows.forEach((r, i) => {
    console.log(
      [
        i + 1,
        r.email,
        r.name,
        r.reasons,
        r.checkedIn ? 'YES' : '-',
        r.created,
        r.moments,
        r.comments,
        r.following,
        r.followers,
        r.matches,
      ].join('\t'),
    );
  });

  // Machine-readable ids for the migration step (copy/paste safe).
  console.log('\n--- _ids (for confirmation) ---');
  rows.forEach((r) => console.log(`${r.id}  ${r.email}`));

  console.log('\n--- reasons legend ---');
  console.log('email = matches demo/test/review email pattern');
  console.log('name  = nickname contains Review/Test/Demo/John Apple');
  console.log('stock-avatar = pravatar/picsum placeholder image');
  console.log('already-isDemo = isDemo already true');

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('INSPECT FAILED:', e);
  process.exit(1);
});
