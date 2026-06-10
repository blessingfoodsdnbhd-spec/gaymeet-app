// Meyou — Firebase Cloud Messaging sender.
//
// Reads service account JSON from FIREBASE_SERVICE_ACCOUNT env var,
// supporting both raw JSON and base64-encoded JSON (matches the
// GOOGLE_PLAY_SERVICE_ACCOUNT_JSON pattern). Gracefully no-ops when the
// env var is missing or malformed — push is best-effort and must never
// fail the originating request (chat send, swipe, comment, etc.).
//
// Token type: FCM unified tokens. The client uses
// @react-native-firebase/messaging which on iOS auto-exchanges the APNs
// token for an FCM token; on Android it returns a raw FCM token. Either
// way we get one token shape, sendable via messaging().send({ token }).
//
// Invalid token cleanup: when FCM reports the token has been unregistered
// (user uninstalled, cleared app data, etc.), we wipe User.fcmToken so we
// stop retrying. The next sign-in re-registers a fresh token.
const admin = require('firebase-admin');
const User = require('../models/User');

let _credsState = null; // 'configured' | 'missing' | 'invalid' | null=unloaded
let _initialized = false;

function loadCreds() {
  if (_credsState !== null) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) {
    _credsState = 'missing';
    console.log('[push] FIREBASE_SERVICE_ACCOUNT not set — push disabled');
    return;
  }
  let text = raw.trim();
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8');
    } catch (e) {
      _credsState = 'invalid';
      console.warn('[push] FIREBASE_SERVICE_ACCOUNT is neither JSON nor base64');
      return;
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    _credsState = 'invalid';
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT JSON parse failed:', e.message);
    return;
  }
  if (!parsed.client_email || !parsed.private_key) {
    _credsState = 'invalid';
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT missing client_email or private_key');
    return;
  }
  try {
    if (!_initialized) {
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      _initialized = true;
    }
    _credsState = 'configured';
    console.log('[push] firebase-admin initialized for project', parsed.project_id);
  } catch (e) {
    _credsState = 'invalid';
    console.warn('[push] firebase-admin init failed:', e.message);
  }
}

function isConfigured() {
  loadCreds();
  return _credsState === 'configured';
}

/**
 * Fire-and-forget push to a single user. Never throws — push delivery
 * failures must not affect the originating request. Pass `await` on it
 * only if you specifically want to wait, otherwise just don't.
 *
 * @param {string|object} userId  Mongo _id (string or ObjectId)
 * @param {object} payload
 * @param {string} payload.title  Notification title (heading)
 * @param {string} payload.body   Notification body text
 * @param {object} [payload.data] Optional data payload — FCM forces all
 *                                 values to strings; we coerce nulls to '' and
 *                                 stringify everything else. Recognized keys
 *                                 (see app-rn/src/utils/pushRouter.ts):
 *                                   type: 'message'|'match'|'comment'|'like'|'follow'
 *                                   matchId, momentId, fromUserId
 */
async function sendPushToUser(userId, { title, body, data = {}, collapseKey } = {}) {
  if (!isConfigured()) return;
  if (!userId) return;

  let user;
  try {
    user = await User.findById(userId).select('fcmToken').lean();
  } catch {
    return;
  }
  const token = user?.fcmToken;
  if (!token) return;

  // FCM data payload requires all values to be strings.
  const stringData = Object.fromEntries(
    Object.entries(data || {}).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );

  try {
    await admin.messaging().send({
      token,
      notification: {
        title: title || '',
        body: body || '',
      },
      data: stringData,
      android: {
        priority: 'high',
        // Group/replace: a repeated summary push with the same collapseKey
        // updates the existing notification slot instead of stacking (item 9).
        ...(collapseKey ? { collapseKey } : {}),
        notification: {
          ...(collapseKey ? { tag: collapseKey } : {}),
          // Keep in sync with utils/push.ts setNotificationChannelAsync.
          // Channel sound is immutable after first creation; bumping the
          // ID was the only way to roll the custom sound out to existing
          // installs. `notification_sound` resolves to res/raw/
          // notification_sound.wav (Android resource lookup is by base
          // name, no extension). Channel-level sound is the authoritative
          // setting on Android 8+; this per-notification `sound` field is
          // a redundant belt-and-suspenders.
          channelId: 'default_v3',
          sound: 'notification_sound',
        },
      },
      apns: {
        ...(collapseKey ? { headers: { 'apns-collapse-id': collapseKey } } : {}),
        payload: {
          aps: {
            ...(collapseKey ? { 'thread-id': collapseKey } : {}),
            // iOS expects the filename with extension. `notification_sound
            // .caf` is bundled in the .ipa main bundle by the Expo plugin
            // withCustomNotificationSound.js at prebuild time.
            sound: 'notification_sound.caf',
            'mutable-content': 1,
            // Badge bumping disabled at the server side for now — clients
            // manage badge locally via expo-notifications. Re-enable here
            // when we add a server-side unread counter aggregator.
          },
        },
      },
    });
  } catch (e) {
    const code = e?.errorInfo?.code || e?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      // Token revoked / invalid — wipe it so we don't keep retrying.
      try {
        await User.findByIdAndUpdate(userId, { fcmToken: null });
      } catch {
        /* ignore */
      }
    } else {
      console.warn('[push] send failed for user', String(userId), code || e?.message || e);
    }
  }
}

module.exports = { sendPushToUser, isConfigured };
