const VoteEvent = require('../models/VoteEvent');
const VoteEntry = require('../models/VoteEntry');
const User = require('../models/User');
const ProfileView = require('../models/ProfileView');
const Swipe = require('../models/Swipe');
const ChatRoom = require('../models/ChatRoom');
const WorldChatMessage = require('../models/WorldChatMessage');
const { notify, alreadyNotified } = require('./notificationService');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * Every 60s: warn creators when their contest has <24h left, and entrants when
 * it has <1h left (so they can rally votes). Dedupe is via the persisted
 * Notification ledger, so each fires exactly once even across restarts.
 */
async function voteDeadlineSweep() {
  try {
    const now = Date.now();

    const soon24 = await VoteEvent.find({
      status: 'active',
      endAt: { $gt: new Date(now), $lte: new Date(now + DAY) },
    })
      .select('title creatorId')
      .lean();
    for (const ev of soon24) {
      const id = ev._id.toString();
      if (await alreadyNotified(ev.creatorId, 'vote_ending_24h', 'eventId', id)) continue;
      await notify(ev.creatorId, 'vote_ending_24h', {
        title: '比赛即将结束 ⏳',
        body: `「${ev.title}」还有不到 24 小时`,
        data: { eventId: id },
      });
    }

    const soon1 = await VoteEvent.find({
      status: 'active',
      endAt: { $gt: new Date(now), $lte: new Date(now + HOUR) },
    })
      .select('title')
      .lean();
    for (const ev of soon1) {
      const id = ev._id.toString();
      const entrantIds = await VoteEntry.find({ eventId: ev._id }).distinct('submitterId');
      for (const uid of entrantIds) {
        if (await alreadyNotified(uid, 'vote_ending_1h', 'eventId', id)) continue;
        await notify(uid, 'vote_ending_1h', {
          title: '最后一小时!⏰',
          body: `「${ev.title}」即将结束,快邀请朋友来投票`,
          data: { eventId: id },
        });
      }
    }
  } catch (_) {
    /* best-effort */
  }
}

/** Hourly: nudge users who've been away 3–30 days, at most once per 7 days. */
async function comebackSweep() {
  try {
    const now = Date.now();
    const users = await User.find({
      fcmToken: { $ne: null },
      lastActiveAt: { $lt: new Date(now - 3 * DAY), $gt: new Date(now - 30 * DAY) },
    })
      .select('_id')
      .limit(200)
      .lean();
    for (const u of users) {
      if (await alreadyNotified(u._id, 'comeback', null, null, 7 * DAY)) continue;
      await notify(u._id, 'comeback', {
        title: '想你了 👋',
        body: '看看附近有什么新朋友吧',
        data: {},
      });
    }
  } catch (_) {
    /* best-effort */
  }
}

/** Daily 8pm UTC: "N people viewed your profile today". */
async function viewersDigest() {
  const since = new Date(Date.now() - DAY);
  const groups = await ProfileView.aggregate([
    { $match: { viewedAt: { $gte: since } } },
    { $group: { _id: '$viewedId', n: { $sum: 1 } } },
    { $limit: 5000 },
  ]);
  for (const g of groups) {
    if (!g._id || !g.n) continue;
    if (await alreadyNotified(g._id, 'viewers_digest', null, null, 20 * HOUR)) continue;
    await notify(g._id, 'viewers_digest', {
      title: '今天有人看了你 👀',
      body: `${g.n} 人今天看了你的 profile`,
      data: { count: g.n },
    });
  }
}

/** Daily 8pm UTC: "N new people want to know you". */
async function wantsYouDigest() {
  const since = new Date(Date.now() - DAY);
  const groups = await Swipe.aggregate([
    { $match: { direction: { $in: ['like', 'super_like'] }, createdAt: { $gte: since } } },
    { $group: { _id: '$toUser', n: { $sum: 1 } } },
    { $limit: 5000 },
  ]);
  for (const g of groups) {
    if (!g._id || !g.n) continue;
    if (await alreadyNotified(g._id, 'wants_you_digest', null, null, 20 * HOUR)) continue;
    await notify(g._id, 'wants_you_digest', {
      title: '有人想认识你 💘',
      body: `${g.n} 位新朋友想认识你`,
      data: { count: g.n },
    });
  }
}

/** Daily 8am UTC: the 3 hottest active contests → users active in the last
 *  14 days who haven't turned the digest off. Deduped per-user-per-day. */
async function hotEventsDigest() {
  const top = await VoteEvent.find({ status: 'active' })
    .sort({ voteCount: -1, updatedAt: -1 })
    .limit(3)
    .select('title')
    .lean();
  if (!top.length) return;
  const titles = top.map((e) => e.title).join(' · ');
  const users = await User.find({
    fcmToken: { $ne: null },
    lastActiveAt: { $gt: new Date(Date.now() - 14 * DAY) },
  })
    .select('_id')
    .limit(2000)
    .lean();
  for (const u of users) {
    if (await alreadyNotified(u._id, 'daily_digest', null, null, 20 * HOUR)) continue;
    await notify(u._id, 'daily_digest', {
      title: '今日热门活动 🔥',
      body: `${titles} — 来投票吧`,
      data: {},
    });
  }
}

// Fires every 15 min; daily digests run only on their target UTC hour, deduped
// per-user-per-day by the ledger so the multiple in-hour ticks are safe.
async function dailyTick() {
  try {
    const hour = new Date().getUTCHours();
    if (hour === 8) {
      await hotEventsDigest();
    } else if (hour === 20) {
      await viewersDigest();
      await wantsYouDigest();
    }
  } catch (_) {
    /* best-effort */
  }
}

/**
 * Every 10 min: delete custom World-Chat rooms that have gone cold — no activity
 * for ≥3h AND nobody currently connected. `lastActiveAt` (bumped on every
 * message) is the reliable persisted signal; the live socket count guards
 * against deleting a room people are sitting in; the createdAt guard avoids
 * nuking brand-new empty rooms. Broadcasts world-chat:room-deleted so any
 * lingering client in the room is bounced back to the world room.
 */
async function emptyRoomSweep() {
  try {
    const cutoff = new Date(Date.now() - 3 * HOUR);
    const stale = await ChatRoom.find({
      lastActiveAt: { $lt: cutoff },
      createdAt: { $lt: cutoff },
    }).select('_id').lean();
    if (!stale.length) return;

    let io = null;
    let roomOnlineCount = () => 0;
    try {
      const s = require('./socketService');
      io = s.getIO();
      if (typeof s.roomOnlineCount === 'function') roomOnlineCount = s.roomOnlineCount;
    } catch (_) {}

    for (const r of stale) {
      const id = r._id.toString();
      if (roomOnlineCount(id) > 0) continue; // someone is still in it — keep
      await Promise.all([
        ChatRoom.deleteOne({ _id: r._id }),
        WorldChatMessage.deleteMany({ roomId: id }),
      ]);
      if (io) io.emit('world-chat:room-deleted', { roomId: id });
    }
  } catch (_) {
    /* best-effort */
  }
}

/**
 * UGC topic rooms auto-expire after 7 days with no activity (no message, nobody
 * entered — `lastActivityAt` is bumped on both). One day before, we warn the
 * creator (deduped, so once per room); at 7 days the room + its messages are
 * deleted. A room with someone currently inside is always spared.
 */
const TOPIC_WARN_MS = 6 * DAY;
const TOPIC_DELETE_MS = 7 * DAY;
async function topicRoomSweep() {
  try {
    const UserTopicRoom = require('../models/UserTopicRoom');
    const now = Date.now();

    let io = null;
    let roomOnlineCount = () => 0;
    try {
      const s = require('./socketService');
      io = s.getIO();
      if (typeof s.roomOnlineCount === 'function') roomOnlineCount = s.roomOnlineCount;
    } catch (_) {}

    // 1) Warn creators ~1 day out (inactive 6–7 days), once per room.
    const warning = await UserTopicRoom.find({
      category: 'topic',
      archived: false,
      lastActivityAt: { $gt: new Date(now - TOPIC_DELETE_MS), $lte: new Date(now - TOPIC_WARN_MS) },
    })
      .select('roomId title creatorId')
      .lean();
    for (const r of warning) {
      if (roomOnlineCount(r.roomId) > 0) continue; // active right now — not expiring
      if (await alreadyNotified(r.creatorId, 'topic_room_expiring', 'roomId', r.roomId)) continue;
      await notify(r.creatorId, 'topic_room_expiring', {
        i18n: {
          en: { title: 'Room expiring', body: `Your room "${r.title}" will be deleted tomorrow (no users for 6 days)` },
          zh: { title: '房间即将删除', body: `你的房间「${r.title}」明天将被删除（连续 6 天无人）` },
          ko: { title: '방 삭제 예정', body: `회원님의 방 "${r.title}"이(가) 내일 삭제됩니다 (6일간 이용자 없음)` },
          ja: { title: 'ルーム削除予定', body: `あなたのルーム「${r.title}」は明日削除されます（6日間利用者なし）` },
        },
        data: { roomId: r.roomId },
      }).catch(() => {});
    }

    // 2) Delete rooms inactive ≥7 days (unless someone is in them right now).
    const stale = await UserTopicRoom.find({
      category: 'topic',
      archived: false,
      lastActivityAt: { $lt: new Date(now - TOPIC_DELETE_MS) },
    })
      .select('roomId title creatorId')
      .lean();
    for (const r of stale) {
      if (roomOnlineCount(r.roomId) > 0) continue;
      await Promise.all([
        UserTopicRoom.deleteOne({ roomId: r.roomId }),
        WorldChatMessage.deleteMany({ roomId: r.roomId }),
      ]);
      if (io) io.emit('world-chat:room-deleted', { roomId: r.roomId });
      notify(r.creatorId, 'topic_room_deleted', {
        i18n: {
          en: { title: 'Room deleted', body: `Your room "${r.title}" was deleted` },
          zh: { title: '房间已删除', body: `你的房间「${r.title}」已被删除` },
          ko: { title: '방 삭제됨', body: `회원님의 방 "${r.title}"이(가) 삭제되었습니다` },
          ja: { title: 'ルーム削除', body: `あなたのルーム「${r.title}」は削除されました` },
        },
        data: { roomId: r.roomId },
      }).catch(() => {});
    }
  } catch (_) {
    /* best-effort */
  }
}

function startNotificationJobs() {
  if (process.env.NODE_ENV === 'test') return;
  setInterval(voteDeadlineSweep, 60 * 1000).unref?.();
  setInterval(comebackSweep, 60 * 60 * 1000).unref?.();
  setInterval(dailyTick, 15 * 60 * 1000).unref?.();
  setInterval(emptyRoomSweep, 10 * 60 * 1000).unref?.();
  setInterval(topicRoomSweep, 6 * 60 * 60 * 1000).unref?.(); // UGC 7-day auto-expire
  console.log('[notifications] scheduled jobs started');
}

module.exports = { startNotificationJobs };
