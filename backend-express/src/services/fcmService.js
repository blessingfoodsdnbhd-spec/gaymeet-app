const admin = require('firebase-admin');

let _initialized = false;

function _init() {
  if (_initialized) return;

  // Accept credentials as a JSON string env var (base64 or raw JSON)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
    return;
  }

  try {
    const serviceAccount = JSON.parse(
      raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    _initialized = true;
    console.log('Firebase Admin initialised ✓');
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

/**
 * Send a chat push notification to a recipient.
 * @param {string} fcmToken  - recipient's FCM token
 * @param {string} senderName - sender's nickname
 * @param {string} body       - message preview
 * @param {string} matchId    - match/conversation id for tap navigation
 */
async function sendChatPush(fcmToken, senderName, body, matchId) {
  if (!_initialized) return;
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: senderName,
        body: body.length > 100 ? body.slice(0, 97) + '…' : body,
      },
      data: {
        type: 'new_message',
        matchId,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
  } catch (e) {
    // Token may be stale — log but don't crash
    console.warn(`FCM send failed (token: ${fcmToken?.slice(0, 15)}…):`, e.message);
  }
}

_init();

module.exports = { sendChatPush };
