/**
 * seed-phase1.js — Phase 1 demo content seeding (idempotent).
 *
 *   node scripts/seed-phase1.js --dry   # read-only: report current state + plan
 *   node scripts/seed-phase1.js         # perform inserts (idempotent, no deletes)
 *
 * Creates, only via INSERT (never updates real user data, never deletes):
 *   - 1 official bot user "Meyou 官方"   (meyou-bot@meyou.uk)
 *   - 5 demo persona users               (seed-*@meyou.uk, hidden from nearby)
 *   - 5 active VoteEvents (creator = bot)
 *   - 2–3 VoteEntries per event (from personas) with seed vote counts
 *   - World Chat messages from the bot in world/MY/CN/KR/JP
 *   - 1 active Announcement
 *
 * Idempotent: re-running skips anything that already exists (matched by
 * email / creator+title / bot+room+body / announcement title).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry');

const User = require('../src/models/User');
const VoteEvent = require('../src/models/VoteEvent');
const VoteEntry = require('../src/models/VoteEntry');
const WorldChatMessage = require('../src/models/WorldChatMessage');
const Announcement = require('../src/models/Announcement');

const now = new Date();
const endAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
const KL = [101.6869, 3.139]; // [lng, lat] — Kuala Lumpur, so MY users see the events nearby

// Lorem Picsum — deterministic per-seed image (used for non-themed avatars).
const img = (seed) => `https://picsum.photos/seed/${seed}/900/900`;
// Curated, theme-matched Unsplash photos (verified-200 IDs) for the contest
// covers + entries, so the seed content actually looks like real submissions.
const u = (id) => `https://images.unsplash.com/photo-${id}?w=1080&h=1080&fit=crop&q=80`;

const BOT = {
  email: 'meyou-bot@meyou.uk',
  nickname: 'Meyou 官方',
  bio: 'Meyou 官方帳號 · Official account',
  avatarUrl: img('meyou-official'),
  countryCode: 'MY',
  isPublicProfile: true,
  hideFromNearby: true,
};

const PERSONAS = [
  { email: 'seed-eevee@meyou.uk', nickname: 'Eevee', bio: '喜歡咖啡和貓 ☕🐱', countryCode: 'MY', city: '吉隆坡' },
  { email: 'seed-lemon@meyou.uk', nickname: 'Lemon Melon', bio: '愛拍照,愛旅行 📷', countryCode: 'SG', city: 'Singapore' },
  { email: 'seed-kai@meyou.uk', nickname: 'Kai', bio: '讀書、穿搭、生活', countryCode: 'TW', city: '台北' },
  { email: 'seed-rina@meyou.uk', nickname: 'Rina', bio: '日常記錄 🌿', countryCode: 'JP', city: '東京' },
  { email: 'seed-momo@meyou.uk', nickname: 'Momo', bio: '寵物萬歲 🐶', countryCode: 'MY', city: 'Penang' },
];

const EVENTS = [
  { key: 'coffee', title: '最美咖啡店', category: 'photography', description: '分享你最喜歡的咖啡店,給最有氣氛的一張投票!', cover: [u('1501339847302-ac426a4a7cbb'), u('1554118811-1e0d58224f24')] },
  { key: 'pets', title: '我家的毛孩', category: 'pets', description: '貓貓狗狗其他寵物都歡迎,曬出最可愛的家人!', cover: [u('1514888286974-6c03e2ca1dba')] },
  { key: 'book', title: '最近读的好书', category: 'talent', description: '拍下你正在讀的書,推薦給朋友', cover: [u('1481627834876-b7833e8f5570')] },
  { key: 'city', title: '我的城市风景', category: 'travel', description: '拍下你家附近最美的一個角落', cover: [u('1480714378408-67cf0d13bc1b'), u('1449824913935-59a10b8d2000')] },
  { key: 'outfit', title: '今日穿搭', category: 'outfit', description: '今天出門穿什麼?分享你的穿搭靈感', cover: [u('1483985988355-763728e1935b')] },
];

// p = index into PERSONAS; v = seed vote count (display only, no Vote docs).
const ENTRIES = {
  coffee: [
    { p: 0, photo: u('1495474472287-4d71bcdd2085'), caption: '我最近常去的咖啡店,氣氛很棒 ☕', v: 9 },
    { p: 1, photo: u('1442512595331-e89e73853f31'), caption: '手沖一杯,週末的小確幸', v: 6 },
    { p: 2, photo: u('1453614512568-c4024d13c247'), caption: '窗邊的位置最愛了', v: 4 },
  ],
  pets: [
    { p: 4, photo: u('1574158622682-e40e69881006'), caption: '我家主子,今天也很可愛 🐱', v: 11 },
    { p: 0, photo: u('1543466835-00a7907e9de1'), caption: '散步時間到!🐶', v: 7 },
  ],
  book: [
    { p: 2, photo: u('1512820790803-83ca734da794'), caption: '最近在讀的一本好書,推薦', v: 5 },
    { p: 3, photo: u('1507842217343-583bb7270b66'), caption: '睡前讀幾頁,很療癒', v: 3 },
  ],
  city: [
    { p: 1, photo: u('1502602898657-3e91760cbb34'), caption: '家附近的夕陽', v: 8 },
    { p: 3, photo: u('1540959733332-eab4deabeeaf'), caption: '清晨的街角', v: 5 },
    { p: 4, photo: u('1494891848038-7bd202a2afeb'), caption: '這個角落很有味道', v: 2 },
  ],
  outfit: [
    { p: 2, photo: u('1490481651871-ab68de25d43d'), caption: '今天的穿搭,簡單舒服', v: 6 },
    { p: 1, photo: u('1525507119028-ed4c629a60a3'), caption: '週末出門 look', v: 4 },
  ],
};

const CHAT = {
  world: ['歡迎來到 Meyou 世界廣場 🌍', '今天天氣不錯,大家都在做什麼?', '新加入的朋友 say hi!'],
  MY: ['馬來西亞的朋友們大家好 🇲🇾', '吉隆坡有人嗎?', '今天去哪吃?'],
  CN: ['中国朋友们好 🇨🇳', '今天聊聊最近的电影'],
  KR: ['한국 친구들 안녕하세요 🇰🇷', '오늘 날씨가 좋네요'],
  JP: ['日本の皆さん、こんにちは 🇯🇵', '今日は何をしますか'],
};

const ANNOUNCEMENT = {
  imageUrl: img('meyou-welcome-banner'),
  title: '歡迎來到 Meyou — 投票活動每週揭曉,世界廣場 24h 開放',
};

const created = { users: [], events: [], entries: [], messages: [], announcements: [] };
const skipped = { users: 0, events: 0, entries: 0, messages: 0, announcements: 0 };

async function ensureUser(spec) {
  const existing = await User.findOne({ email: spec.email }).select('_id email nickname');
  if (existing) {
    console.log(`  · user EXISTS  ${spec.email}  (${existing.nickname})  _id=${existing._id}`);
    skipped.users++;
    return existing._id;
  }
  if (DRY) {
    console.log(`  + user WOULD CREATE  ${spec.email}  (${spec.nickname})`);
    return null;
  }
  const u = await User.create({ ...spec });
  console.log(`  + user CREATED  ${spec.email}  (${u.nickname})  _id=${u._id}`);
  created.users.push({ id: u._id.toString(), email: spec.email, nickname: spec.nickname });
  return u._id;
}

async function run() {
  console.log(`\n=== Phase 1 seed ${DRY ? '(DRY RUN — no writes)' : '(LIVE)'} ===`);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB ✓\n');

  // Baseline counts (identity / before snapshot).
  const before = {
    users: await User.countDocuments(),
    events: await VoteEvent.countDocuments(),
    entries: await VoteEntry.countDocuments(),
    messages: await WorldChatMessage.countDocuments(),
    announcements: await Announcement.countDocuments(),
  };
  console.log('BEFORE:', JSON.stringify(before), '\n');

  // 1) Users -------------------------------------------------------------
  console.log('— Users —');
  const botId = await ensureUser(BOT);
  const personaIds = [];
  for (const p of PERSONAS) {
    personaIds.push(await ensureUser({ ...p, avatarUrl: img(`${p.nickname}-avatar`), isPublicProfile: true, hideFromNearby: true }));
  }

  // 2) Events + entries --------------------------------------------------
  console.log('\n— Vote events + entries —');
  const eventIdByKey = {};
  for (const ev of EVENTS) {
    let eventId = null;
    const existing = botId ? await VoteEvent.findOne({ creatorId: botId, title: ev.title }).select('_id') : null;
    if (existing) {
      eventId = existing._id;
      if (!DRY) await VoteEvent.updateOne({ _id: eventId }, { $set: { coverPhotos: ev.cover } });
      console.log(`  · event EXISTS  「${ev.title}」  _id=${eventId}${DRY ? '' : '  (covers updated)'}`);
      skipped.events++;
    } else if (DRY) {
      console.log(`  + event WOULD CREATE  「${ev.title}」 (${ev.category})`);
    } else {
      const doc = await VoteEvent.create({
        creatorId: botId,
        title: ev.title,
        description: ev.description,
        category: ev.category,
        coverPhotos: ev.cover,
        startAt: now,
        endAt,
        rules: { mode: 'fivePerDay' },
        type: 'single',
        status: 'active',
        location: { type: 'Point', coordinates: KL },
      });
      eventId = doc._id;
      console.log(`  + event CREATED  「${ev.title}」 (${ev.category})  _id=${eventId}`);
      created.events.push({ id: eventId.toString(), title: ev.title, category: ev.category });
    }
    eventIdByKey[ev.key] = eventId;

    // Entries
    let entryCount = 0;
    let voteSum = 0;
    for (const e of ENTRIES[ev.key]) {
      const submitterId = personaIds[e.p];
      if (!submitterId) {
        if (DRY) console.log(`    + entry WOULD CREATE  by ${PERSONAS[e.p].nickname}  "${e.caption}"`);
        continue;
      }
      const dup = eventId ? await VoteEntry.findOne({ eventId, submitterId }).select('_id voteCount') : null;
      if (dup) {
        if (!DRY) await VoteEntry.updateOne({ _id: dup._id }, { $set: { photoUrl: e.photo } });
        console.log(`    · entry EXISTS  by ${PERSONAS[e.p].nickname}  _id=${dup._id}${DRY ? '' : '  (photo updated)'}`);
        skipped.entries++;
        entryCount++;
        voteSum += dup.voteCount || 0;
        continue;
      }
      if (DRY) {
        console.log(`    + entry WOULD CREATE  by ${PERSONAS[e.p].nickname}  "${e.caption}"  (v=${e.v})`);
        continue;
      }
      const entry = await VoteEntry.create({
        eventId,
        submitterId,
        photoUrl: e.photo,
        caption: e.caption,
        voteCount: e.v,
        status: 'active',
      });
      console.log(`    + entry CREATED  by ${PERSONAS[e.p].nickname}  _id=${entry._id}  (v=${e.v})`);
      created.entries.push({ id: entry._id.toString(), event: ev.title, by: PERSONAS[e.p].nickname });
      entryCount++;
      voteSum += e.v;
    }

    // Sync denormalized counts on the event.
    if (!DRY && eventId) {
      await VoteEvent.updateOne({ _id: eventId }, { $set: { entryCount, voteCount: voteSum } });
      console.log(`    ↳ event counts synced: entryCount=${entryCount}, voteCount=${voteSum}`);
    }
  }

  // 3) World chat --------------------------------------------------------
  console.log('\n— World chat —');
  for (const [roomId, msgs] of Object.entries(CHAT)) {
    for (const body of msgs) {
      const dup = botId ? await WorldChatMessage.findOne({ userId: botId, roomId, body }).select('_id') : null;
      if (dup) {
        console.log(`  · msg EXISTS  [${roomId}]  ${body.slice(0, 16)}…`);
        skipped.messages++;
        continue;
      }
      if (DRY) {
        console.log(`  + msg WOULD CREATE  [${roomId}]  ${body}`);
        continue;
      }
      const m = await WorldChatMessage.create({ userId: botId, roomId, body });
      console.log(`  + msg CREATED  [${roomId}]  _id=${m._id}  ${body.slice(0, 16)}…`);
      created.messages.push({ id: m._id.toString(), roomId });
    }
  }

  // 4) Announcement ------------------------------------------------------
  console.log('\n— Announcement —');
  {
    const dup = await Announcement.findOne({ title: ANNOUNCEMENT.title }).select('_id');
    if (dup) {
      console.log(`  · announcement EXISTS  _id=${dup._id}`);
      skipped.announcements++;
    } else if (DRY) {
      console.log(`  + announcement WOULD CREATE  "${ANNOUNCEMENT.title}"`);
    } else {
      const a = await Announcement.create({ ...ANNOUNCEMENT, isActive: true });
      console.log(`  + announcement CREATED  _id=${a._id}`);
      created.announcements.push({ id: a._id.toString() });
    }
  }

  // After counts + summary ----------------------------------------------
  const after = {
    users: await User.countDocuments(),
    events: await VoteEvent.countDocuments(),
    entries: await VoteEntry.countDocuments(),
    messages: await WorldChatMessage.countDocuments(),
    announcements: await Announcement.countDocuments(),
  };
  console.log('\nAFTER: ', JSON.stringify(after));
  console.log('DELTA: ', JSON.stringify({
    users: after.users - before.users,
    events: after.events - before.events,
    entries: after.entries - before.entries,
    messages: after.messages - before.messages,
    announcements: after.announcements - before.announcements,
  }));
  console.log('\nCREATED:', JSON.stringify(created, null, 2));
  console.log('SKIPPED (already existed):', JSON.stringify(skipped));

  await mongoose.disconnect();
  console.log('\nDisconnected ✓');
}

run().catch(async (e) => {
  console.error('SEED ERROR:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
