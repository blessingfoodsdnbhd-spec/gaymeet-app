// Google Play Developer API client — used for verifying subscription
// purchases and for processing RTDN (Real-Time Developer Notifications)
// from Pub/Sub.
//
// Credentials are read from one of two env vars:
//   - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   ← raw JSON or base64-encoded JSON
//   - GOOGLE_PLAY_SERVICE_ACCOUNT_PATH   ← absolute path to the JSON file
//
// Both are optional at boot — `getAuthClient()` throws lazily, so a backend
// that has never had Android IAP configured still starts cleanly. The
// verifier routes report 503 when this happens, instead of 500.
//
// The service-account JSON comes from a GCP project linked to the Play
// developer account, granted "View financial data, orders, and cancellation
// survey responses" + "Manage orders and subscriptions" via Play Console
// → Users & permissions → Invite new user.
const axios = require('axios');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';

let _credCache = null; // { source, parsed } — surfaced in logs/health
let _authClient = null;

function loadCredentials() {
  if (_credCache !== null) return _credCache;

  const rawJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH;

  let source = null;
  let text = null;

  if (rawJson && rawJson.trim()) {
    source = 'env-json';
    // Accept either pasted JSON or base64-encoded JSON (Render UI strips
    // newlines from multiline values, so base64 is safer in practice).
    const trimmed = rawJson.trim();
    if (trimmed.startsWith('{')) {
      text = trimmed;
    } else {
      try {
        text = Buffer.from(trimmed, 'base64').toString('utf8');
      } catch (e) {
        throw new Error(
          'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is neither JSON nor base64',
        );
      }
    }
  } else if (filePath && filePath.trim()) {
    source = 'env-path';
    text = fs.readFileSync(filePath, 'utf8');
  } else {
    _credCache = { source: null, parsed: null };
    return _credCache;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Service account JSON parse failed: ${e.message}`);
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'Service account JSON missing client_email or private_key',
    );
  }
  _credCache = { source, parsed };
  return _credCache;
}

function getAuthClient() {
  if (_authClient) return _authClient;
  const { parsed } = loadCredentials();
  if (!parsed) {
    throw new Error(
      'Google Play service account not configured — set ' +
        'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or GOOGLE_PLAY_SERVICE_ACCOUNT_PATH',
    );
  }
  _authClient = new GoogleAuth({
    credentials: parsed,
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
  return _authClient;
}

async function getAccessToken() {
  const auth = getAuthClient();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('GoogleAuth returned empty access token');
  return token;
}

// purchases.subscriptionsv2.get
//
// Returns the v2 SubscriptionPurchase resource:
//   { kind, regionCode, lineItems: [{ productId, expiryTime, autoRenewingPlan, ... }],
//     subscriptionState, latestOrderId, linkedPurchaseToken, ... }
//
// `lineItems[i].expiryTime` is the source of truth for premium expiry.
async function getSubscriptionV2({ packageName, token }) {
  const accessToken = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  return data;
}

// purchases.subscriptions.acknowledge — required within 3 days of purchase
// or Play auto-refunds. Idempotent: a second call on an already-acknowledged
// purchase returns 200 with no body change.
async function acknowledgeSubscription({ packageName, subscriptionId, token }) {
  const accessToken = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptions/${encodeURIComponent(subscriptionId)}` +
    `/tokens/${encodeURIComponent(token)}:acknowledge`;
  await axios.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    },
  );
}

function isConfigured() {
  const { parsed } = loadCredentials();
  return !!parsed;
}

module.exports = {
  getSubscriptionV2,
  acknowledgeSubscription,
  isConfigured,
};
