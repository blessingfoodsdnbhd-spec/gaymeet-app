const VoteEvent = require('../models/VoteEvent');
const VoteEntry = require('../models/VoteEntry');
const User = require('../models/User');
const ProfileView = require('../models/ProfileView');
const Swipe = require('../models/Swipe');
const ChatRoom = require('../models/ChatRoom');
const WorldChatMessage = require('../models/WorldChatMessage');
const RoomMembership = require('../models/RoomMembership');
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

/**
 * "今日缘分" — daily recommendations nudge at ~10am LOCAL time. Unlike the other
 * digests (which fire at a single fixed UTC hour), this one must land in each
 * user's morning, so it runs on every 15-min tick and self-filters: a user's
 * local hour is derived coarsely from their longitude (≈15° per hour), and only
 * those currently at local-hour 10 are pushed. The 20h dedup window makes the
 * four in-hour ticks idempotent. The push is a nudge that deep-links into
 * Discover, where the actual interest+geo-ranked picks are computed on open —
 * we deliberately avoid a per-user geoNear here (too heavy for the free tier).
 */
async function dailyMatchesDigest() {
  const utcHour = new Date().getUTCHours();
  const users = await User.find({
    fcmToken: { $ne: null },
    lastActiveAt: { $gt: new Date(Date.now() - 14 * DAY) },
  })
    .select('_id location')
    .limit(5000)
    .lean();
  for (const u of users) {
    const lng = u.location?.coordinates?.[0] ?? 0;
    const offset = Math.round(lng / 15); // coarse tz from longitude
    const localHour = (((utcHour + offset) % 24) + 24) % 24;
    if (localHour !== 10) continue;
    if (await alreadyNotified(u._id, 'daily_matches', null, null, 20 * HOUR)) continue;
    await notify(u._id, 'daily_matches', {
      i18n: {
        en: { title: "Today's picks 💘", body: "We've lined up new people for you — come see today's matches" },
        zh: { title: '今日缘分 💘', body: '为你挑选了新的人选 — 来看看今天的推荐' },
        ja: { title: '今日のおすすめ 💘', body: '新しい出会いを用意しました — 今日のおすすめをチェック' },
        ko: { title: '오늘의 인연 💘', body: '새로운 추천을 준비했어요 — 오늘의 매칭을 확인하세요' },
      },
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
    // Local-10am gated internally, so it must run on every tick (not a fixed UTC hour).
    await dailyMatchesDigest();
  } catch (_) {
    /* best-effort */
  }
}

/**
 * Every 10 min: delete custom World-Chat rooms that have gone fully cold.
 * Build 102 §A raised the window from 3 → 30 days so "我开的房间 / 我在的房间"
 * history persists for the retention period; only rooms abandoned for ≥30 days
 * (and with nobody connected) are reclaimed. Rooms with 无限 retention
 * (retentionDays === 0, Premium) are never auto-deleted. Memberships are
 * cascaded so subscribers' lists self-heal. Broadcasts world-chat:room-deleted
 * so any lingering client is bounced to the world room.
 */
async function emptyRoomSweep() {
  try {
    const cutoff = new Date(Date.now() - 30 * DAY);
    const stale = await ChatRoom.find({
      lastActiveAt: { $lt: cutoff },
      createdAt: { $lt: cutoff },
      retentionDays: { $ne: 0 }, // keep 无限-retention rooms forever
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
        RoomMembership.deleteMany({ roomId: id }),
      ]);
      if (io) io.emit('world-chat:room-deleted', { roomId: id });
    }
  } catch (_) {
    /* best-effort */
  }
}

/**
 * Build 102 §A — message retention sweep (replaces the old fixed 7-day TTL on
 * WorldChatMessage). Runs every 6h:
 *   - Official / virtual lobby rooms (roomId not a 24-hex ChatRoom id, incl.
 *     legacy null roomIds) keep only ~24h of history — they're live-focused.
 *   - Custom (user-created) rooms keep messages for their retentionDays
 *     (7 / 30, default 30); retentionDays === 0 means 无限 (Premium) → skipped.
 */
async function roomMessageSweep() {
  try {
    const now = Date.now();
    // Virtual/official rooms — 24h window.
    await WorldChatMessage.deleteMany({
      roomId: { $not: /^[a-f0-9]{24}$/i },
      createdAt: { $lt: new Date(now - DAY) },
    });
    // Custom rooms — per-room retention.
    const rooms = await ChatRoom.find({}).select('_id retentionDays').lean();
    for (const r of rooms) {
      const days = r.retentionDays == null ? 30 : r.retentionDays;
      if (!days || days <= 0) continue; // 无限
      await WorldChatMessage.deleteMany({
        roomId: r._id.toString(),
        createdAt: { $lt: new Date(now - days * DAY) },
      });
    }
  } catch (_) {
    /* best-effort */
  }
}

function startNotificationJobs() {
  if (process.env.NODE_ENV === 'test') return;

  // App-initiated scheduled "digest / promotional" pushes are OFF by default:
  //   - voteDeadlineSweep → vote_ending_24h / vote_ending_1h (投票倒计时)
  //   - comebackSweep     → comeback (想你了)
  //   - dailyTick         → daily_matches (今日缘分), daily_digest (今日热门活动),
  //                         viewers_digest (看了你), wants_you_digest (想认识你)
  // Set ENABLE_DIGEST_PUSH=1 in the API env to re-enable them. This does NOT
  // affect event-driven pushes (message / match / dm / @mention / room invite /
  // vote result) or the data-cleanup sweeps below — those always run.
  if (process.env.ENABLE_DIGEST_PUSH === '1') {
    setInterval(voteDeadlineSweep, 60 * 1000).unref?.();
    setInterval(comebackSweep, 60 * 60 * 1000).unref?.();
    setInterval(dailyTick, 15 * 60 * 1000).unref?.();
    console.log('[notifications] digest/promo push jobs ENABLED (ENABLE_DIGEST_PUSH=1)');
  } else {
    console.log('[notifications] digest/promo push jobs DISABLED (set ENABLE_DIGEST_PUSH=1 to enable)');
  }

  // Data-cleanup sweeps — these never push to users; always run.
  setInterval(emptyRoomSweep, 10 * 60 * 1000).unref?.();
  setTimeout(roomMessageSweep, 60 * 1000).unref?.(); // first pass ~1min after boot
  setInterval(roomMessageSweep, 6 * 60 * 60 * 1000).unref?.();
  console.log('[notifications] scheduled jobs started');
}

module.exports = { startNotificationJobs };
