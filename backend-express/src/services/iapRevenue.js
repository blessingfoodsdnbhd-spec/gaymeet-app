// iapRevenue — records one Payment row per purchased subscription period.
//
// Why this exists: the Apple/Google verify handlers used to only set
// `isPremium` + `premiumExpiresAt` on the User. That tells you *who* has
// premium right now, but leaves no dated record of *when* anything was bought,
// so revenue-per-day was impossible to answer. (Reporting on it was worse than
// impossible — 34 of 35 "premium" users were hand-granted comps expiring in
// 2056, so counting User.isPremium as revenue overstated it by ~35x.)
//
// Idempotency is the whole trick. `verify` is called again on every "Restore
// Purchases" tap and on every app reinstall, and webhooks are retried by both
// stores. We key each Payment on (transaction id + period expiry), so the same
// period can be reported any number of times and still produce exactly one row.
const Payment = require('../models/Payment');

// Store-facing prices, MYR. These mirror the App Store Connect / Play Console
// products — the store is the source of truth for what the user is actually
// charged; this table only exists so we can attach an amount to the event.
// Keep in sync if you change the price in either console.
const PRICES = {
  'com.meetupnearby.app.subscription.monthly': 39.9,
  'com.meetupnearby.app.subscription.annual': 399.9,
  // Google uses one subscription id with base plans; resolve by plan below.
  'com.meetupnearby.app.premium:monthly': 39.9,
  'com.meetupnearby.app.premium:annual': 399.9,
};
const CURRENCY = 'MYR';

function priceFor(productId, basePlanId) {
  if (basePlanId && PRICES[`${productId}:${basePlanId}`] != null) {
    return PRICES[`${productId}:${basePlanId}`];
  }
  if (PRICES[productId] != null) return PRICES[productId];
  return null;
}

/**
 * Record a premium purchase/renewal. Safe to call repeatedly.
 *
 * @param {object}  o
 * @param {ObjectId} o.userId
 * @param {'apple'|'google'} o.platform
 * @param {string}  o.productId      store product id
 * @param {string}  [o.basePlanId]   Google base plan ('monthly' | 'annual')
 * @param {string}  o.transactionId  Apple originalTransactionId / Google purchaseToken
 * @param {Date|number} o.expiresAt  period expiry — makes each renewal distinct
 * @returns {Promise<boolean>} true if a new Payment row was written
 */
async function recordPremiumPurchase({
  userId,
  platform,
  productId,
  basePlanId,
  transactionId,
  expiresAt,
}) {
  if (!userId || !transactionId) return false;

  const amount = priceFor(productId, basePlanId);
  if (amount == null) {
    // Unknown SKU: log loudly rather than silently booking the wrong number.
    console.warn('[iap-revenue] unknown product, not recording:', productId, basePlanId);
    return false;
  }

  // The expiry is what separates one paid period from the next. Apple's
  // originalTransactionId is stable across renewals, so keying on it alone
  // would record only the very first period and silently drop every renewal.
  const periodKey = expiresAt ? new Date(expiresAt).getTime() : 'na';
  const externalTxId = `${platform}:${transactionId}:${periodKey}`;

  try {
    const r = await Payment.updateOne(
      { externalTxId },
      {
        $setOnInsert: {
          user: userId,
          type: 'premium',
          amount,
          currency: CURRENCY,
          platform,
          productId: basePlanId ? `${productId}:${basePlanId}` : productId,
          externalTxId,
        },
      },
      { upsert: true },
    );
    const inserted = !!r.upsertedCount;
    if (inserted) {
      console.log(`[iap-revenue] +${CURRENCY}${amount} ${platform} ${productId}`);
    }
    return inserted;
  } catch (e) {
    // A duplicate-key error just means a concurrent call won the race — that
    // is the guard working, not a failure. Never let bookkeeping break a
    // user's purchase grant.
    if (e && e.code === 11000) return false;
    console.error('[iap-revenue] failed to record payment:', e.message);
    return false;
  }
}

module.exports = { recordPremiumPurchase, PRICES, CURRENCY };
