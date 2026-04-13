/**
 * Commission Service
 * Call processCommission(userId, paymentId, amount) after any successful payment.
 * It checks if the user was referred, calculates 10% commission, and credits the referrer's wallet.
 */

const User = require('../models/User');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Wallet = require('../models/Wallet');
const Payment = require('../models/Payment');

const COMMISSION_RATE = 0.10; // 10%

/**
 * Process commission for a payment.
 * Safe to call even if user has no referrer — it will no-op.
 */
async function processCommission(userId, paymentId, amount) {
  try {
    const user = await User.findById(userId).select('referredBy');
    if (!user || !user.referredBy) return; // no referrer, nothing to do

    const payment = await Payment.findById(paymentId);
    if (!payment || payment.referralProcessed) return; // already processed

    const referral = await Referral.findOne({
      referrer: user.referredBy,
      referred: userId,
      status: 'active',
    });
    if (!referral) return; // referral not active yet

    const commissionAmount = parseFloat((amount * COMMISSION_RATE).toFixed(2));
    if (commissionAmount <= 0) return;

    // Create commission record
    const commission = await Commission.create({
      referrer: user.referredBy,
      referred: userId,
      payment: paymentId,
      amount: commissionAmount,
      currency: payment.currency || 'MYR',
      status: 'approved',
    });

    // Credit referrer's wallet (upsert)
    await Wallet.findOneAndUpdate(
      { user: user.referredBy },
      {
        $inc: { balance: commissionAmount, totalEarned: commissionAmount },
        $setOnInsert: { user: user.referredBy },
      },
      { upsert: true, new: true }
    );

    // Update referral total
    await Referral.findByIdAndUpdate(referral._id, {
      $inc: { totalCommissionEarned: commissionAmount },
    });

    // Mark payment as processed
    await Payment.findByIdAndUpdate(paymentId, { referralProcessed: true });

    console.log(`[commission] RM${commissionAmount} credited to user ${user.referredBy} for payment ${paymentId}`);
    return commission;
  } catch (err) {
    // Non-fatal: log but don't throw — payment already succeeded
    console.error('[commission] processCommission error:', err.message);
  }
}

/**
 * Record a payment and process its commission in one call.
 * Use this from route handlers instead of creating Payment manually.
 */
async function recordPaymentAndCommission(userId, type, amount, currency = 'MYR') {
  const payment = await Payment.create({ user: userId, type, amount, currency });
  await processCommission(userId, payment._id, amount);
  return payment;
}

/**
 * Activate a pending referral after the referred user takes their first real action.
 * Call this from any meaningful action (first swipe, first message, etc.)
 */
async function activateReferralIfEligible(userId) {
  try {
    const user = await User.findById(userId).select('referredBy createdAt');
    if (!user || !user.referredBy) return;

    const hoursOld = (Date.now() - new Date(user.createdAt)) / 3600000;
    if (hoursOld < 24) return; // need 24h before activation

    await Referral.findOneAndUpdate(
      { referrer: user.referredBy, referred: userId, status: 'pending' },
      { status: 'active' }
    );
  } catch (err) {
    console.error('[commission] activateReferralIfEligible error:', err.message);
  }
}

module.exports = { processCommission, recordPaymentAndCommission, activateReferralIfEligible };
