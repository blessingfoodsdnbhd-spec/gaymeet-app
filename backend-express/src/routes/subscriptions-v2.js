// Meyou 密友 v2 — Apple IAP subscription verification + webhook.
//
// Single-SKU per period:
//   com.meetupnearby.app.premium.monthly   → RM 39.90 / month
//   com.meetupnearby.app.premium.annual    → RM 399.90 / year
//
// Apple's verifyReceipt API is deprecated; in production we'd use the
// App Store Server API + signed JWT notifications. For v2 launch we use
// /verifyReceipt — good enough for early subscribers, swap when scale
// makes it worth the cert handling.
const router = require('express').Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
  SignedDataVerifier,
  Environment,
} = require('@apple/app-store-server-library');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

// Apple product IDs cannot be reused after deletion, so we live in the
// `.subscription.*` namespace rather than the original `.premium.*`.
const SKU_MONTHLY = 'com.meetupnearby.app.subscription.monthly';
const SKU_ANNUAL = 'com.meetupnearby.app.subscription.annual';
const VALID_SKUS = new Set([SKU_MONTHLY, SKU_ANNUAL]);

const APPLE_VERIFY_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

// ── ASSN V2 verifier (App Store Server Notifications) ────────────────────────
// Lazy-initialised so missing cert / bad install doesn't crash app boot —
// the webhook itself surfaces the failure with 500 and a clear log line.
const APP_BUNDLE_ID = 'com.meetupnearby.app';
const APP_APPLE_ID = 6762375260;
let _verifier = null;
function getVerifier() {
  if (_verifier) return _verifier;
  const appleRootDer = fs.readFileSync(
    path.join(__dirname, '../certs/AppleRootCA-G3.cer'),
  );
  const envName = (process.env.APPLE_IAP_ENV || 'production').toLowerCase();
  const environment =
    envName === 'sandbox' ? Environment.SANDBOX : Environment.PRODUCTION;
  _verifier = new SignedDataVerifier(
    [appleRootDer],   // DER root certificate(s)
    true,             // enableOnlineChecks (revocation + expiration)
    environment,
    APP_BUNDLE_ID,
    APP_APPLE_ID,
  );
  return _verifier;
}

function expiryFromSku(sku) {
  const now = new Date();
  if (sku === SKU_MONTHLY) {
    now.setMonth(now.getMonth() + 1);
  } else if (sku === SKU_ANNUAL) {
    now.setFullYear(now.getFullYear() + 1);
  }
  return now;
}

async function verifyWithApple(receipt, useSandbox = false) {
  const url = useSandbox ? APPLE_VERIFY_SANDBOX : APPLE_VERIFY_PROD;
  const body = {
    'receipt-data': receipt,
    password: process.env.APPLE_SHARED_SECRET || '',
    'exclude-old-transactions': true,
  };
  const { data } = await axios.post(url, body, { timeout: 15000 });
  return data;
}

// ── POST /api/subscriptions/verify-apple-receipt ─────────────────────────────
// Body: { receipt: base64, productId }
// Validates with Apple, marks user Premium, returns updated user.
router.post('/verify-apple-receipt', auth, async (req, res, next) => {
  try {
    const { receipt, productId } = req.body;
    if (!receipt || !productId) {
      return err(res, 'receipt and productId required');
    }
    if (!VALID_SKUS.has(productId)) {
      return err(res, 'Unknown productId');
    }

    let apple = await verifyWithApple(receipt, false);
    // Apple's "use the sandbox endpoint" sentinel — retry there
    if (apple?.status === 21007) {
      apple = await verifyWithApple(receipt, true);
    }

    if (apple?.status !== 0) {
      console.warn('[iap] Apple verify failed:', apple?.status, apple?.exception);
      return err(res, `Apple verify failed (status ${apple?.status})`, 400);
    }

    // Find the latest subscription transaction matching our SKU.
    const latest = (apple.latest_receipt_info || []).filter(
      (t) => t.product_id === productId,
    );
    latest.sort((a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms));
    const top = latest[0];
    if (!top) {
      return err(res, 'No matching subscription in receipt', 400);
    }

    const appleExpiry = Number(top.expires_date_ms);
    const expiresAt = Number.isFinite(appleExpiry) && appleExpiry > 0
      ? new Date(appleExpiry)
      : expiryFromSku(productId);

    // Persist Premium state. Keep existing expiry if Apple's is shorter
    // (defensive — shouldn't happen, but extra safety).
    const current = req.user.premiumExpiresAt
      ? new Date(req.user.premiumExpiresAt)
      : null;
    const final = current && current > expiresAt ? current : expiresAt;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        isPremium: true,
        premiumExpiresAt: final,
        // Stash the originalTransactionId so webhook events can find this user.
        appleOriginalTransactionId: top.original_transaction_id,
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

// ── POST /api/subscriptions/apple-webhook ────────────────────────────────────
// Apple App Store Server Notifications V2. The body is a JWS-signed payload;
// inside it, `signedRenewalInfo` and `signedTransactionInfo` are also JWS.
//
// All three are verified via @apple/app-store-server-library's
// SignedDataVerifier, which:
//   - validates the JWS signature with the leaf cert from the x5c header,
//   - walks the x5c chain back to the Apple root cert we ship,
//   - checks revocation + expiration when enableOnlineChecks=true,
//   - confirms the payload's bundleId matches APP_BUNDLE_ID.
//
// Forged payloads (random JWS, self-signed cert, wrong bundle id, expired
// cert, etc.) throw VerificationException → we return 401 and ignore.
router.post('/apple-webhook', async (req, res) => {
  const signed = req.body?.signedPayload;
  if (!signed) {
    console.warn('[iap-webhook] missing signedPayload');
    return res.status(400).json({ error: 'missing signedPayload' });
  }

  let notification;
  try {
    notification = await getVerifier().verifyAndDecodeNotification(signed);
  } catch (e) {
    console.warn(
      '[iap-webhook] signature verification failed:',
      e?.message ?? String(e),
    );
    return res.status(401).json({ error: 'invalid signature' });
  }

  // Verify the inner payloads too — they're separately-signed JWS that
  // verifyAndDecodeNotification does NOT auto-decode.
  let renewalInfo = null;
  let transactionInfo = null;
  try {
    if (notification.data?.signedRenewalInfo) {
      renewalInfo = await getVerifier().verifyAndDecodeRenewalInfo(
        notification.data.signedRenewalInfo,
      );
    }
    if (notification.data?.signedTransactionInfo) {
      transactionInfo = await getVerifier().verifyAndDecodeTransaction(
        notification.data.signedTransactionInfo,
      );
    }
  } catch (e) {
    console.warn(
      '[iap-webhook] inner JWS verification failed:',
      e?.message ?? String(e),
    );
    return res.status(401).json({ error: 'invalid inner signature' });
  }

  const type = notification.notificationType;
  const originalTxId =
    renewalInfo?.originalTransactionId ||
    transactionInfo?.originalTransactionId;

  if (!originalTxId) {
    console.log('[iap-webhook] no originalTransactionId on event', type);
    return res.json({ ok: true });
  }

  try {
    const user = await User.findOne({
      appleOriginalTransactionId: originalTxId,
    });
    if (!user) {
      console.log('[iap-webhook] no user for tx', originalTxId);
      return res.json({ ok: true });
    }

    if (type === 'DID_RENEW' || type === 'DID_CHANGE_RENEWAL_PREF') {
      const expiresMs = Number(transactionInfo?.expiresDate);
      if (Number.isFinite(expiresMs)) {
        user.isPremium = true;
        user.premiumExpiresAt = new Date(expiresMs);
        await user.save();
      }
    } else if (type === 'EXPIRED' || type === 'REFUND' || type === 'REVOKE') {
      user.isPremium = false;
      user.premiumExpiresAt = new Date();
      await user.save();
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[iap-webhook] handler error', e);
    // Ack anyway — Apple retries on 5xx and infinite retry isn't useful
    // for our state-update failures (we still consumed the event).
    res.status(200).json({ ok: true, error: e.message });
  }
});

module.exports = router;
