const router = require('express').Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Wallet = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');
const env = require('../config/env');

const MONTHLY_REFERRAL_LIMIT = 50;
const MIN_WITHDRAWAL_MYR = 10;

// ── GET /api/referrals/code ───────────────────────────────────────────────────
// Returns my referral code and a shareable link
router.get('/code', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode nickname');
    const baseUrl = env.CLIENT_URL === '*' ? 'https://gaymeet.app' : env.CLIENT_URL.split(',')[0].trim();
    const shareLink = `${baseUrl}/join?ref=${user.referralCode}`;
    ok(res, {
      code: user.referralCode,
      shareLink,
      shareMessage: `来GayMeet认识新朋友！用我的邀请码 ${user.referralCode} 注册，我们都能得到金币奖励 🎁 ${shareLink}`,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/referrals/stats ──────────────────────────────────────────────────
router.get('/stats', auth, async (req, res, next) => {
  try {
    const [referrals, wallet, pendingCommissions] = await Promise.all([
      Referral.find({ referrer: req.user._id }),
      Wallet.findOne({ user: req.user._id }),
      Commission.aggregate([
        { $match: { referrer: req.user._id, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    ok(res, {
      referralCount: referrals.length,
      activeReferrals: referrals.filter((r) => r.status === 'active').length,
      totalEarned: wallet?.totalEarned ?? 0,
      walletBalance: wallet?.balance ?? 0,
      totalWithdrawn: wallet?.totalWithdrawn ?? 0,
      pendingCommission: pendingCommissions[0]?.total ?? 0,
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/referrals/list ───────────────────────────────────────────────────
router.get('/list', auth, async (req, res, next) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referred', 'nickname avatarUrl createdAt')
      .sort({ createdAt: -1 })
      .limit(100);

    const list = referrals.map((r) => ({
      userId: r.referred?._id,
      nickname: r.referred?.nickname ?? 'Unknown',
      avatarUrl: r.referred?.avatarUrl ?? null,
      joinDate: r.createdAt,
      status: r.status,
      totalCommission: r.totalCommissionEarned,
    }));

    ok(res, { referrals: list });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/referrals/apply ─────────────────────────────────────────────────
// Apply a referral code (called after registration or during onboarding)
router.post('/apply', auth, async (req, res, next) => {
  try {
    const { referralCode, deviceFingerprint } = req.body;
    if (!referralCode) return err(res, 'referralCode is required');

    const userId = req.user._id;

    // Already has a referrer?
    const me = await User.findById(userId).select('referredBy referralCode createdAt deviceFingerprint');
    if (me.referredBy) return err(res, 'You have already applied a referral code', 400);

    // Find the referrer by code
    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() }).select('_id referralCode deviceFingerprint');
    if (!referrer) return err(res, 'Invalid referral code', 404);

    // Cannot refer yourself
    if (referrer._id.equals(userId)) return err(res, 'You cannot use your own referral code', 400);

    // ── Fraud checks ──────────────────────────────────────────────────────────

    // Check monthly rate limit
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const monthCount = await Referral.countDocuments({
      referrer: referrer._id,
      createdAt: { $gte: thisMonthStart },
    });
    if (monthCount >= MONTHLY_REFERRAL_LIMIT) {
      return err(res, 'This referral link has reached its monthly limit', 400);
    }

    // Check same device fingerprint fraud
    if (deviceFingerprint && referrer.deviceFingerprint === deviceFingerprint) {
      return err(res, 'Referral not allowed: same device detected', 400);
    }

    // Save device fingerprint on current user
    if (deviceFingerprint && !me.deviceFingerprint) {
      await User.findByIdAndUpdate(userId, { deviceFingerprint });
    }

    // Create referral (pending — activates after 24h + real action)
    await Referral.create({
      referrer: referrer._id,
      referred: userId,
      referralCode: referralCode.toUpperCase(),
      status: 'pending',
    });

    // Link referredBy on user
    await User.findByIdAndUpdate(userId, {
      referredBy: referrer._id,
    });

    // Increment referrer's count
    await User.findByIdAndUpdate(referrer._id, {
      $inc: { referralCount: 1 },
    });

    ok(res, { success: true, message: '邀请码已成功应用！' });
  } catch (e) {
    if (e.code === 11000) return err(res, 'You have already applied a referral code', 400);
    next(e);
  }
});

// ── GET /api/referrals/wallet ─────────────────────────────────────────────────
router.get('/wallet', auth, async (req, res, next) => {
  try {
    const [wallet, commissions, withdrawals] = await Promise.all([
      Wallet.findOne({ user: req.user._id }),
      Commission.find({ referrer: req.user._id })
        .populate('referred', 'nickname avatarUrl')
        .sort({ createdAt: -1 })
        .limit(50),
      Withdrawal.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const transactions = [
      ...commissions.map((c) => ({
        type: 'commission',
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        fromUser: {
          nickname: c.referred?.nickname ?? 'Unknown',
          avatarUrl: c.referred?.avatarUrl ?? null,
        },
        createdAt: c.createdAt,
      })),
      ...withdrawals.map((w) => ({
        type: 'withdrawal',
        amount: -w.amount,
        currency: 'MYR',
        status: w.status,
        method: w.method,
        createdAt: w.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    ok(res, {
      balance: wallet?.balance ?? 0,
      totalEarned: wallet?.totalEarned ?? 0,
      totalWithdrawn: wallet?.totalWithdrawn ?? 0,
      transactions,
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/referrals/withdraw ──────────────────────────────────────────────
router.post('/withdraw', auth, async (req, res, next) => {
  try {
    const { amount, method, accountDetails } = req.body;

    if (!amount || !method || !accountDetails) {
      return err(res, 'amount, method, and accountDetails are required');
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < MIN_WITHDRAWAL_MYR) {
      return err(res, `Minimum withdrawal is RM${MIN_WITHDRAWAL_MYR}`);
    }

    const validMethods = ['bank_transfer', 'ewallet', 'manual'];
    if (!validMethods.includes(method)) {
      return err(res, `method must be one of: ${validMethods.join(', ')}`);
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet || wallet.balance < numAmount) {
      return err(res, 'Insufficient wallet balance', 400);
    }

    // Check for existing pending withdrawal
    const existingPending = await Withdrawal.findOne({
      user: req.user._id,
      status: { $in: ['pending', 'processing'] },
    });
    if (existingPending) {
      return err(res, 'You already have a pending withdrawal request', 400);
    }

    // Deduct balance atomically
    const updated = await Wallet.findOneAndUpdate(
      { user: req.user._id, balance: { $gte: numAmount } },
      { $inc: { balance: -numAmount, totalWithdrawn: numAmount } },
      { new: true }
    );
    if (!updated) return err(res, 'Insufficient balance (race condition)', 400);

    const withdrawal = await Withdrawal.create({
      user: req.user._id,
      amount: numAmount,
      method,
      accountDetails,
      status: 'pending',
    });

    created(res, { withdrawal, newBalance: updated.balance });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/referrals/withdrawals ────────────────────────────────────────────
router.get('/withdrawals', auth, async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    ok(res, { withdrawals });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
