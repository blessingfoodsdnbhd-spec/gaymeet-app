// Meyou official bot for World Chat / Plaza (Phase 8). Posts welcome/rules/level
// system lines as an isOfficial account so they render with the official badge.
const User = require('../models/User');
const WorldChatMessage = require('../models/WorldChatMessage');
const { identityOf } = require('./identity');

const BOT_EMAIL = 'meyou-bot@internal.meyou';
const BOT_NAME = 'Meyou 官方';

let _botId = null;

/** Find-or-create the singleton official bot user. Cached per-process. */
async function ensureBot() {
  if (_botId) return _botId;
  try {
    let bot = await User.findOne({ email: BOT_EMAIL }).select('_id');
    if (!bot) {
      bot = await User.create({
        email: BOT_EMAIL,
        nickname: BOT_NAME,
        isOfficial: true,
        isPublicProfile: false,
        // Bots never log in — no usable password/auth fields needed.
      });
    }
    _botId = bot._id;
  } catch (_) {
    _botId = null;
  }
  return _botId;
}

/**
 * Post a text message into a room AS the official bot, persisted + broadcast so
 * everyone present sees it live. `broadcast` is injected by the caller (the
 * worldChat route owns the socket plumbing). Never throws.
 */
async function postAsBot(roomId, body, broadcast) {
  try {
    const botId = await ensureBot();
    if (!botId) return null;
    const bot = await User.findById(botId).select('nickname avatarUrl isOfficial');
    const msg = await WorldChatMessage.create({ userId: botId, roomId, type: 'text', body });
    const payload = {
      messageId: msg._id.toString(),
      roomId,
      userId: botId.toString(),
      displayName: bot?.nickname || BOT_NAME,
      avatarUrl: bot?.avatarUrl ?? null,
      isOfficial: true,
      isVerified: true,
      isPremium: false,
      identity: identityOf(bot || {}),
      body,
      type: 'text',
      createdAt: msg.createdAt.toISOString(),
    };
    if (typeof broadcast === 'function') broadcast('world-chat:receive', payload, roomId);
    return payload;
  } catch (_) {
    return null;
  }
}

module.exports = { ensureBot, postAsBot, BOT_NAME };
