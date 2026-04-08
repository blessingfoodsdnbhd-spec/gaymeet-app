/**
 * Seed script — populates MongoDB with dummy data for development.
 * Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('./config/db');

const User = require('./models/User');
const Swipe = require('./models/Swipe');
const Match = require('./models/Match');
const Message = require('./models/Message');
const LicensePlate = require('./models/LicensePlate');
const PlateMessage = require('./models/PlateMessage');
const Promotion = require('./models/Promotion');
const Shout = require('./models/Shout');
const Moment = require('./models/Moment');
const MomentComment = require('./models/MomentComment');
const Gift = require('./models/Gift');
const GiftTransaction = require('./models/GiftTransaction');
const Event = require('./models/Event');
const StickerPack = require('./models/StickerPack');

// ── KL-area coordinates (jittered) ───────────────────────────────────────────
const KL_CENTER = [101.6869, 3.1390]; // [lng, lat]

function jitter(center, radiusKm) {
  const radiusDeg = radiusKm / 111.0;
  return [
    center[0] + (Math.random() - 0.5) * 2 * radiusDeg,
    center[1] + (Math.random() - 0.5) * 2 * radiusDeg,
  ];
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const DUMMY_USERS = [
  // Malaysian users
  { nickname: 'Hafiz', age: 24, height: 172, weight: 68, countryCode: 'MY', tags: ['gym', 'travel'] },
  { nickname: 'Wei Zhen', age: 28, height: 175, weight: 70, countryCode: 'MY', tags: ['music', 'coffee'] },
  { nickname: 'Arjun', age: 26, height: 178, weight: 75, countryCode: 'MY', tags: ['hiking', 'food'] },
  { nickname: 'Syazwan', age: 22, height: 168, weight: 62, countryCode: 'MY', tags: ['gaming', 'anime'] },
  { nickname: 'Brendan', age: 30, height: 180, weight: 80, countryCode: 'MY', tags: ['gym', 'travel', 'coffee'] },
  { nickname: 'Farid', age: 25, height: 170, weight: 65, countryCode: 'MY', tags: ['music', 'art'] },
  { nickname: 'Jun Wei', age: 27, height: 174, weight: 72, countryCode: 'MY', tags: ['hiking', 'photography'] },
  { nickname: 'Harish', age: 23, height: 169, weight: 64, countryCode: 'MY', tags: ['food', 'travel'] },
  { nickname: 'Zulaikha', age: 29, height: 177, weight: 78, countryCode: 'MY', tags: ['gym', 'music'] },
  { nickname: 'Kelvin', age: 31, height: 182, weight: 85, countryCode: 'MY', tags: ['sports', 'food'] },
  { nickname: 'Izzatul', age: 24, height: 167, weight: 60, countryCode: 'MY', tags: ['art', 'coffee'] },
  { nickname: 'Reuben', age: 26, height: 176, weight: 73, countryCode: 'MY', tags: ['travel', 'photography'] },
  { nickname: 'Danish', age: 21, height: 171, weight: 66, countryCode: 'MY', tags: ['gaming', 'music'] },
  { nickname: 'Chong Wei', age: 28, height: 173, weight: 69, countryCode: 'MY', tags: ['hiking', 'travel'] },
  { nickname: 'Naufal', age: 25, height: 179, weight: 77, countryCode: 'MY', tags: ['gym', 'sports'] },
  // International users
  { nickname: 'Taichi', age: 27, height: 175, weight: 68, countryCode: 'JP', tags: ['anime', 'food'] },
  { nickname: 'Kevin Tan', age: 29, height: 172, weight: 70, countryCode: 'SG', tags: ['travel', 'coffee'] },
  { nickname: 'Somchai', age: 26, height: 170, weight: 65, countryCode: 'TH', tags: ['music', 'art'] },
  { nickname: 'Min Jun', age: 24, height: 176, weight: 71, countryCode: 'KR', tags: ['kpop', 'gaming'] },
  { nickname: 'Li Wei', age: 30, height: 174, weight: 72, countryCode: 'CN', tags: ['travel', 'food'] },
];

const PROMOTIONS_SEED = [
  {
    title: '高级会员限时 5 折',
    subtitle: '本周末前升级，解锁传送、隐身、超级喜欢等全功能',
    actionUrl: '/premium',
    type: 'both',
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 3 * 86400000),
    isActive: true,
    priority: 10,
  },
  {
    title: 'GayMeet 同骄活动 🌈',
    subtitle: '参与彩虹周活动，赢取免费高级会员资格',
    actionUrl: '/premium',
    type: 'banner',
    startDate: new Date(Date.now() - 7200000),
    endDate: new Date(Date.now() + 7 * 86400000),
    isActive: true,
    priority: 5,
  },
  {
    title: 'Boost 曝光率',
    subtitle: '限时购买 Boost，让更多人发现你的资料',
    actionUrl: '/premium',
    type: 'banner',
    startDate: new Date(Date.now() - 3600000),
    endDate: new Date(Date.now() + 2 * 86400000),
    isActive: true,
    priority: 3,
  },
];

const PLATE_MESSAGES_SEED = [
  '你好！我在红灯看到你，你好帅！',
  '昨天在MidValley看到你，很想认识你 😊',
  '在NPE看到你的车，希望有机会聊聊',
  '你的车很漂亮，请问可以交个朋友吗？',
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();
  console.log('🌱 Starting seed...');

  // ── Clear existing data ────────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Swipe.deleteMany({}),
    Match.deleteMany({}),
    Message.deleteMany({}),
    LicensePlate.deleteMany({}),
    PlateMessage.deleteMany({}),
    Promotion.deleteMany({}),
    Shout.deleteMany({}),
    Moment.deleteMany({}),
    MomentComment.deleteMany({}),
    Gift.deleteMany({}),
    GiftTransaction.deleteMany({}),
    Event.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Create users ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);
  const coords = DUMMY_USERS.map(() => jitter(KL_CENTER, 20));

  const userDocs = await User.insertMany(
    DUMMY_USERS.map((u, i) => ({
      ...u,
      email: `${u.nickname.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      password: passwordHash,
      coins: 100,
      bio: `Hi, I'm ${u.nickname}! Looking to meet interesting people.`,
      avatarUrl: null,
      photos: [],
      location: { type: 'Point', coordinates: coords[i] },
      lastActiveAt: new Date(Date.now() - Math.random() * 3600000 * 48),
      isOnline: Math.random() > 0.6,
      isPremium: i < 5, // first 5 users are premium
      isBoosted: i < 2, // first 2 are boosted
      boostExpiresAt: i < 2 ? new Date(Date.now() + 30 * 60 * 1000) : null,
    }))
  );
  console.log(`👤 Created ${userDocs.length} users`);

  // ── Create swipes and matches ──────────────────────────────────────────────
  const swipes = [];
  const matchPairs = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [5, 6],
    [7, 8],
  ];

  // Mutual likes for each pair → will create matches
  for (const [a, b] of matchPairs) {
    swipes.push({ fromUser: userDocs[a]._id, toUser: userDocs[b]._id, direction: 'like' });
    swipes.push({ fromUser: userDocs[b]._id, toUser: userDocs[a]._id, direction: 'like' });
  }

  // Some one-sided likes
  for (let i = 9; i < 15; i++) {
    swipes.push({ fromUser: userDocs[i]._id, toUser: userDocs[0]._id, direction: 'like' });
  }

  await Swipe.insertMany(swipes);
  console.log(`👍 Created ${swipes.length} swipes`);

  const matches = await Match.insertMany(
    matchPairs.map(([a, b]) => ({
      users: [userDocs[a]._id, userDocs[b]._id],
      isActive: true,
    }))
  );
  console.log(`💞 Created ${matches.length} matches`);

  // ── Create messages ────────────────────────────────────────────────────────
  const SAMPLE_MESSAGES = [
    ['嘿！你好 😊', '你好！很高兴认识你', '你在哪里？', '我在Bangsar，你呢？', '我也在附近！要见面吗？'],
    ['Hi there!', '嗨～ 怎么了？', '看到你的资料很想认识你', '谢谢你！你也很帅 😍'],
    ['你喜欢什么活动？', '我喜欢健身和旅行', '我也是！我们很合得来', '哈哈 是的！'],
  ];

  const messageDocs = [];
  for (let i = 0; i < Math.min(3, matches.length); i++) {
    const match = matches[i];
    const msgs = SAMPLE_MESSAGES[i] || SAMPLE_MESSAGES[0];
    const [userA, userB] = match.users;

    for (let j = 0; j < msgs.length; j++) {
      const sender = j % 2 === 0 ? userA : userB;
      messageDocs.push({
        matchId: match._id,
        senderId: sender,
        content: msgs[j],
        readBy: [userA, userB],
        createdAt: new Date(Date.now() - (msgs.length - j) * 300000),
      });
    }

    // Update match with last message
    const last = msgs[msgs.length - 1];
    await Match.findByIdAndUpdate(match._id, {
      lastMessage: last,
      lastMessageAt: new Date(Date.now() - 300000),
    });
  }
  await Message.insertMany(messageDocs);
  console.log(`💬 Created ${messageDocs.length} messages`);

  // ── Create license plates ──────────────────────────────────────────────────
  const plates = [
    { plateNumber: 'WGK1234', owner: userDocs[0]._id },
    { plateNumber: 'VJP5678', owner: userDocs[1]._id },
    { plateNumber: 'ABC9012', owner: userDocs[2]._id },
  ];
  const plateDocs = await LicensePlate.insertMany(plates);
  console.log(`🚗 Created ${plateDocs.length} license plates`);

  // ── Create plate messages ──────────────────────────────────────────────────
  const plateMessages = PLATE_MESSAGES_SEED.map((content, i) => ({
    plateNumber: plateDocs[0].plateNumber,
    sender: userDocs[i + 3]._id,
    content,
    isRead: i < 2,
  }));
  await PlateMessage.insertMany(plateMessages);
  console.log(`📬 Created ${plateMessages.length} plate messages`);

  // ── Create promotions ──────────────────────────────────────────────────────
  await Promotion.insertMany(PROMOTIONS_SEED);
  console.log(`📢 Created ${PROMOTIONS_SEED.length} promotions`);

  // ── Create shouts ──────────────────────────────────────────────────────────
  const shoutContents = [
    '有人想约去KLCC附近散步吗？😊',
    '今晚在Bangsar，有人要来聊天吗？',
    '寻找有趣的朋友，喜欢旅行和咖啡的来~',
    'Looking for friends in PJ area!',
    '有人喜欢户外活动吗？我每周末都去徒步',
  ];

  const shoutDocs = shoutContents.map((content, i) => ({
    user: userDocs[i]._id,
    content,
    location: { type: 'Point', coordinates: jitter(KL_CENTER, 15) },
    expiresAt: new Date(Date.now() + (12 + i * 2) * 3600000),
  }));
  await Shout.insertMany(shoutDocs);
  console.log(`📣 Created ${shoutDocs.length} shouts`);

  // ── Create gifts ───────────────────────────────────────────────────────────
  const GIFTS_SEED = [
    // Romantic
    { name: 'Rose', icon: '🌹', price: 10, category: 'romantic', sortOrder: 1 },
    { name: 'Bouquet', icon: '💐', price: 50, category: 'romantic', sortOrder: 2 },
    { name: 'Heart Box', icon: '💝', price: 100, category: 'romantic', sortOrder: 3 },
    { name: 'Ring', icon: '💍', price: 200, category: 'romantic', sortOrder: 4 },
    // Fun
    { name: 'Beer', icon: '🍺', price: 5, category: 'fun', sortOrder: 1 },
    { name: 'Cake', icon: '🎂', price: 15, category: 'fun', sortOrder: 2 },
    { name: 'Star', icon: '⭐', price: 20, category: 'fun', sortOrder: 3 },
    { name: 'Gift Box', icon: '🎁', price: 30, category: 'fun', sortOrder: 4 },
    // Luxury
    { name: 'Crown', icon: '👑', price: 500, category: 'luxury', sortOrder: 1 },
    { name: 'Sports Car', icon: '🏎️', price: 1000, category: 'luxury', sortOrder: 2 },
    { name: 'Villa', icon: '🏠', price: 2000, category: 'luxury', sortOrder: 3 },
    { name: 'Diamond', icon: '💎', price: 5000, category: 'luxury', sortOrder: 4 },
  ];
  const giftDocs = await Gift.insertMany(GIFTS_SEED);
  console.log(`🎁 Created ${giftDocs.length} gifts`);

  // A few gift transactions
  await GiftTransaction.insertMany([
    { sender: userDocs[1]._id, receiver: userDocs[0]._id, gift: giftDocs[0]._id, coins: 10, message: '送你一朵玫瑰 😊' },
    { sender: userDocs[2]._id, receiver: userDocs[0]._id, gift: giftDocs[3]._id, coins: 200, message: '你很帅！' },
    { sender: userDocs[0]._id, receiver: userDocs[1]._id, gift: giftDocs[4]._id, coins: 5 },
  ]);
  console.log('💸 Created gift transactions');

  // ── Create moments ─────────────────────────────────────────────────────────
  const momentContents = [
    { content: '今天天气真好，在KLCC散步 ☀️', user: 0 },
    { content: '刚健身完，感觉很棒！💪 #gym #fitness', user: 1 },
    { content: '周末在Bangsar发现了一家超好吃的咖啡厅 ☕', user: 2 },
    { content: '有人想一起去徒步吗？下周末Broga Hill 🏔️', user: 3 },
    { content: '在想念新加坡的朋友们 🇸🇬', user: 16 },
  ];

  const momentDocs = await Moment.insertMany(
    momentContents.map((m) => ({
      user: userDocs[m.user]._id,
      content: m.content,
      images: [],
      likes: [userDocs[m.user + 1 < userDocs.length ? m.user + 1 : 0]._id],
      commentsCount: 1,
      location: { type: 'Point', coordinates: jitter(KL_CENTER, 10) },
      hasLocation: true,
      visibility: 'public',
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
    }))
  );

  // A few comments
  await MomentComment.insertMany(
    momentDocs.slice(0, 3).map((m, i) => ({
      moment: m._id,
      user: userDocs[i + 1]._id,
      content: ['好羡慕！', '我也想去！😍', '下次叫我！'][i],
    }))
  );
  console.log(`📸 Created ${momentDocs.length} moments`);

  // ── Create events ──────────────────────────────────────────────────────────
  const nextWeek = (days) => new Date(Date.now() + days * 86400000);

  await Event.insertMany([
    {
      organizer: userDocs[0]._id,
      title: 'Rainbow Makan Night 🌈',
      description: '同志聚餐之夜！欢迎所有人加入，我们将在KL市中心一家精致餐厅享用美食。价格包含3道菜套餐。',
      venue: 'Nobu KL',
      address: 'Level 56, Menara 3 Petronas, KLCC, Kuala Lumpur',
      location: { type: 'Point', coordinates: [101.7124, 3.1578] },
      date: nextWeek(7),
      endDate: nextWeek(7.125),
      maxAttendees: 20,
      price: 30,
      currency: 'MYR',
      category: 'makan',
      tags: ['dinner', 'socialise', 'rainbow'],
      attendees: [
        { user: userDocs[0]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[1]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[2]._id, status: 'interested' },
      ],
    },
    {
      organizer: userDocs[3]._id,
      title: 'Gym Buddies Meetup 💪',
      description: '一起训练，共同进步！适合所有健身程度。训练后一起吃蛋白早餐。',
      venue: 'Fitness First Bukit Jalil',
      address: 'Pavilion Bukit Jalil, Kuala Lumpur',
      location: { type: 'Point', coordinates: [101.6835, 3.0567] },
      date: nextWeek(3),
      endDate: nextWeek(3.083),
      maxAttendees: 10,
      price: 0,
      currency: 'MYR',
      category: 'sports',
      tags: ['gym', 'fitness', 'free'],
      attendees: [
        { user: userDocs[3]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[4]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[5]._id, status: 'going', paidAt: new Date() },
      ],
    },
    {
      organizer: userDocs[5]._id,
      title: 'Movie Night 🎬',
      description: '一起去看最新大片！Pavilion KL的IMAX厅。看完电影可以在Pavilion逛街或者吃饭。',
      venue: 'GSC IMAX Pavilion KL',
      address: '168 Jalan Bukit Bintang, Kuala Lumpur',
      location: { type: 'Point', coordinates: [101.7136, 3.1488] },
      date: nextWeek(5),
      endDate: nextWeek(5.125),
      maxAttendees: 15,
      price: 15,
      currency: 'MYR',
      category: 'hangout',
      tags: ['movie', 'imax', 'pavilion'],
      attendees: [
        { user: userDocs[5]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[6]._id, status: 'going', paidAt: new Date() },
        { user: userDocs[7]._id, status: 'interested' },
        { user: userDocs[8]._id, status: 'interested' },
      ],
    },
  ]);
  console.log('🎉 Created 3 events');

  // ── Sticker packs ──────────────────────────────────────────────────────────
  await StickerPack.deleteMany({});
  await StickerPack.insertMany([
    {
      name: '基础表情',
      description: '最常用的表情包，完全免费！',
      coverEmoji: '😀',
      price: 0,
      category: 'free',
      stickers: ['😀','😂','🥰','😘','🤗','😍','🥺','😎'].map((e, i) => ({ id: `basic_${i}`, emoji: e })),
    },
    {
      name: '彩虹骄傲',
      description: '彩虹骄傲贴纸包，为爱庆祝！',
      coverEmoji: '🏳️‍🌈',
      price: 30,
      category: 'popular',
      stickers: ['🏳️‍🌈','🌈','✨','💜','💙','💚','💛','❤️'].map((e, i) => ({ id: `pride_${i}`, emoji: e })),
    },
    {
      name: '可爱熊',
      description: '超萌小熊贴纸，让对话更温暖',
      coverEmoji: '🐻',
      price: 50,
      category: 'new',
      stickers: ['🐻','🧸','🐨','🐼','🍯','🎀','💕','🌸'].map((e, i) => ({ id: `bear_${i}`, emoji: e })),
    },
    {
      name: '夜生活',
      description: '派对夜生活贴纸，点燃你的夜晚！',
      coverEmoji: '🍸',
      price: 80,
      category: 'premium',
      stickers: ['🍸','🎵','🕺','💃','🌙','🔥','🎉','✨'].map((e, i) => ({ id: `night_${i}`, emoji: e })),
    },
  ]);
  console.log('🎨 Created 4 sticker packs');

  // Give first user the free pack automatically
  await User.findByIdAndUpdate(userDocs[0]._id, {
    $addToSet: { ownedStickerPacks: (await StickerPack.findOne({ price: 0 }))._id },
  });

  // ── Print test account info ────────────────────────────────────────────────
  console.log('\n✅ Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Test accounts (password: password123)');
  userDocs.slice(0, 5).forEach((u) => {
    const label = u.isPremium ? '[Premium]' : '[Free]';
    console.log(`   ${label} ${u.email}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
