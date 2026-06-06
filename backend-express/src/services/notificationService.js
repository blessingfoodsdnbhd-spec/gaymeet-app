const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { sendPushToUser } = require('../utils/push');

// Types the user can never turn off (and that ignore quiet hours for push).
const HIGH_PRIORITY = new Set(['match', 'dm', 'note', 'room_invite', 'room_kick']);

// All notification types the preferences UI knows about (high-priority ones are
// shown but locked ON). Keep in sync with the client toggle list.
const ALL_TYPES = [
  'match',
  'note',
  'follow',
  'room_invite',
  'vote_first_vote',
  'vote_ending_24h',
  'vote_ending_1h',
  'vote_ended',
  'vote_result',
  'viewers_digest',
  'wants_you_digest',
  'daily_digest',
  'comeback',
];

function inQuietHours(pref, now = new Date()) {
  if (!pref || pref.quietStartHour == null || pref.quietEndHour == null) return false;
  const s = pref.quietStartHour;
  const e = pref.quietEndHour;
  if (s === e) return false;
  const h = now.getUTCHours();
  return s < e ? h >= s && h < e : h >= s || h < e; // wraps midnight
}

async function getPref(userId) {
  try {
    return await NotificationPreference.findOne({ userId }).lean();
  } catch (_) {
    return null;
  }
}

// In-memory coalescing ledger (key -> last epoch ms). Single-process is fine
// for our scale; a periodic sweep keeps the map small.
const _coalesce = new Map();
function coalesceOk(key, windowMs) {
  const now = Date.now();
  const prev = _coalesce.get(key) || 0;
  if (now - prev < windowMs) return false;
  _coalesce.set(key, now);
  return true;
}
setInterval(() => {
  const cut = Date.now() - 6 * 60 * 60 * 1000;
  for (const [k, v] of _coalesce) if (v < cut) _coalesce.delete(k);
}, 60 * 60 * 1000).unref?.();

/**
 * Persist a notification record and (unless suppressed) fire the FCM push.
 * Order matters: the record is written BEFORE the push so the Notification
 * Center shows it even if delivery fails. Never throws.
 *
 * @returns the created Notification doc, or null if the user disabled this type.
 */
async function notify(userId, type, { title = '', body = '', data = {}, push = true } = {}) {
  if (!userId) return null;
  try {
    const high = HIGH_PRIORITY.has(type);
    const pref = high ? null : await getPref(userId);
    if (!high && pref && Array.isArray(pref.disabled) && pref.disabled.includes(type)) {
      return null; // user opted out — don't persist or push
    }
    const doc = await Notification.create({ userId, type, title, body, data: data || {} });
    if (push) {
      const quiet = !high && inQuietHours(pref);
      if (!quiet) {
        sendPushToUser(userId, {
          title,
          body,
          data: { ...data, type, notifId: doc._id.toString() },
        }).catch(() => {});
      }
    }
    return doc;
  } catch (_) {
    return null;
  }
}

/**
 * Has this user already received a (type[, data.<key>=value]) notification in
 * the last `sinceMs`? Used by scheduled jobs to dedupe across the polling
 * interval and across process restarts (the persisted record is the ledger).
 */
async function alreadyNotified(userId, type, dataKey, value, sinceMs) {
  try {
    const q = { userId, type };
    if (dataKey) q[`data.${dataKey}`] = value;
    if (sinceMs) q.createdAt = { $gte: new Date(Date.now() - sinceMs) };
    return !!(await Notification.exists(q));
  } catch (_) {
    return true; // on error, assume already sent (fail safe = don't spam)
  }
}

module.exports = { notify, coalesceOk, alreadyNotified, inQuietHours, HIGH_PRIORITY, ALL_TYPES };
