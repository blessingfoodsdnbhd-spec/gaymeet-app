const InviteCode = require('../models/InviteCode');
const InviteUsage = require('../models/InviteUsage');
const User = require('../models/User');
const Follow = require('../models/Follow');
const { grantPremiumMs } = require('../utils/premiumGrant');
const { notify } = require('./notificationService');
const { awardCoins, COIN_REWARDS } = require('../utils/coins');

const REWARD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
function randomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Find or create the caller's invite code, retrying on the rare collision. */
async function getOrCreateCode(userId) {
  let doc = await InviteCode.findOne({ userId });
  if (doc) return doc;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await InviteCode.create({ userId, code: randomCode() });
    } catch (e) {
      if (e && e.code === 11000) {
        // userId unique → someone created it concurrently; re-read.
        doc = await InviteCode.findOne({ userId });
        if (doc) return doc;
        continue; // code collision → retry with a new code
      }
      throw e;
    }
  }
  throw new Error('Could not allocate an invite code');
}

/**
 * Redeem `rawCode` for `inviteeId`. Grants +30d Premium to both parties, records
 * the usage, links referredBy, auto-follows the inviter, and pushes the inviter.
 * Returns { ok: true, inviterId } or { error: <i18n key> }. Never throws on the
 * expected validation paths.
 */
async function redeemInvite(inviteeId, rawCode) {
  const code = String(rawCode || '').toUpperCase().trim();
  if (!code) return { error: 'invalidCode' };

  const invite = await InviteCode.findOne({ code });
  if (!invite) return { error: 'invalidCode' };

  const inviterId = invite.userId;
  if (String(inviterId) === String(inviteeId)) return { error: 'cantUseSelf' };
  if (await InviteUsage.exists({ inviteeId })) return { error: 'alreadyRedeemed' };

  // Record the usage FIRST — the unique inviteeId index is the race-safe guard,
  // so we never double-grant on concurrent requests.
  try {
    await InviteUsage.create({
      inviterId,
      inviteeId,
      inviterRewardMs: REWARD_MS,
      inviteeRewardMs: REWARD_MS,
      redeemedAt: new Date(),
    });
  } catch (e) {
    if (e && e.code === 11000) return { error: 'alreadyRedeemed' };
    throw e;
  }

  await grantPremiumMs(inviterId, REWARD_MS);
  await grantPremiumMs(inviteeId, REWARD_MS);
  // Coin bonus on top of the Premium reward (once — guarded by InviteUsage above).
  await awardCoins(inviterId, COIN_REWARDS.referralInviter);
  await awardCoins(inviteeId, COIN_REWARDS.referralInvitee);
  await InviteCode.updateOne({ _id: invite._id }, { $inc: { usedCount: 1 } });
  await User.updateOne({ _id: inviteeId, referredBy: null }, { $set: { referredBy: inviterId } });

  // Auto-follow the inviter (ignore if already following).
  try {
    await Follow.create({ follower: inviteeId, following: inviterId });
    await User.updateOne({ _id: inviteeId }, { $inc: { followingCount: 1 } });
    await User.updateOne({ _id: inviterId }, { $inc: { followersCount: 1 } });
  } catch (_) {
    /* already following — fine */
  }

  const invitee = await User.findById(inviteeId).select('nickname');
  notify(inviterId, 'invite_redeemed', {
    title: '你的邀请被使用了 🎉',
    body: `${invitee?.nickname || '有人'} 使用了你的邀请码,你们都获得了 30 天 Premium`,
    data: {},
  }).catch(() => {});

  return { ok: true, inviterId: String(inviterId) };
}

module.exports = { getOrCreateCode, redeemInvite, randomCode, REWARD_MS };
