/**
 * seed-qa-premium.js — QA Premium test account for verifying the Premium-gated
 * chat "编辑/edit message" flow (the Android edge-to-edge keyboard fly-to-top
 * bug). IDEMPOTENT — safe to re-run.
 *
 * What it does:
 *   1. ASSERTS hafiz@example.com stays FREE (isPremium=false). hafiz is the
 *      Apple App Store reviewer demo account and MUST remain non-Premium — if a
 *      prior run flipped it Premium, this reverts it and logs the change.
 *   2. Upserts a fully-onboarded PREMIUM user  qa-premium@meyou.test  (premium +
 *      verified, interests onboarded so it lands straight in the app).
 *   3. Ensures a conversation (Match) with a partner + ≥3 RECENT own text
 *      messages from QA so the within-24h "编辑" option is available to long-press.
 *
 * Login (OTP bypass): email  qa-premium@meyou.test  code  222222
 *   (added to BYPASS_LOGINS in src/routes/auth.js — needs a backend deploy).
 *
 * Run:  cd backend-express && node scripts/seed-qa-premium.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const QA_EMAIL = 'qa-premium@meyou.test';
const PARTNER_EMAIL = 'qa-partner@meyou.test';
const REVIEWER_EMAIL = 'hafiz@example.com';
const PREMIUM_UNTIL = new Date('2030-01-01T00:00:00Z');

async function uniqueReferralCode(User) {
  for (let i = 0; i < 20; i++) {
    const code = Array.from({ length: 6 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
    ).join('');
    if (!(await User.exists({ referralCode: code }))) return code;
  }
  throw new Error('could not mint a unique referralCode');
}

async function ensureUser(User, email, patch) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, referralCode: await uniqueReferralCode(User) });
  }
  Object.assign(user, patch);
  if (!user.referralCode) user.referralCode = await uniqueReferralCode(User);
  await user.save();
  return user;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('· connected to', mongoose.connection.name);

  const User = require('../src/models/User');
  const Match = require('../src/models/Match');
  const Message = require('../src/models/Message');

  // ── 1. hafiz MUST stay Free ────────────────────────────────────────────────
  const hafiz = await User.findOne({ email: REVIEWER_EMAIL }).select(
    '+password isPremium premiumExpiresAt vipLevel vipExpiresAt email',
  );
  if (hafiz) {
    const wasPremium = !!hafiz.isPremium || (hafiz.vipLevel || 0) > 0;
    if (wasPremium) {
      hafiz.isPremium = false;
      hafiz.premiumExpiresAt = null;
      hafiz.vipLevel = 0;
      hafiz.vipExpiresAt = null;
      await hafiz.save();
      console.log('⚠️  hafiz was PREMIUM → REVERTED to Free');
    }
    console.log(`✓ hafiz isPremium = ${hafiz.isPremium} (must be false)`);
  } else {
    console.log('· hafiz not found (nothing to assert)');
  }

  // ── 2. QA Premium user ──────────────────────────────────────────────────────
  const now = new Date();
  const qa = await ensureUser(User, QA_EMAIL, {
    nickname: 'QA Premium',
    bio: 'QA test account — Premium. For verifying chat edit-message flow.',
    isPremium: true,
    premiumExpiresAt: PREMIUM_UNTIL,
    isVerified: true,
    verifiedAt: now,
    role: 'versatile',
    age: 28,
    dob: new Date('1997-06-15T00:00:00Z'),
    city: 'Kuala Lumpur',
    countryCode: 'MY',
    interests: ['coffee', 'fitness', 'hiking'],
    interestsOnboardedAt: now,
    avatarUrl: 'https://i.pravatar.cc/400?img=12',
    photos: ['https://i.pravatar.cc/600?img=12'],
    password: 'qaPremium123!', // hashed by the pre-save hook; login uses OTP bypass
  });
  console.log(`✓ QA premium user ${qa.email}  _id=${qa._id}  isPremium=${qa.isPremium}`);

  // ── 3. Partner + conversation ───────────────────────────────────────────────
  const partner = await ensureUser(User, PARTNER_EMAIL, {
    nickname: 'QA Partner',
    bio: 'QA test account — conversation partner for QA Premium.',
    role: 'top',
    age: 30,
    dob: new Date('1995-03-10T00:00:00Z'),
    city: 'Kuala Lumpur',
    countryCode: 'MY',
    interests: ['coffee', 'fitness', 'hiking'],
    interestsOnboardedAt: now,
    avatarUrl: 'https://i.pravatar.cc/400?img=33',
    photos: ['https://i.pravatar.cc/600?img=33'],
  });
  console.log(`✓ partner ${partner.email}  _id=${partner._id}`);

  let match = await Match.findOne({ users: { $all: [qa._id, partner._id] } });
  if (!match) {
    match = await Match.create({ users: [qa._id, partner._id], source: 'match', isActive: true });
    console.log(`✓ created match ${match._id}`);
  } else {
    console.log(`· match exists ${match._id}`);
  }

  // ≥3 recent OWN text messages from QA (recent → within the 24h edit window).
  const recentCutoff = new Date(Date.now() - 60 * 60 * 1000);
  const recentOwn = await Message.countDocuments({
    matchId: match._id,
    senderId: qa._id,
    type: 'text',
    createdAt: { $gte: recentCutoff },
  });
  if (recentOwn < 3) {
    const bodies = [
      'Hey! This is an editable test message 🛠️',
      'Long-press me and tap 编辑 to test the edit sheet.',
      'Keyboard should NOT fly to the top now.',
    ];
    const docs = await Message.insertMany(
      bodies.map((content) => ({
        matchId: match._id,
        senderId: qa._id,
        content,
        type: 'text',
        readBy: [qa._id],
      })),
    );
    const last = docs[docs.length - 1];
    match.lastMessage = last.content;
    match.lastMessageAt = last.createdAt;
    match.lastMessageBy = qa._id;
    await match.save();
    console.log(`✓ inserted ${docs.length} editable text messages from QA`);
  } else {
    console.log(`· ${recentOwn} recent QA text messages already present`);
  }

  console.log('\n=== DONE ===');
  console.log(`Login:  email ${QA_EMAIL}  ·  OTP code 222222 (bypass)`);
  console.log(`QA _id: ${qa._id}  ·  match: ${match._id}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
