/**
 * Chat-XP / leveling helper (吹水等级). Single entry point `awardXP()` keeps every
 * XP mutation (message, daily-online, channel-join, bonus) consistent: it upserts
 * the UserXP doc, recomputes the level from the threshold table, and appends an
 * XPEvent to the ledger. Distinct from the energy-based User.level system.
 */
const UserXP = require('../models/UserXP');
const XPEvent = require('../models/XPEvent');

// Cumulative-XP thresholds. Named tiers come from the spec; the in-between
// numeric levels keep the progress bar moving between named milestones.
const LEVELS = [
  { level: 1,  xp: 0,      i18nKey: 'level.lv1' },   // 新人
  { level: 2,  xp: 100,    i18nKey: 'level.lv2' },
  { level: 3,  xp: 300,    i18nKey: 'level.lv3' },
  { level: 4,  xp: 600,    i18nKey: 'level.lv4' },
  { level: 5,  xp: 1000,   i18nKey: 'level.lv5' },   // 常客
  { level: 6,  xp: 1800,   i18nKey: 'level.lv6' },
  { level: 7,  xp: 2800,   i18nKey: 'level.lv7' },
  { level: 8,  xp: 3800,   i18nKey: 'level.lv8' },
  { level: 9,  xp: 4500,   i18nKey: 'level.lv9' },
  { level: 10, xp: 5000,   i18nKey: 'level.lv10' },  // 资深成员
  { level: 12, xp: 9000,   i18nKey: 'level.lv12' },
  { level: 15, xp: 20000,  i18nKey: 'level.lv15' },
  { level: 18, xp: 50000,  i18nKey: 'level.lv18' },
  { level: 20, xp: 100000, i18nKey: 'level.lv20' },  // 传奇吹水王
];

const MESSAGE_XP = 1;
const DAILY_MESSAGE_CAP = 100;   // max XP/day from messages (anti-spam)
const DAILY_ONLINE_XP = 5;       // for being online > 30 min in a day
const ONLINE_MIN_THRESHOLD = 30; // minutes online to qualify
const CHANNEL_JOIN_XP = 50;      // first time joining a given channel

const DAY = 24 * 60 * 60 * 1000;

/** The highest tier whose threshold is ≤ totalXP. */
function tierFor(totalXP) {
  let cur = LEVELS[0];
  for (const t of LEVELS) {
    if (totalXP >= t.xp) cur = t;
    else break;
  }
  return cur;
}

/** Full level snapshot for a totalXP value — what the client renders. */
function levelInfo(totalXP) {
  const xp = Math.max(0, Number(totalXP) || 0);
  const cur = tierFor(xp);
  const next = LEVELS.find((t) => t.xp > cur.xp) || null;
  const span = next ? next.xp - cur.xp : 0;
  const into = xp - cur.xp;
  return {
    totalXP: xp,
    level: cur.level,
    levelName: cur.i18nKey,
    currentLevelXP: cur.xp,
    nextLevelXP: next ? next.xp : null,
    nextLevel: next ? next.level : null,
    // 0..1 progress toward the next tier (1 when maxed out).
    progress: next ? Math.max(0, Math.min(1, into / span)) : 1,
  };
}

const utcDateKey = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Core mutation. Increments totalXP, recomputes level, writes a ledger row.
 * Best-effort — callers fire-and-forget; never let an XP failure break chat.
 * @returns {{ totalXP:number, level:number, leveledUp:boolean }}
 */
async function awardXP(userId, amount, reason, roomId = null) {
  if (!userId || !amount) return null;
  const before = await UserXP.findOne({ userId }).select('level').lean();
  const prevLevel = before?.level ?? 1;

  const doc = await UserXP.findOneAndUpdate(
    { userId },
    { $inc: { totalXP: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const info = levelInfo(doc.totalXP);
  if (info.level !== doc.level) {
    doc.level = info.level;
    await doc.save();
  }

  XPEvent.create({ userId, roomId, amount, reason }).catch(() => {});
  return { totalXP: doc.totalXP, level: info.level, leveledUp: info.level > prevLevel };
}

/**
 * Award 1 XP for a chat message, capped at DAILY_MESSAGE_CAP/day. The cap is
 * enforced by summing today's 'message' ledger rows — cheap and restart-safe.
 */
async function awardMessageXP(userId, roomId = null) {
  try {
    const since = new Date(Date.now() - DAY);
    const todays = await XPEvent.aggregate([
      { $match: { userId: typeof userId === 'string' ? require('mongoose').Types.ObjectId.createFromHexString(userId) : userId, reason: 'message', createdAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const earned = todays[0]?.total ?? 0;
    if (earned >= DAILY_MESSAGE_CAP) return null;
    return await awardXP(userId, MESSAGE_XP, 'message', roomId);
  } catch (_) {
    return null;
  }
}

/** First-time channel-join bonus (once per user per channel). */
async function awardChannelJoinXP(userId, roomId) {
  try {
    const xp = await UserXP.findOne({ userId }).select('joinedChannels').lean();
    if (xp?.joinedChannels?.includes(roomId)) return null;
    await UserXP.updateOne({ userId }, { $addToSet: { joinedChannels: roomId } }, { upsert: true });
    return await awardXP(userId, CHANNEL_JOIN_XP, 'channel_join', roomId);
  } catch (_) {
    return null;
  }
}

/** Daily online bonus, guarded to once per UTC day per user. */
async function awardDailyOnlineXP(userId, minutes) {
  try {
    if (minutes < ONLINE_MIN_THRESHOLD) return null;
    const today = utcDateKey();
    const xp = await UserXP.findOne({ userId }).select('lastDailyClaim').lean();
    if (xp?.lastDailyClaim === today) return null;
    await UserXP.updateOne({ userId }, { $set: { lastDailyClaim: today } }, { upsert: true });
    return await awardXP(userId, DAILY_ONLINE_XP, 'daily', null);
  } catch (_) {
    return null;
  }
}

/** Level for one user (defaults to Lv1 when they have no XP doc yet). */
async function levelForUser(userId) {
  const xp = await UserXP.findOne({ userId }).select('level totalXP').lean();
  return xp?.level ?? 1;
}

/** Batch level lookup: Map(userIdString -> level). Missing users default to 1. */
async function levelsForUsers(userIds) {
  const out = new Map();
  if (!userIds?.length) return out;
  const rows = await UserXP.find({ userId: { $in: userIds } }).select('userId level').lean();
  for (const r of rows) out.set(r.userId.toString(), r.level);
  return out;
}

module.exports = {
  LEVELS,
  levelInfo,
  awardXP,
  awardMessageXP,
  awardChannelJoinXP,
  awardDailyOnlineXP,
  levelForUser,
  levelsForUsers,
  MESSAGE_XP,
  DAILY_MESSAGE_CAP,
};
