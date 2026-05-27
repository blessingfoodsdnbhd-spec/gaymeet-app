// Meyou 密友 — Google Play subscription verification + RTDN webhook.
//
// Product structure on Play Console:
//   Subscription ID:  com.meetupnearby.app.premium
//   Base plans:       monthly  (auto-renewing, 1 month, RM39.90)
//                     annual   (auto-renewing, 1 year, RM399.90)
//
// Apple uses one product per duration; Play uses one subscription with
// multiple base plans. We bridge both into the SAME premium-grant path
// on User (isPremium + premiumExpiresAt), so the rest of the backend
// doesn't care which store the premium came from.
const router = require('express').Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');
const googlePlay = require('../utils/googlePlay');

const ANDROID_PACKAGE = 'com.meetupnearby.app';
const SUBSCRIPTION_ID = 'com.meetupnearby.app.premium';
const VALID_BASE_PLANS = new Set(['monthly', 'annual']);

// SubscriptionPurchase.subscriptionState values that mean "user has access"
// (per androidpublisher v3 docs).
const ACTIVE_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
]);

const TERMINAL_STATES = new Set([
  'SUBSCRIPTION_STATE_EXPIRED',
  'SUBSCRIPTION_STATE_CANCELED',
  'SUBSCRIPTION_STATE_REVOKED',
]);

function parseExpiry(sub) {
  // v2 returns RFC3339 strings on lineItems[].expiryTime
  const li = (sub?.lineItems || [])[0];
  if (!li?.expiryTime) return null;
  const t = Date.parse(li.expiryTime);
  return Number.isFinite(t) ? new Date(t) : null;
}

function extractProductId(sub) {
  return (sub?.lineItems || [])[0]?.productId || null;
}

// ── POST /api/subscriptions/verify-google-purchase ───────────────────────────
// Body: { purchaseToken, productId, packageName }
//   - purchaseToken : RNIap purchase.purchaseToken (Play's opaque token)
//   - productId     : the subscription ID returned by Play (NOT the basePlanId)
//   - packageName   : sanity-checked against our app's package; client sends it
//                     so the backend can spot mis-configured builds early
//
// Verifies via Play Developer API, grants premium iff the subscription is in
// an active/grace state, acknowledges the purchase so Play doesn't refund.
router.post('/verify-google-purchase', auth, async (req, res, next) => {
  try {
    const { purchaseToken, productId, packageName } = req.body || {};

    if (!purchaseToken || !productId) {
      return err(res, 'purchaseToken and productId required');
    }
    if (packageName && packageName !== ANDROID_PACKAGE) {
      return err(res, `Unexpected packageName ${packageName}`, 400);
    }
    if (productId !== SUBSCRIPTION_ID) {
      return err(res, `Unknown productId ${productId}`, 400);
    }

    if (!googlePlay.isConfigured()) {
      // No service-account on this deploy. Surface a clear 503 so the
      // client sees a server-side config problem, not a generic 500.
      console.warn(
        '[iap-google] verify called but no service account configured',
      );
      return err(res, 'Google Play verification not configured', 503);
    }

    let sub;
    try {
      sub = await googlePlay.getSubscriptionV2({
        packageName: ANDROID_PACKAGE,
        token: purchaseToken,
      });
    } catch (e) {
      console.warn('[iap-google] subscriptionsv2.get failed:', e?.message);
      return err(res, 'Play verification failed', 400);
    }

    const state = sub?.subscriptionState;
    if (!ACTIVE_STATES.has(state)) {
      console.warn('[iap-google] purchase not active:', state);
      return err(res, `Subscription not active (${state})`, 400);
    }

    const playProductId = extractProductId(sub);
    if (playProductId && playProductId !== SUBSCRIPTION_ID) {
      console.warn('[iap-google] productId mismatch:', playProductId);
      return err(res, 'Receipt productId mismatch', 400);
    }

    const expiresAt = parseExpiry(sub);
    if (!expiresAt) {
      return err(res, 'No expiry on Play receipt', 400);
    }

    // Acknowledge the purchase. Required within 3 days; idempotent so we can
    // always call it (won't double-charge anything).
    try {
      await googlePlay.acknowledgeSubscription({
        packageName: ANDROID_PACKAGE,
        subscriptionId: SUBSCRIPTION_ID,
        token: purchaseToken,
      });
    } catch (e) {
      // Acknowledging is required by Play, but if our verification call
      // already succeeded we don't want to fail the user's purchase grant
      // because of an ack hiccup — log and continue. The next webhook will
      // typically retry.
      console.warn('[iap-google] acknowledge failed:', e?.message);
    }

    // Keep existing expiry if Play's is shorter (defensive — shouldn't
    // happen, but extra safety, mirrors the Apple verify path).
    const current = req.user.premiumExpiresAt
      ? new Date(req.user.premiumExpiresAt)
      : null;
    const final = current && current > expiresAt ? current : expiresAt;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        isPremium: true,
        premiumExpiresAt: final,
        // Stash the purchaseToken so RTDN webhook events can find this user.
        // Play's purchaseToken persists across renewals — upgrades/downgrades
        // create a new token chained via linkedPurchaseToken; the webhook
        // handler walks that chain to keep the User record current.
        googleOriginalPurchaseToken: purchaseToken,
      },
      { new: true },
    );

    ok(res, {
      isPremium: updated.isPremium,
      premiumExpiresAt: updated.premiumExpiresAt
        ? updated.premiumExpiresAt.toISOString()
        : null,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/subscriptions/google-webhook ───────────────────────────────────
// Google Play Real-Time Developer Notifications, delivered via Pub/Sub HTTP
// push subscription. Payload shape:
//
//   {
//     "message": {
//       "data": "<base64-encoded JSON>",
//       "messageId": "...",
//       "publishTime": "..."
//     },
//     "subscription": "projects/<x>/subscriptions/<y>"
//   }
//
// Decoded `data` is a DeveloperNotification:
//   {
//     "version": "1.0",
//     "packageName": "com.meetupnearby.app",
//     "eventTimeMillis": "...",
//     "subscriptionNotification": {
//       "version": "1.0",
//       "notificationType": <int>,   // see below
//       "purchaseToken": "...",
//       "subscriptionId": "com.meetupnearby.app.premium"
//     }
//     // or "testNotification": { "version": "1.0" }   ← Play Console "Send test"
//   }
//
// SubscriptionNotificationType values (subset we care about):
//   1  SUBSCRIPTION_RECOVERED
//   2  SUBSCRIPTION_RENEWED
//   3  SUBSCRIPTION_CANCELED
//   4  SUBSCRIPTION_PURCHASED
//   5  SUBSCRIPTION_ON_HOLD
//   6  SUBSCRIPTION_IN_GRACE_PERIOD
//   7  SUBSCRIPTION_RESTARTED
//  10  SUBSCRIPTION_PAUSED
//  12  SUBSCRIPTION_REVOKED
//  13  SUBSCRIPTION_EXPIRED
//
// We always re-fetch the subscription from Play and reconcile state from
// the live API rather than trusting the notificationType, because the API
// is the source of truth and there are race conditions between notification
// delivery and state changes.
//
// Authn: Pub/Sub push can be configured with OIDC auth so requests carry a
// Google-signed JWT in Authorization. Validating that JWT is a "dashboard
// step" (we set audience + verify the issuer) — when not yet configured
// we accept the payload and rely on Pub/Sub URL secrecy. If the env var
// GOOGLE_RTDN_VERIFY_AUDIENCE is set, we enforce the JWT check.
const NOTIFICATION_TYPE_LABELS = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  10: 'SUBSCRIPTION_PAUSED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
};

router.post('/google-webhook', async (req, res) => {
  // Optional OIDC verification — enable once Pub/Sub push is configured with
  // an authentication service account.
  const wantAudience = process.env.GOOGLE_RTDN_VERIFY_AUDIENCE;
  if (wantAudience) {
    try {
      const authz = req.headers.authorization || '';
      const m = authz.match(/^Bearer (.+)$/i);
      if (!m) throw new Error('missing bearer token');
      const { OAuth2Client } = require('google-auth-library');
      const oauth = new OAuth2Client();
      await oauth.verifyIdToken({
        idToken: m[1],
        audience: wantAudience,
      });
    } catch (e) {
      console.warn('[iap-google-webhook] OIDC verify failed:', e?.message);
      return res.status(401).json({ error: 'invalid OIDC token' });
    }
  }

  const message = req.body?.message;
  if (!message?.data) {
    console.warn('[iap-google-webhook] missing message.data');
    return res.status(400).json({ error: 'missing message.data' });
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
  } catch (e) {
    console.warn('[iap-google-webhook] base64/JSON parse failed:', e?.message);
    return res.status(400).json({ error: 'malformed message.data' });
  }

  // Play Console "Send test notification" — no purchaseToken, just ack.
  if (decoded.testNotification) {
    console.log('[iap-google-webhook] test notification received, ack');
    return res.json({ ok: true });
  }

  if (decoded.packageName && decoded.packageName !== ANDROID_PACKAGE) {
    console.warn(
      '[iap-google-webhook] wrong packageName:',
      decoded.packageName,
    );
    return res.json({ ok: true }); // ack so Pub/Sub doesn't retry forever
  }

  const sn = decoded.subscriptionNotification;
  if (!sn?.purchaseToken) {
    // Other notification types (oneTimeProductNotification, voidedPurchase)
    // are intentionally not handled — ack and move on.
    return res.json({ ok: true });
  }

  const typeLabel =
    NOTIFICATION_TYPE_LABELS[sn.notificationType] ||
    `type=${sn.notificationType}`;
  console.log('[iap-google-webhook]', typeLabel, 'tok=', sn.purchaseToken.slice(0, 8));

  // Resolve user by purchase token. RTDN sends the CURRENT token; if the
  // user upgraded/downgraded, this may differ from the stored original.
  // Play returns the new token to RTDN AND surfaces it in subscriptionsv2.
  let user = await User.findOne({
    googleOriginalPurchaseToken: sn.purchaseToken,
  });

  if (!googlePlay.isConfigured()) {
    console.warn('[iap-google-webhook] service account not configured');
    // We can't reconcile state without API access. Ack so Pub/Sub doesn't
    // retry indefinitely — a 5xx loop is worse than a missed event.
    return res.json({ ok: true });
  }

  let sub;
  try {
    sub = await googlePlay.getSubscriptionV2({
      packageName: ANDROID_PACKAGE,
      token: sn.purchaseToken,
    });
  } catch (e) {
    console.warn('[iap-google-webhook] subscriptionsv2.get failed:', e?.message);
    // Don't 5xx — Apple-side mirror does the same. We'd rather drop one
    // event than enter a retry storm.
    return res.json({ ok: true });
  }

  // If the token chain has changed (upgrade/downgrade) and we still didn't
  // match a user, fall back to the linkedPurchaseToken from the API.
  if (!user && sub?.linkedPurchaseToken) {
    user = await User.findOne({
      googleOriginalPurchaseToken: sub.linkedPurchaseToken,
    });
    if (user) {
      user.googleOriginalPurchaseToken = sn.purchaseToken;
    }
  }

  if (!user) {
    console.log(
      '[iap-google-webhook] no user for purchaseToken',
      sn.purchaseToken.slice(0, 8),
    );
    return res.json({ ok: true });
  }

  try {
    const state = sub?.subscriptionState;
    const expiresAt = parseExpiry(sub);

    if (ACTIVE_STATES.has(state) && expiresAt) {
      user.isPremium = true;
      user.premiumExpiresAt = expiresAt;
    } else if (TERMINAL_STATES.has(state)) {
      user.isPremium = false;
      user.premiumExpiresAt = new Date();
    } else if (state === 'SUBSCRIPTION_STATE_ON_HOLD' && expiresAt) {
      // Keep the user's expiry — on-hold means payment is being retried;
      // they still had access up to expiry.
      user.premiumExpiresAt = expiresAt;
    }
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    console.error('[iap-google-webhook] reconcile error', e);
    // Ack anyway — see Apple webhook for the same rationale.
    res.status(200).json({ ok: true, error: e.message });
  }
});

module.exports = router;
