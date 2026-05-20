// Meyou 密友 v2 — Apple IAP subscription verification + webhook.
//
// Single-SKU per period:
//   com.meetupnearby.app.premium.monthly   → RM 39.90 / month
//   com.meetupnearby.app.premium.annual    → RM 399    / year
//
// Apple's verifyReceipt API is deprecated; in production we'd use the
// App Store Server API + signed JWT notifications. For v2 launch we use
// /verifyReceipt — good enough for early subscribers, swap when scale
// makes it worth the cert handling.
const router = require('express').Router();
const axios = require('axios');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, err } = require('../utils/respond');

const SKU_MONTHLY = 'com.meetupnearby.app.premium.monthly';
const SKU_ANNUAL = 'com.meetupnearby.app.premium.annual';
const VALID_SKUS = new Set([SKU_MONTHLY, SKU_ANNUAL]);

const APPLE_VERIFY_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

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
// Apple App Store Server Notifications V2. Signed payload (JWS).
//
// For v2 launch we ack everything and only act on RENEW / EXPIRED to keep
// premiumExpiresAt accurate. Full JWS verification (via Apple's public keys)
// is a TODO before commercial scale.
router.post('/apple-webhook', async (req, res, next) => {
  try {
    const signed = req.body?.signedPayload;
    if (!signed) {
      console.warn('[iap-webhook] missing signedPayload');
      return res.status(400).json({ error: 'missing signedPayload' });
    }

    // Decode JWS without verifying signature (TODO: verify with Apple's keys).
    const [, payloadB64] = String(signed).split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    const type = payload.notificationType;
    const renewalInfoStr = payload.data?.signedRenewalInfo;
    const transactionInfoStr = payload.data?.signedTransactionInfo;

    function decodeJwsPayload(jws) {
      if (!jws) return null;
      const [, p] = String(jws).split('.');
      return JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    }

    const renewalInfo = decodeJwsPayload(renewalInfoStr);
    const transactionInfo = decodeJwsPayload(transactionInfoStr);
    const originalTxId =
      renewalInfo?.originalTransactionId ||
      transactionInfo?.originalTransactionId;

    if (!originalTxId) {
      console.log('[iap-webhook] no originalTransactionId on event', type);
      return res.json({ ok: true });
    }

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
    console.error('[iap-webhook] error', e);
    // Ack anyway — Apple retries on 5xx but we don't want infinite loops.
    res.status(200).json({ ok: true, error: e.message });
  }
});

module.exports = router;
