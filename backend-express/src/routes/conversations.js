const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const { uploadDir } = require('../middleware/upload');
const r2 = require('../services/r2Service');
const { ok, err } = require('../utils/respond');
const Match = require('../models/Match');
const Message = require('../models/Message');
const User = require('../models/User');
const { isPremiumActive } = require('../utils/premium');
const { sendPushToUser } = require('../utils/push');

// Chat voice-message upload — memory storage, audio only, ≤5 MB (≈60s m4a).
// expo-av records m4a, reported as audio/* or video/mp4 on some platforms.
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const m = (file.mimetype || '').toLowerCase();
    if (m.startsWith('audio/') || m === 'video/mp4') return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
});

function formatDist(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
function haversineMeters(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return null;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Meyou 密友 v2 — only monetisation is the Premium subscription:
//   monthly: RM 39.90
//   annual : RM 399.00 (~2 months free)
// Opening a dm with a non-matched user (an "intro") requires an active
// subscription. Already-matched conversations are always free.
const PREMIUM_PRICING = {
  monthly: { price: 39.9, currency: 'MYR', period: 'month' },
  annual:  { price: 399.9, currency: 'MYR', period: 'year'  },
};

// ── GET /api/conversations ─────────────────────────────────────────────────────
// List all conversations (mutual matches + dm-opened), formatted for MatchModel.fromJson
router.get('/', auth, async (req, res, next) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate(
        'users',
        'nickname avatarUrl isOnline lastActiveAt isPremium isBoosted countryCode isVerified isOfficial ' +
          'dob location preferences premiumExpiresAt vipLevel vipExpiresAt'
      )
      .lean();

    const myCoords = req.user.location?.coordinates;

    const result = matches
      .map((m) => {
        // populate() returns null for deleted/missing users — skip those slots
        const validUsers = m.users.filter(Boolean);
        const other = validUsers.find(
          (u) => u._id.toString() !== req.user._id.toString()
        );

        // Skip conversations where the other user no longer exists
        if (!other) return null;

        const unread = m.unreadCounts?.[req.user._id.toString()] || 0;

        // Respect the Premium "hide online status" opt-in (same gating as
        // toPublicJSON / the discover cards): null out presence for hiders.
        const hidden = !!other.preferences?.hideOnlineStatus && isPremiumActive(other);
        const distM = haversineMeters(myCoords, other.location?.coordinates);

        return {
          matchId: m._id.toString(),
          matchedAt: m.createdAt.toISOString(),
          user: {
            id: other._id.toString(),
            nickname: other.nickname,
            isOfficial: other.isOfficial ?? false,
            avatarUrl: other.avatarUrl ?? null,
            isOnline: hidden ? false : (other.isOnline ?? false),
            isPremium: other.isPremium ?? false,
            isBoosted: other.isBoosted ?? false,
            isVerified: other.isVerified ?? false,
            countryCode: other.countryCode ?? null,
            dob: other.dob ? other.dob.toISOString() : null,
            lastActiveAt: hidden
              ? null
              : other.lastActiveAt
                ? other.lastActiveAt.toISOString()
                : null,
            distance: formatDist(distM),
            distanceM: distM,
          },
          lastMessage: m.lastMessage ?? null,
          lastMessageAt: m.lastMessageAt ? m.lastMessageAt.toISOString() : null,
          // A preview with no human sender = the system match greeting; the
          // client localizes + styles it.
          lastMessageSystem: !!(m.lastMessage && !m.lastMessageBy),
          unreadCount: unread,
          source: m.source ?? 'match',
        };
      })
      .filter(Boolean); // remove nulls from skipped entries

    ok(res, result);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/open/:userId ───────────────────────────────────────
// Find existing conversation or create one. Opening a dm with someone you
// haven't matched yet charges FIRST_MESSAGE_COST coins from User.coins;
// already-matched users open for free.
//
// Returns:
//   200 { matchId, coinsCharged: 0 }     — existing match / chat
//   201 { matchId, coinsCharged: 10 }    — newly opened dm, coins deducted
//   402 { error, required, balance }     — insufficient coins
router.post('/open/:userId', auth, async (req, res, next) => {
  try {
    const senderId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    if (senderId === targetUserId) {
      return err(res, 'Cannot open a conversation with yourself', 400);
    }

    const receiver = await User.findById(targetUserId).select('_id nickname');
    if (!receiver) return err(res, 'User not found', 404);

    // Existing match / chat: free
    const existing = await Match.findOne({
      users: { $all: [senderId, targetUserId] },
      isActive: true,
    });
    if (existing) {
      return ok(res, { matchId: existing._id.toString(), premium: false });
    }

    // New intro dm requires an active Premium subscription.
    if (!isPremiumActive(req.user)) {
      return res.status(402).json({
        error: '需要 Premium 会员',
        reason: 'premium_required',
        pricing: PREMIUM_PRICING,
      });
    }

    const match = await Match.create({
      users: [senderId, targetUserId],
      source: 'dm',
    });
    return ok(
      res,
      { matchId: match._id.toString(), premium: true },
      201,
    );
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/voice-upload ──────────────────────────────────────
// Upload a chat voice clip → returns { mediaUrl }. Two-step like images: the
// client then POSTs /:matchId/send with { type:'voice', mediaUrl, duration }.
router.post('/voice-upload', auth, voiceUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded', 400);
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.m4a';
    const key = `voice-msg-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    let url = await r2.uploadFile(req.file.buffer, key, req.file.mimetype);
    if (!url) {
      await fs.promises.writeFile(path.join(uploadDir, key), req.file.buffer);
      url = `${req.protocol}://${req.get('host')}/uploads/${key}`;
    }
    ok(res, { mediaUrl: url });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/:matchId/send ─────────────────────────────────────
// HTTP fallback for sending a message (used when socket is disconnected).
// Also emits via Socket.io so the receiver gets real-time delivery if online.
router.post('/:matchId/send', auth, async (req, res, next) => {
  try {
    const { content, type = 'text', mediaUrl, location, duration } = req.body;

    const ALLOWED = ['text', 'sticker', 'image', 'location', 'voice'];
    const msgType = ALLOWED.includes(type) ? type : 'text';

    // Per-type validation. Each branch returns 400 with a precise reason
    // so the client can show the field-level error.
    if (msgType === 'text' || msgType === 'sticker') {
      if (!content?.trim()) return err(res, 'content required', 400);
      if (content.length > 2000) return err(res, 'message too long', 400);
    } else if (msgType === 'image') {
      if (!mediaUrl || !String(mediaUrl).trim()) {
        return err(res, 'mediaUrl required for image', 400);
      }
    } else if (msgType === 'voice') {
      if (!mediaUrl || !String(mediaUrl).trim()) {
        return err(res, 'mediaUrl required for voice', 400);
      }
      if (typeof duration !== 'number' || duration < 300 || duration > 120000) {
        return err(res, 'duration (ms) required for voice', 400);
      }
    } else if (msgType === 'location') {
      if (
        !location ||
        typeof location.lat !== 'number' ||
        typeof location.lng !== 'number'
      ) {
        return err(res, 'location.lat and location.lng required', 400);
      }
    }

    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
      isActive: true,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    const messageData = {
      matchId: match._id,
      senderId: req.user._id,
      type: msgType,
      readBy: [req.user._id],
    };
    if (content?.trim()) messageData.content = content.trim();
    // Soft scam/phishing scan on text (item 11) — flag, never block.
    if (msgType === 'text' && messageData.content) {
      const { scanScam } = require('../utils/contentSafety');
      const scan = scanScam(messageData.content);
      if (scan.flagged) {
        messageData.flagged = true;
        messageData.flagReason = scan.reason;
      }
    }
    if (msgType === 'image') {
      messageData.mediaUrl = String(mediaUrl).trim();
      messageData.mediaType = 'image';
      // 30-day TTL on image URLs. After this the GET handler rotates
      // mediaUrl to null with expired:true so the client can render a
      // "Photo expired" placeholder; real B2 delete happens via the
      // admin cleanup endpoint after a further 7-day grace.
      messageData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    if (msgType === 'voice') {
      messageData.mediaUrl = String(mediaUrl).trim();
      messageData.duration = Math.round(duration);
    }
    if (msgType === 'location') {
      messageData.location = {
        lat: location.lat,
        lng: location.lng,
        label:
          typeof location.label === 'string'
            ? location.label.trim().slice(0, 200)
            : null,
      };
    }
    const message = await Message.create(messageData);

    const otherId = match.users
      .find((u) => u.toString() !== req.user._id.toString())
      ?.toString();

    // previewOf collapses image/location to a glyph + label so chats-list
    // and push body show "📷 Photo" / "📍 Location" instead of raw URLs.
    const preview = Message.previewOf(message);

    await Match.findByIdAndUpdate(match._id, {
      lastMessage: preview,
      lastMessageAt: new Date(),
      lastMessageBy: req.user._id,
      ...(otherId ? { $inc: { [`unreadCounts.${otherId}`]: 1 } } : {}),
    });

    const payload = {
      id: message._id.toString(),
      matchId: match._id.toString(),
      senderId: req.user._id.toString(),
      content: message.content || '',
      type: message.type,
      mediaUrl: message.mediaUrl || null,
      mediaType: message.mediaType || null,
      duration: message.duration || null,
      flagged: message.flagged || false,
      location: message.location
        ? {
            lat: message.location.lat,
            lng: message.location.lng,
            label: message.location.label || null,
          }
        : null,
      createdAt: message.createdAt.toISOString(),
      readBy: [req.user._id.toString()],
    };

    // Push via socket if server instance is available
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        io.to(`user:${req.user._id.toString()}`).emit('chat:receive', payload);
        if (otherId) io.to(`user:${otherId}`).emit('chat:receive', payload);
      }
    } catch (_) {}

    // Push notification to receiver. Detached so HTTP response isn't
    // delayed by the FCM round-trip. Same flow as the WS handler in
    // socketService.js — most chat messages come through this HTTP path
    // (client uses api.post /conversations/:matchId/send), so this is
    // the primary push trigger for chat. (Was missing prior to this fix,
    // which is why iPhone never saw chat-message notifications.)
    if (otherId && otherId !== req.user._id.toString()) {
      (async () => {
        try {
          console.log('[push] chat http-route hook firing →', otherId, 'type=', msgType);
          const sender = await User.findById(req.user._id).select('nickname').lean();
          const senderName = sender?.nickname || 'New message';
          await sendPushToUser(otherId, {
            title: senderName,
            body: preview.slice(0, 140),
            data: { type: 'message', matchId: match._id.toString() },
          });
        } catch (e) {
          console.warn('[push] chat http-route hook failed:', e?.message ?? e);
        }
      })();
    }

    ok(res, payload, 201);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/conversations/:userId/messages ────────────────────────────────────
// Message history with a specific user (by their userId, not matchId)
router.get('/:userId/messages', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      users: { $all: [req.user._id, req.params.userId] },
      isActive: true,
    });

    if (!match) return ok(res, []);

    const { before, limit = 50 } = req.query;
    const query = { matchId: match._id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Two transforms per row:
    //   1) Image-expiry: type=image whose 30-day TTL has passed gets
    //      mediaUrl=null + expired=true so the client can render a
    //      "Photo expired" placeholder. We DO NOT mutate the DB here
    //      — real cleanup runs on the admin endpoint with B2 delete.
    //      A row that has already been cleaned (mediaUrl was nullified
    //      out-of-band) gets expired=true regardless of expiresAt.
    //   2) Premium gating on readBy. Free users never see the array so
    //      "your message was read" can't be inferred client-side.
    const isPremium = isPremiumActive(req.user);
    const now = Date.now();
    const sanitized = messages.map((raw) => {
      // Normalize _id → id so the client uses the same shape across all
      // three message-delivery paths (GET messages, POST send response,
      // WS chat:receive). Without this, every image bubble loaded via
      // this endpoint had msg.id = undefined → ImageBubble cached to
      // chat-images/undefined.jpg and ALL images aliased to whichever
      // bytes happened to land there first. Edit/Delete URLs also went
      // to /messages/undefined and silently 404'd.
      let m = { ...raw, id: raw._id.toString() };
      // Reactions: lean() returns a Map (JSON-stringifies to {}) — normalize to
      // a plain { emoji: [userId,…] } object so the client can render pills.
      m.reactions = Message.serializeReactions(raw.reactions);
      if (m.type === 'image') {
        const ttl = m.expiresAt ? new Date(m.expiresAt).getTime() : null;
        if (ttl !== null && ttl < now) {
          m = { ...m, mediaUrl: null, expired: true };
        } else if (m.mediaUrl == null) {
          // already cleaned by the admin pass
          m = { ...m, expired: true };
        }
      }
      if (!isPremium) {
        const { readBy, ...rest } = m;
        m = rest;
      }
      return m;
    });

    ok(res, sanitized.reverse());
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/:matchId/read ─────────────────────────────────────
// Reliable HTTP mark-as-read. The WS `join_room` emit is fire-and-forget and
// SILENTLY drops when the socket isn't connected yet (common on first open /
// after backgrounding) — which left the unread badge sticking until the chat
// was opened a SECOND time. This deterministic endpoint marks every message
// readBy the caller + zeroes their unreadCounts on the Match, and broadcasts
// chat:read so the other party's "seen" state updates.
router.post('/:matchId/read', auth, async (req, res, next) => {
  try {
    const uid = req.user._id.toString();
    const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id });
    if (!match) return err(res, 'Conversation not found', 404);

    await Message.updateMany(
      { matchId: match._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } },
    );
    await Match.findByIdAndUpdate(match._id, { [`unreadCounts.${uid}`]: 0 });

    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        const otherId = match.users.find((u) => u.toString() !== uid)?.toString();
        if (otherId) {
          io.to(`user:${otherId}`).emit('chat:read', {
            matchId: match._id.toString(),
            readBy: uid,
          });
        }
      }
    } catch (_) {}

    ok(res, { matchId: match._id.toString(), unreadCount: 0 });
  } catch (e) {
    next(e);
  }
});

// ── Helper: refresh Match.lastMessage from the current newest message ────────
// Called after an edit (latest's content may have changed) or delete
// (the deleted row may have been the latest). One small query each.
async function refreshMatchLastMessage(matchId) {
  const newest = await Message.findOne({ matchId }).sort({ createdAt: -1 });
  await Match.findByIdAndUpdate(matchId, {
    lastMessage: newest ? Message.previewOf(newest) : null,
    lastMessageAt: newest ? newest.createdAt : null,
    lastMessageBy: newest ? newest.senderId : null,
  });
}

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── PATCH /api/conversations/:matchId/messages/:msgId ────────────────────────
// Premium-only. Text messages only. Within 24h of send. Owner only.
//
// Body: { content }
// Returns updated message payload; broadcasts chat:edited to both parties.
router.patch('/:matchId/messages/:msgId', auth, async (req, res, next) => {
  try {
    if (!isPremiumActive(req.user)) {
      return err(res, 'Premium required', 402);
    }
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return err(res, 'content required', 400);
    }
    if (String(content).length > 2000) {
      return err(res, 'message too long', 400);
    }

    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
      isActive: true,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: req.params.msgId,
      matchId: match._id,
    });
    if (!message) return err(res, 'Message not found', 404);

    // Ownership
    if (message.senderId.toString() !== req.user._id.toString()) {
      return err(res, 'Forbidden', 403);
    }
    // Only text is editable. image/sticker/location stay immutable.
    if (message.type !== 'text') {
      return err(res, 'Only text messages can be edited', 400);
    }
    // 24h window
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      return err(res, 'Edit window expired', 410);
    }

    message.content = String(content).trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    // If this is the latest message in the thread the preview also changed.
    // Easier than guarding: always recompute.
    await refreshMatchLastMessage(match._id);

    const payload = {
      id: message._id.toString(),
      matchId: match._id.toString(),
      content: message.content,
      edited: true,
      editedAt: message.editedAt.toISOString(),
    };

    // Broadcast to both parties (sender gets confirmation, receiver
    // updates their bubble). Mirrors the chat:receive emit pattern.
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        const otherId = match.users
          .find((u) => u.toString() !== req.user._id.toString())
          ?.toString();
        io.to(`user:${req.user._id.toString()}`).emit('chat:edited', payload);
        if (otherId) io.to(`user:${otherId}`).emit('chat:edited', payload);
      }
    } catch (_) {}

    ok(res, payload);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/conversations/:matchId/messages/:msgId ────────────────────────
// Owner only. Any message type (text / image / location). Standard messenger
// UX — NOT Premium-gated. Hard-deletes the row; image messages also B2-delete
// their mediaUrl (best effort).
router.delete('/:matchId/messages/:msgId', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
      isActive: true,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: req.params.msgId,
      matchId: match._id,
    });
    if (!message) return err(res, 'Message not found', 404);

    if (message.senderId.toString() !== req.user._id.toString()) {
      return err(res, 'Forbidden', 403);
    }

    // If this carried an image, best-effort B2 cleanup. The DB row
    // goes away regardless so the user isn't blocked by a bucket
    // hiccup.
    if (message.type === 'image' && message.mediaUrl) {
      const r2 = require('../services/r2Service');
      const key = r2.keyFromUrl(message.mediaUrl);
      if (key) r2.deleteFile(key).catch(() => {});
    }

    await message.deleteOne();
    await refreshMatchLastMessage(match._id);

    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        const otherId = match.users
          .find((u) => u.toString() !== req.user._id.toString())
          ?.toString();
        const payload = {
          matchId: match._id.toString(),
          messageId: req.params.msgId,
        };
        io.to(`user:${req.user._id.toString()}`).emit('chat:deleted', payload);
        if (otherId) io.to(`user:${otherId}`).emit('chat:deleted', payload);
      }
    } catch (_) {}

    ok(res, { messageId: req.params.msgId });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/conversations/:matchId/messages/:msgId/reactions ────────────────
// Toggle the caller's emoji reaction on a message (WhatsApp/iMessage-style).
// Body: { emoji }. Any participant of the conversation may react (NOT owner-only,
// unlike edit/delete). Toggles: if the caller already reacted with this emoji it
// is removed, else added. Broadcasts chat:reaction-added / chat:reaction-removed
// to BOTH parties with the message's full updated reactions map.
//
// In-memory per-user rate limit: max 10 toggles/sec (best-effort; the process is
// single-region so a plain Map suffices — abuse is cosmetic, not destructive).
const reactionHits = new Map(); // userId -> recent toggle timestamps (ms)
function reactionRateLimited(userId) {
  const now = Date.now();
  const recent = (reactionHits.get(userId) || []).filter((t) => now - t < 1000);
  recent.push(now);
  reactionHits.set(userId, recent);
  return recent.length > 10;
}

router.post('/:matchId/messages/:msgId/reactions', auth, async (req, res, next) => {
  try {
    const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : '';
    if (!emoji) return err(res, 'emoji required', 400);
    // Cap length (a single emoji incl. ZWJ sequences/skin tones stays well under
    // 8 code units); blocks abusive long strings without an emoji-only regex
    // that would reject valid compound emoji.
    if (emoji.length > 8) return err(res, 'emoji too long', 400);
    if (reactionRateLimited(req.user._id.toString())) {
      return err(res, 'Too many reactions', 429);
    }

    // Membership check (same gate as edit/delete) — only conversation
    // participants can react.
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
      isActive: true,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: req.params.msgId,
      matchId: match._id,
    });
    if (!message) return err(res, 'Message not found', 404);

    if (!message.reactions) message.reactions = new Map();
    const uid = req.user._id.toString();
    const list = (message.reactions.get(emoji) || []).map((x) => x.toString());
    let action;
    if (list.includes(uid)) {
      const next = list.filter((x) => x !== uid);
      if (next.length) message.reactions.set(emoji, next);
      else message.reactions.delete(emoji); // drop empty buckets
      action = 'removed';
    } else {
      message.reactions.set(emoji, [...list, uid]);
      action = 'added';
    }
    message.markModified('reactions');
    await message.save();

    const reactions = Message.serializeReactions(message.reactions);
    const payload = {
      matchId: match._id.toString(),
      messageId: message._id.toString(),
      emoji,
      userId: uid,
      reactions,
    };

    // Broadcast to both parties — mirrors the chat:edited / chat:deleted emits.
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        const otherId = match.users
          .find((u) => u.toString() !== uid)
          ?.toString();
        const event =
          action === 'added' ? 'chat:reaction-added' : 'chat:reaction-removed';
        io.to(`user:${uid}`).emit(event, payload);
        if (otherId) io.to(`user:${otherId}`).emit(event, payload);
      }
    } catch (_) {}

    ok(res, { ...payload, action });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/conversations/:matchId — unmatch ──────────────────────────────
// Tombstones the match: sets isActive=false so it disappears from both users'
// chat lists. Messages stay in the DB for moderation review.
router.delete('/:matchId', auth, async (req, res, next) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return err(res, 'Conversation not found', 404);

    match.isActive = false;
    await match.save();

    // Push to BOTH users so their chat lists update in real time.
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        for (const uid of match.users.map((u) => u.toString())) {
          io.to(`user:${uid}`).emit('match:removed', { matchId: match._id.toString() });
        }
      }
    } catch (_) {}

    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
