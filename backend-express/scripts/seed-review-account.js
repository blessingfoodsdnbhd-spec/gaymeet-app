/**
 * seed-review-account.js — Apple App Review demo account + a populated Nearby
 * grid, for Guideline 2.1(a) (demo account) and 5.1.2(i) (opt-in, session-based
 * location sharing). IDEMPOTENT — safe to re-run.
 *
 * What it creates:
 *   1. Review account  apple-review@meyou.uk  — fully onboarded, verified,
 *      Premium, with avatar/photos/bio/interests, 6 moments, 4 chat threads,
 *      and 3 private photos (so the reviewer can walk the private-photo flow).
 *   2. 5 demo "neighbour" users placed a few km from the review account, each
 *      with a LIVE nearby check-in (so when the reviewer taps 签到 / Check in,
 *      the 附近 grid is populated instead of empty — Apple 4.3(b)).
 *      The review account itself is left NOT checked in, so the reviewer sees
 *      the check-in CTA and can exercise the opt-in flow themselves.
 *
 * Login (OTP fixed-code bypass — mirrors the hafiz reviewer account):
 *   email  apple-review@meyou.uk   code  135790
 *   A password (demo1234) is also set, so /login works as a fallback.
 *   NOTE: the OTP bypass requires the auth.js BYPASS_LOGINS entry (added in the
 *   same change) to be DEPLOYED to the backend to take effect.
 *
 * Run:  cd backend-express && node scripts/seed-review-account.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const REVIEW_EMAIL = 'apple-review@meyou.uk';
const REVIEW_PASSWORD = 'demo1234';
const PREMIUM_UNTIL = new Date('2030-01-01T00:00:00Z');
// Far-future check-in so seeded neighbours always populate the grid for review.
const DEMO_CHECKIN_UNTIL = new Date('2030-01-01T00:00:00Z');

// Review account sits in central KL; neighbours are scattered a few km around it.
const BASE_LAT = 3.139;
const BASE_LNG = 101.6869;

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
  const Moment = require('../src/models/Moment');

  const now = new Date();

  // ── 1. Review account ───────────────────────────────────────────────────────
  const reviewer = await ensureUser(User, REVIEW_EMAIL, {
    nickname: 'Alex (Review)',
    bio: 'Coffee, weekend hikes, and finding people who get it. Say hi 👋',
    isPremium: true,
    premiumExpiresAt: PREMIUM_UNTIL,
    isVerified: true,
    verifiedAt: now,
    role: 'versatile',
    age: 27,
    dob: new Date('1998-04-12T00:00:00Z'),
    height: 176,
    weight: 68,
    city: 'Kuala Lumpur',
    countryCode: 'MY',
    interests: ['coffee', 'fitness', 'hiking', 'travel', 'movies'],
    interestsOnboardedAt: now,
    prompts: [
      { q: '本周想找人一起', a: '去 APW 喝咖啡,顺便逛周末市集。' },
      { q: '我的理想周末', a: '早上爬山,下午咖啡厅看书。' },
    ],
    avatarUrl: 'https://i.pravatar.cc/400?img=15',
    photos: [
      'https://i.pravatar.cc/600?img=15',
      'https://i.pravatar.cc/600?img=52',
      'https://i.pravatar.cc/600?img=60',
    ],
    privatePhotos: [
      'https://i.pravatar.cc/600?img=64',
      'https://i.pravatar.cc/600?img=65',
      'https://i.pravatar.cc/600?img=68',
    ],
    location: { type: 'Point', coordinates: [BASE_LNG, BASE_LAT] },
    lastActiveAt: now,
    isOnline: true,
    password: REVIEW_PASSWORD, // hashed by pre-save hook; OTP bypass also works
    // Reviewer starts NOT checked in — they exercise the opt-in check-in flow.
    nearbyCheckedInAt: null,
    nearbyCheckinExpiresAt: null,
  });
  console.log(`✓ review account ${reviewer.email}  _id=${reviewer._id}  premium=${reviewer.isPremium}`);

  // ── 2. Neighbour demo users (checked in, near the reviewer) ─────────────────
  const neighbours = [
    { email: 'demo-jordan@meyou.uk', nickname: 'Jordan', img: 21, role: 'top', age: 29, dLat: 0.004, dLng: 0.003 },
    { email: 'demo-sam@meyou.uk', nickname: 'Sam', img: 24, role: 'versatile', age: 26, dLat: -0.006, dLng: 0.005 },
    { email: 'demo-kai@meyou.uk', nickname: 'Kai', img: 33, role: 'bottom', age: 31, dLat: 0.008, dLng: -0.004 },
    { email: 'demo-noah@meyou.uk', nickname: 'Noah', img: 51, role: 'versatile', age: 24, dLat: -0.003, dLng: -0.007 },
    { email: 'demo-rio@meyou.uk', nickname: 'Rio', img: 12, role: 'top', age: 28, dLat: 0.011, dLng: 0.009 },
  ];

  const neighbourDocs = [];
  for (const n of neighbours) {
    const u = await ensureUser(User, n.email, {
      nickname: n.nickname,
      bio: `${n.nickname} — demo neighbour for App Review. Coffee & hikes.`,
      isVerified: true,
      verifiedAt: now,
      role: n.role,
      age: n.age,
      dob: new Date(`${new Date().getFullYear() - n.age}-05-05T00:00:00Z`),
      city: 'Kuala Lumpur',
      countryCode: 'MY',
      interests: ['coffee', 'fitness', 'hiking'],
      interestsOnboardedAt: now,
      avatarUrl: `https://i.pravatar.cc/400?img=${n.img}`,
      photos: [`https://i.pravatar.cc/600?img=${n.img}`],
      location: { type: 'Point', coordinates: [BASE_LNG + n.dLng, BASE_LAT + n.dLat] },
      lastActiveAt: now,
      isOnline: true,
      // LIVE check-in → visible on the reviewer's Nearby grid.
      nearbyCheckedInAt: now,
      nearbyCheckinExpiresAt: DEMO_CHECKIN_UNTIL,
    });
    neighbourDocs.push(u);
  }
  console.log(`✓ ${neighbourDocs.length} neighbour demo users (all checked in near reviewer)`);

  // ── 3. Chat threads (4 conversations with recent messages) ──────────────────
  const chatPartners = neighbourDocs.slice(0, 4);
  for (const partner of chatPartners) {
    let match = await Match.findOne({ users: { $all: [reviewer._id, partner._id] } });
    if (!match) {
      match = await Match.create({ users: [reviewer._id, partner._id], source: 'match', isActive: true });
    }
    const existing = await Message.countDocuments({ matchId: match._id });
    if (existing === 0) {
      const scripted = [
        { from: partner._id, content: `Hey ${reviewer.nickname.split(' ')[0]}! Saw we both love hiking 🥾` },
        { from: reviewer._id, content: 'Yeah! Been meaning to try Bukit Tabur. You been?' },
        { from: partner._id, content: 'Twice — sunrise there is unreal. Free this weekend?' },
        { from: reviewer._id, content: 'Saturday works. Coffee after at APW? ☕' },
        { from: partner._id, content: 'Perfect, let\'s do it 🙌' },
      ];
      let ts = Date.now() - scripted.length * 5 * 60 * 1000;
      const docs = [];
      for (const m of scripted) {
        ts += 5 * 60 * 1000;
        docs.push({
          matchId: match._id,
          senderId: m.from,
          content: m.content,
          type: 'text',
          readBy: [reviewer._id, partner._id],
          createdAt: new Date(ts),
        });
      }
      const inserted = await Message.insertMany(docs);
      const last = inserted[inserted.length - 1];
      match.lastMessage = last.content;
      match.lastMessageAt = last.createdAt;
      match.lastMessageBy = last.senderId;
      await match.save();
    }
  }
  console.log(`✓ ${chatPartners.length} chat threads with scripted messages`);

  // ── 4. Moments (6 posts by the review account) ──────────────────────────────
  const momentSeeds = [
    { content: 'Sunrise from Bukit Tabur this morning. Worth the 5am alarm ⛰️', img: 1040 },
    { content: 'New café obsession in Bangsar — flat white game strong ☕', img: 225 },
    { content: 'Weekend market haul. Fresh mangosteens season is here 🥭', img: 292 },
    { content: 'Movie night pick: rewatched an old favourite. Anyone else?', img: 823 },
    { content: 'Long run done. Legs say no, playlist says one more km 🎧', img: 1062 },
    { content: 'Trying to plan a Penang food trip. Recommendations welcome!', img: 674 },
  ];
  const existingMoments = await Moment.countDocuments({ user: reviewer._id });
  if (existingMoments < momentSeeds.length) {
    let ts = Date.now() - momentSeeds.length * 6 * 60 * 60 * 1000;
    const toInsert = [];
    for (const m of momentSeeds) {
      ts += 6 * 60 * 60 * 1000;
      toInsert.push({
        user: reviewer._id,
        content: m.content,
        images: [`https://picsum.photos/id/${m.img}/800/800`],
        visibility: 'public',
        isActive: true,
        createdAt: new Date(ts),
      });
    }
    await Moment.insertMany(toInsert);
    console.log(`✓ inserted ${toInsert.length} moments`);
  } else {
    console.log(`· ${existingMoments} moments already present`);
  }

  console.log('\n=== DONE ===');
  console.log(`Review login:  email ${REVIEW_EMAIL}  ·  OTP code 135790  (or password ${REVIEW_PASSWORD})`);
  console.log(`Review _id:    ${reviewer._id}`);
  console.log('Reviewer is NOT checked in → they can test the opt-in Nearby check-in.');
  console.log(`Neighbours checked in: ${neighbourDocs.map((u) => u.nickname).join(', ')}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
