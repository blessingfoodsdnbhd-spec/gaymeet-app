// Daily-login streak (STREAK1). Called fire-and-forget from the auth
// middleware on each authenticated request; writes to the DB at most once per
// UTC day per user, and grants a Premium reward at milestone streaks.
const User = require('../models/User');
const { notify } = require('../services/notificationService');

function ymd(d) {
  return d.toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

// streak length → Premium days granted
const REWARDS = { 7: 1, 14: 3, 30: 7 };

async function grantStreakReward(user, milestone) {
  const days = REWARDS[milestone];
  if (!days) return;
  const now = new Date();
  const base =
    user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now
      ? new Date(user.premiumExpiresAt)
      : now;
  base.setDate(base.getDate() + days);
  await User.updateOne(
    { _id: user._id },
    { $set: { isPremium: true, premiumExpiresAt: base } },
  );
  notify(user._id, 'system', {
    title: '🔥 连续登录奖励',
    body: `你已连续登录 ${milestone} 天,获得 ${days} 天会员!`,
    data: { kind: 'streak', milestone, premiumDays: days },
    i18n: {
      zh: { title: '🔥 连续登录奖励', body: `你已连续登录 ${milestone} 天,获得 ${days} 天会员!` },
      en: { title: '🔥 Login streak reward', body: `${milestone}-day streak! You earned ${days} days of Premium.` },
      ko: { title: '🔥 연속 출석 보상', body: `${milestone}일 연속 출석으로 프리미엄 ${days}일을 받았어요!` },
      ja: { title: '🔥 連続ログイン報酬', body: `${milestone}日連続ログインでプレミアム${days}日を獲得しました！` },
    },
  }).catch(() => {});
}

/**
 * Advance the user's login streak. No-op if already counted today. Uses a
 * conditional update guarded on lastActiveDate so concurrent same-day requests
 * don't double-increment. Never throws — safe to fire-and-forget on the hot
 * auth path.
 */
async function touchStreak(user) {
  try {
    const today = ymd(new Date());
    const s = user.streak || {};
    if (s.lastActiveDate === today) return; // already counted today

    const yesterday = ymd(new Date(Date.now() - 86400000));
    const current = s.lastActiveDate === yesterday ? (s.current || 0) + 1 : 1;
    const longest = Math.max(s.longest || 0, current);

    const r = await User.updateOne(
      { _id: user._id, 'streak.lastActiveDate': { $ne: today } },
      {
        $set: {
          'streak.current': current,
          'streak.longest': longest,
          'streak.lastActiveDate': today,
        },
      },
    );
    const changed = (r.modifiedCount ?? r.nModified ?? 0) > 0;
    if (changed && REWARDS[current]) {
      await grantStreakReward(user, current);
    }
  } catch {
    // never disrupt the request over a gamification write
  }
}

module.exports = { touchStreak };
