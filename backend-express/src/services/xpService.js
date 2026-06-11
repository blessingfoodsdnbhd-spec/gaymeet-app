/**
 * Plaza chat XP service — Phase 4 spec §9.2. Awards experience for chatting and
 * daily logins, with anti-grind protection, then derives the user's level from
 * a static table. `currentExp` is the lifetime cumulative XP that drives level;
 * `chatXp` holds today's counters for the daily caps.
 *
 * Spec §9.2.2 XP sources implemented here:
 *   - send a message            +1   (≤100 scoring msgs/day)
 *   - daily first login         +10  (1×/day)
 * §9.2.2 sources NOT yet wired (need infra that doesn't exist): likes/reactions
 *   (+2), 30-min continuous presence (+5), create-room-with-visitors (+20),
 *   moderator "active user" nomination (+50). TODO when those systems land.
 *
 * §9.2.3 anti-grind rules implemented:
 *   1. multiple messages within the same second → only 1 scores
 *   2. repeated message (identical to the previous) → no score
 *   3. pure-emoji / sticker-only message → no score
 *   4. daily total XP cap = 300 (covers ALL sources); resets at UTC midnight
 */
const User = require('../models/User');
const { levelForXp, titleKeyForLevel } = require('../config/xpTable');

const DAILY_TOTAL_CAP = 300; // spec §9.2.3 rule 4
const DAILY_MSG_CAP = 100; // spec §9.2.2 — at most 100 scoring messages/day
const MSG_XP = 1;
const LOGIN_XP = 10;

const utcDay = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

/** True when text is empty or contains only emoji / pictographs / whitespace. */
function isEmojiOnly(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  // Strip emoji, variation selectors, ZWJ, skin tones, and whitespace.
  const stripped = t
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, '');
  return stripped.length === 0;
}

/** Today's chatXp counters, normalized + rolled over if it's a new UTC day. */
function todaysCounters(user) {
  const c = user.chatXp || {};
  if (c.date !== utcDay()) {
    return { date: utcDay(), total: 0, msgCount: 0, lastBody: '', lastMs: 0, loginDate: c.loginDate || null };
  }
  return {
    date: c.date,
    total: c.total || 0,
    msgCount: c.msgCount || 0,
    lastBody: c.lastBody || '',
    lastMs: c.lastMs || 0,
    loginDate: c.loginDate || null,
  };
}

/** Recompute level from cumulative XP; persist + return level-up info. */
function applyXp(user, addXp, counters) {
  const before = typeof user.level === 'number' && user.level >= 1 ? user.level : levelForXp(user.currentExp || 0);
  const newExp = (user.currentExp || 0) + addXp;
  const after = levelForXp(newExp);

  // Persist atomically; keep the in-memory doc consistent for the rest of req.
  user.currentExp = newExp;
  user.level = after;
  user.chatXp = counters;
  User.updateOne(
    { _id: user._id },
    { $set: { currentExp: newExp, level: after, chatXp: counters } },
  ).catch(() => {});

  return after > before
    ? { awarded: addXp, leveledUp: true, newLevel: after, titleKey: titleKeyForLevel(after) }
    : { awarded: addXp, leveledUp: false, newLevel: after, titleKey: null };
}

/**
 * Award XP for a sent text message. `body` is the trimmed message text.
 * Returns null when nothing scored (anti-grind / caps), else level-up info.
 */
function awardMessageXp(user, body) {
  if (!user) return null;
  const text = String(body || '').trim();
  if (isEmojiOnly(text)) return null; // rule 3

  const c = todaysCounters(user);
  const now = Date.now();
  if (now - c.lastMs < 1000) return null; // rule 1 — same-second
  if (text && text === c.lastBody) return null; // rule 2 — repeat
  if (c.msgCount >= DAILY_MSG_CAP) return null; // §9.2.2 per-source cap
  if (c.total >= DAILY_TOTAL_CAP) return null; // rule 4 — daily total cap

  const gain = Math.min(MSG_XP, DAILY_TOTAL_CAP - c.total);
  if (gain <= 0) return null;

  return applyXp(user, gain, {
    date: c.date,
    total: c.total + gain,
    msgCount: c.msgCount + 1,
    lastBody: text,
    lastMs: now,
    loginDate: c.loginDate,
  });
}

/**
 * Award the once-per-day login bonus (+10), respecting the daily total cap.
 * Returns level-up info when it leveled the user up, else null.
 */
function awardLoginXp(user) {
  if (!user) return null;
  const c = todaysCounters(user);
  if (c.loginDate === utcDay()) return null; // already claimed today
  const gain = Math.min(LOGIN_XP, DAILY_TOTAL_CAP - c.total);
  const counters = { ...c, loginDate: utcDay(), total: c.total + Math.max(0, gain) };
  if (gain <= 0) {
    // Cap already hit — still mark login claimed so we don't retry all day.
    user.chatXp = counters;
    User.updateOne({ _id: user._id }, { $set: { chatXp: counters } }).catch(() => {});
    return null;
  }
  return applyXp(user, gain, counters);
}

module.exports = { awardMessageXp, awardLoginXp, isEmojiOnly, DAILY_TOTAL_CAP, DAILY_MSG_CAP };
