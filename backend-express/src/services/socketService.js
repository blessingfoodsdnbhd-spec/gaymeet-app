const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');
const CallLog = require('../models/CallLog');
const GroupChat = require('../models/GroupChat');
const GroupMessage = require('../models/GroupMessage');
const { sendPushToUser } = require('../utils/push');
const { isAllowed } = require('./notificationService');
const { ALL_ROOMS, VALID_ROOM_IDS, socketRoom } = require('../config/worldChatRooms');
const { identityOf } = require('../utils/identity');
const xpService = require('./xpService');

let io;

// Plaza §9.1 — in-room online roster sort:身份等级 → 用户等级 → 加入顺序.
const TIER_RANK = { admin: 0, vip: 1, legend: 2, old: 3, normal: 4, new: 5 };

/**
 * Build the mIRC-style online roster for a World Chat room from the socket
 * adapter. Dedups multi-socket users (keeps the earliest join), sorts by
 * identity tier → level desc → join order. Each entry: { userId, name,
 * avatarUrl, tier, level }.
 */
async function buildRoster(roomId) {
  if (!io || !roomId) return { roomId, online: 0, users: [] };
  let sockets = [];
  try {
    sockets = await io.in(socketRoom(roomId)).fetchSockets();
  } catch (_) {
    return { roomId, online: 0, users: [] };
  }
  const byUser = new Map();
  for (const s of sockets) {
    const d = s.data || {};
    const id = d.userId;
    if (!id) continue;
    const joinedMs = d.wcJoinedMs || 0;
    const prev = byUser.get(id);
    if (!prev || joinedMs < prev.joinedMs) {
      byUser.set(id, { ...(d.identitySnapshot || {}), userId: id, joinedMs });
    }
  }
  const users = [...byUser.values()].sort(
    (a, b) =>
      (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) ||
      (b.level || 1) - (a.level || 1) ||
      a.joinedMs - b.joinedMs,
  );
  return {
    roomId,
    online: users.length,
    users: users.map((u) => ({ userId: u.userId, name: u.name, avatarUrl: u.avatarUrl ?? null, tier: u.tier, level: u.level })),
  };
}

/** Push the fresh roster to everyone currently in a room. */
async function emitRoster(roomId) {
  if (!io || !roomId) return;
  const roster = await buildRoster(roomId);
  io.to(socketRoom(roomId)).emit('world-chat:roster', roster);
}

/** Live online count per World Chat room (from the socket.io adapter). */
function getRoomCounts() {
  const counts = {};
  for (const r of ALL_ROOMS) {
    counts[r.id] = io ? io.sockets.adapter.rooms.get(socketRoom(r.id))?.size ?? 0 : 0;
  }
  return counts;
}

/** Push a full rooms snapshot to everyone + a per-room count to each room. */
function emitRoomsState() {
  if (!io) return;
  const counts = getRoomCounts();
  io.emit('world-chat:rooms-state', { counts });
  for (const r of ALL_ROOMS) {
    io.to(socketRoom(r.id)).emit('world-chat:online-count', { roomId: r.id, count: counts[r.id] });
  }
}

/** Live online count for ANY room id (country code or custom ChatRoom id). */
function roomOnlineCount(roomId) {
  return io ? io.sockets.adapter.rooms.get(socketRoom(roomId))?.size ?? 0 : 0;
}

/** Push a fresh count to one room — used for custom rooms, which aren't in the
 *  periodic ROOMS snapshot. */
function emitRoomCount(roomId) {
  if (!io || !roomId) return;
  io.to(socketRoom(roomId)).emit('world-chat:online-count', { roomId, count: roomOnlineCount(roomId) });
}

const isCustomRoomId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

/**
 * Announce a join/leave to everyone currently in a World Chat room — the
 * mIRC-style "🎉 X joined / 👋 X left" system line. Ephemeral: not persisted,
 * so only users present in the room at that moment see it.
 */
function emitPresenceEvent(kind, roomId, user) {
  if (!io || !roomId || !user) return;
  const event = kind === 'join' ? 'world-chat:user-joined' : 'world-chat:user-left';
  io.to(socketRoom(roomId)).emit(event, {
    roomId,
    userId: (user._id || user.id || '').toString(),
    userName: user.nickname || 'Someone',
  });
}

/**
 * Initialise Socket.io on the given HTTP server.
 * Must be called once from server.js after connectDB().
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
  });

  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection ──────────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: ${userId}`);

    // Mark user online
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastActiveAt: new Date(),
    });

    // Plaza §9.2 — daily first-login XP bonus (+10, 1×/day; service no-ops if
    // already claimed or over the daily cap). Best-effort, never blocks connect.
    try {
      xpService.awardLoginXp(socket.user);
    } catch (_) {
      /* best effort */
    }

    // Identity snapshot used by the in-room roster (RemoteSocket only exposes
    // .data, so we stash what the roster needs there).
    const identitySnapshot = {
      name: socket.user?.nickname || 'Someone',
      avatarUrl: socket.user?.avatarUrl || null,
      ...identityOf(socket.user),
    };

    // Join a personal room so server can push to this user directly
    socket.join(`user:${userId}`);

    // World Chat: join the default 'world' room until the client switches.
    socket.data = { ...(socket.data || {}), wcRoom: 'world', wcJoinedMs: Date.now(), userId, identitySnapshot };
    socket.join(socketRoom('world'));
    emitPresenceEvent('join', 'world', socket.user);
    emitRoster('world');

    // Notify matches that this user came online
    _notifyOnlineStatus(userId, true);

    // ── join_room ─────────────────────────────────────────────────────────────
    // Client sends this when opening a chat screen.
    // Payload: { matchId: string }
    socket.on('join_room', async ({ matchId } = {}) => {
      if (!matchId) return;

      // Verify membership
      const match = await Match.findOne({ _id: matchId, users: userId });
      if (!match) return;

      socket.join(`match:${matchId}`);
      console.log(`   → ${userId} joined room match:${matchId}`);

      // Mark all unread messages as read
      await Message.updateMany(
        { matchId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      // Reset unread count
      await Match.findByIdAndUpdate(matchId, {
        [`unreadCounts.${userId}`]: 0,
      });
    });

    // ── leave_room ────────────────────────────────────────────────────────────
    socket.on('leave_room', ({ matchId } = {}) => {
      if (matchId) socket.leave(`match:${matchId}`);
    });

    // ── chat:send ─────────────────────────────────────────────────────────────
    // Payload (any of the supported types):
    //   { matchId, type: 'text'|'sticker', content }
    //   { matchId, type: 'image',          mediaUrl }
    //   { matchId, type: 'location',       location: { lat, lng, label? } }
    // Mirrors the validation in routes/conversations.js POST /send.
    socket.on(
      'chat:send',
      async ({ matchId, content, type = 'text', mediaUrl, location, replyToMessageId } = {}) => {
        if (!matchId) return;

        const ALLOWED = ['text', 'sticker', 'image', 'location'];
        const msgType = ALLOWED.includes(type) ? type : 'text';

        // Per-type guards; silent drop on invalid since WS has no
        // response channel (HTTP path returns 400 with a reason).
        if (msgType === 'text' || msgType === 'sticker') {
          if (!content?.trim()) return;
          if (content.length > 2000) return;
        } else if (msgType === 'image') {
          if (!mediaUrl || !String(mediaUrl).trim()) return;
        } else if (msgType === 'location') {
          if (
            !location ||
            typeof location.lat !== 'number' ||
            typeof location.lng !== 'number'
          ) {
            return;
          }
        }

        // Admin chat-send ban — silently drop (WS has no response channel; the
        // HTTP path returns 403). One indexed lookup per send.
        if (await User.exists({ _id: userId, chatBanned: true })) return;

        // Verify sender is in the match
        const match = await Match.findOne({
          _id: matchId,
          users: userId,
          isActive: true,
        });
        if (!match) return;

        const messageData = {
          matchId,
          senderId: userId,
          type: msgType,
          readBy: [userId],
        };
        if (content?.trim()) messageData.content = content.trim();
        if (msgType === 'image') {
          messageData.mediaUrl = String(mediaUrl).trim();
          messageData.mediaType = 'image';
          // 30-day TTL — see routes/conversations.js for the rationale.
          messageData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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

        // Swipe-to-reply quote (mirrors routes/conversations.js POST /send).
        if (replyToMessageId && /^[0-9a-fA-F]{24}$/.test(String(replyToMessageId))) {
          const orig = await Message.findOne({ _id: replyToMessageId, matchId }).lean();
          if (orig) {
            messageData.replyTo = {
              messageId: orig._id,
              senderId: orig.senderId,
              type: orig.type,
              preview: Message.replyPreviewOf(orig),
            };
          }
        }

        const message = await Message.create(messageData);

        // Find the other user
        const otherId = match.users
          .find((u) => u.toString() !== userId)
          ?.toString();

        // Preview goes to Match.lastMessage AND the push body so both
        // surfaces show "📷 Photo" / "📍 Location" instead of raw URLs.
        const preview = Message.previewOf(message);

        await Match.findByIdAndUpdate(matchId, {
          lastMessage: preview,
          lastMessageAt: new Date(),
          lastMessageBy: userId,
          $inc: { [`unreadCounts.${otherId}`]: 1 },
        });

        const payload = {
          id: message._id.toString(),
          matchId,
          senderId: userId,
          content: message.content || '',
          type: message.type,
          mediaUrl: message.mediaUrl || null,
          mediaType: message.mediaType || null,
          location: message.location
            ? {
                lat: message.location.lat,
                lng: message.location.lng,
                label: message.location.label || null,
              }
            : null,
          replyTo: message.replyTo
            ? {
                id: message.replyTo.messageId?.toString() ?? null,
                senderId: message.replyTo.senderId?.toString() ?? null,
                type: message.replyTo.type ?? null,
                preview: message.replyTo.preview ?? '',
              }
            : null,
          createdAt: message.createdAt.toISOString(),
          readBy: [userId],
        };

        // Exactly one delivery each: sender gets confirmation, receiver gets the message.
        // Using personal rooms avoids the double-delivery that occurred when the receiver
        // was in both the match room AND their personal user room simultaneously.
        io.to(`user:${userId}`).emit('chat:receive', payload);
        io.to(`user:${otherId}`).emit('chat:receive', payload);

        // Best-effort push to the receiver — runs detached so socket emit
        // is never delayed by the FCM round-trip. Foreground client decides
        // how/whether to display (handler in app-rn/src/utils/push.ts).
        if (otherId && otherId !== userId) {
          (async () => {
            try {
              if (!(await isAllowed(otherId, 'message'))) return; // user muted new-message push
              console.log('[push] chat ws-route hook firing →', otherId, 'type=', msgType);
              const sender = await User.findById(userId).select('nickname').lean();
              const senderName = sender?.nickname || 'New message';
              await sendPushToUser(otherId, {
                title: senderName,
                body: preview.slice(0, 140),
                data: { type: 'message', matchId },
              });
            } catch (e) {
              console.warn('[push] chat ws-route hook failed:', e?.message ?? e);
            }
          })();
        }
      },
    );

    // ── chat:typing ───────────────────────────────────────────────────────────
    // Payload: { matchId: string, typing: boolean }
    // Pass-through relay — server doesn't persist, just forwards to the other
    // member of the match's personal room.
    socket.on('chat:typing', async ({ matchId, typing = true } = {}) => {
      if (!matchId) return;
      const match = await Match.findOne({ _id: matchId, users: userId });
      if (!match) return;
      const otherId = match.users
        .find((u) => u.toString() !== userId)
        ?.toString();
      if (!otherId) return;
      io.to(`user:${otherId}`).emit('chat:typing', {
        matchId,
        fromUserId: userId,
        typing: !!typing,
      });
    });

    // ── chat:read ─────────────────────────────────────────────────────────────
    // Payload: { matchId: string }
    socket.on('chat:read', async ({ matchId } = {}) => {
      if (!matchId) return;

      const match = await Match.findOne({ _id: matchId, users: userId });
      if (!match) return;

      await Message.updateMany(
        { matchId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      await Match.findByIdAndUpdate(matchId, {
        [`unreadCounts.${userId}`]: 0,
      });

      // Read receipts are Premium-only. Only emit the "your message was
      // read" event to the OTHER party (the sender of the now-read
      // messages) AND only if THAT party is premium. Otherwise the free
      // sender shouldn't see read state, and the reader doesn't need
      // an echo of their own action.
      const otherId = match.users
        .find((u) => u.toString() !== userId)
        ?.toString();
      if (otherId) {
        const { isPremiumActive } = require('../utils/premium');
        const otherUser = await User.findById(otherId).select(
          'isPremium premiumExpiresAt vipLevel vipExpiresAt',
        );
        if (otherUser && isPremiumActive(otherUser)) {
          io.to(`user:${otherId}`).emit('chat:read', {
            matchId,
            readBy: userId,
          });
        }
      }
    });

    // ── group:join ────────────────────────────────────────────────────────────
    // Client sends when opening a group chat screen.
    socket.on('group:join', async ({ groupId } = {}) => {
      if (!groupId) return;
      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
      }).lean();
      if (!group) return;
      socket.join(`group:${groupId}`);
    });

    // ── group:leave_room ──────────────────────────────────────────────────────
    socket.on('group:leave_room', ({ groupId } = {}) => {
      if (groupId) socket.leave(`group:${groupId}`);
    });

    // ── group:send ────────────────────────────────────────────────────────────
    // Payload: { groupId, content, type? }
    socket.on('group:send', async ({ groupId, content, type = 'text' } = {}) => {
      if (!groupId || !content?.trim()) return;
      if (content.length > 2000) return;

      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
      });
      if (!group) return;

      const msg = await GroupMessage.create({
        group: groupId,
        sender: userId,
        content: content.trim(),
        type: ['text', 'sticker', 'image'].includes(type) ? type : 'text',
      });

      group.lastMessage = content.trim().slice(0, 100);
      group.lastMessageAt = new Date();
      await group.save();

      const populated = await msg.populate('sender', 'nickname avatarUrl level');
      io.to(`group:${groupId}`).emit('group:receive', populated.toObject());
    });

    // ── call:initiate ─────────────────────────────────────────────────────────
    // Payload: { receiverId: string, type: 'voice'|'video' }
    socket.on('call:initiate', async ({ receiverId, type = 'voice' } = {}) => {
      if (!receiverId) return;

      // Check if receiver is busy (already in a call — tracked via socket data)
      const receiverSockets = await io.in(`user:${receiverId}`).fetchSockets();
      const receiverBusy = receiverSockets.some((s) => s.data?.inCall);
      if (receiverBusy) {
        socket.emit('call:busy', { receiverId });
        return;
      }

      // Create pending call log
      const callLog = await CallLog.create({
        caller: userId,
        receiver: receiverId,
        type,
        status: 'missed',
      });

      socket.data = { ...(socket.data || {}), inCall: true, callId: callLog._id.toString() };

      // Get caller info for the incoming screen
      const caller = await User.findById(userId).select('nickname avatarUrl').lean();

      io.to(`user:${receiverId}`).emit('call:incoming', {
        callId: callLog._id.toString(),
        callerId: userId,
        callerName: caller?.nickname ?? 'Unknown',
        callerAvatar: caller?.avatarUrl ?? null,
        type,
      });
    });

    // ── call:accept ───────────────────────────────────────────────────────────
    // Payload: { callId: string }
    socket.on('call:accept', async ({ callId } = {}) => {
      if (!callId) return;
      socket.data = { ...(socket.data || {}), inCall: true, callId };

      await CallLog.findByIdAndUpdate(callId, {
        status: 'answered',
        startedAt: new Date(),
      });

      const log = await CallLog.findById(callId).lean();
      if (log) {
        io.to(`user:${log.caller.toString()}`).emit('call:accepted', { callId });
      }
    });

    // ── call:decline ──────────────────────────────────────────────────────────
    // Payload: { callId: string }
    socket.on('call:decline', async ({ callId } = {}) => {
      if (!callId) return;

      await CallLog.findByIdAndUpdate(callId, { status: 'declined' });
      const log = await CallLog.findById(callId).lean();
      if (log) {
        io.to(`user:${log.caller.toString()}`).emit('call:declined', { callId });
      }
      socket.data = { ...(socket.data || {}), inCall: false, callId: null };
    });

    // ── call:end ──────────────────────────────────────────────────────────────
    // Payload: { callId: string, duration: number }
    socket.on('call:end', async ({ callId, duration = 0 } = {}) => {
      if (!callId) return;

      const now = new Date();
      await CallLog.findByIdAndUpdate(callId, {
        status: 'ended',
        endedAt: now,
        duration,
      });

      const log = await CallLog.findById(callId).lean();
      if (log) {
        const otherId =
          log.caller.toString() === userId
            ? log.receiver.toString()
            : log.caller.toString();
        io.to(`user:${otherId}`).emit('call:ended', { callId, duration });
      }
      socket.data = { ...(socket.data || {}), inCall: false, callId: null };
    });

    // World Chat: switch rooms. Client emits when entering a country OR a
    // custom (user-created) room. Custom room ids are 24-hex ChatRoom ids.
    socket.on('world-chat:join-room', ({ roomId } = {}) => {
      const next = VALID_ROOM_IDS.has(roomId) || isCustomRoomId(roomId) ? roomId : 'world';
      const prev = socket.data?.wcRoom || 'world';
      if (next !== prev) {
        // Announce the part to the old room while we're still in it, then the
        // join to the new room once we've entered.
        emitPresenceEvent('leave', prev, socket.user);
        socket.leave(socketRoom(prev));
        socket.join(socketRoom(next));
        socket.data = { ...(socket.data || {}), wcRoom: next, wcJoinedMs: Date.now() };
        emitPresenceEvent('join', next, socket.user);
        // Custom rooms aren't in the periodic ROOMS snapshot — push their counts.
        if (isCustomRoomId(prev)) emitRoomCount(prev);
        if (isCustomRoomId(next)) emitRoomCount(next);
        // Refresh the online roster for both the room left and the room entered.
        emitRoster(prev);
        emitRoster(next);
      } else {
        // No-op re-join: the socket is already in `next` — almost always the
        // global lobby 'world', which it auto-joined on connect. Membership is
        // unchanged, so the branch above never runs and nothing re-broadcasts the
        // roster/count. But the client that just (re)entered has freshly mounted
        // its WS listeners, and the connect-time broadcast raced ahead of them.
        // Push a fresh roster + count so the 在线名单 drawer and header count
        // populate — without this the 总聊天室 looked broken (empty roster / "—"
        // count) while sub-rooms, which re-broadcast on a real join, worked.
        emitRoster(next);
        socket.emit('world-chat:online-count', { roomId: next, count: roomOnlineCount(next) });
      }
      emitRoomsState();
    });

    // World Chat: on-demand online roster for the room the client just opened
    // (the right-sidebar 在线名单). Falls back to the socket's current room.
    socket.on('world-chat:request-roster', async ({ roomId } = {}) => {
      const rid = roomId || socket.data?.wcRoom || 'world';
      socket.emit('world-chat:roster', await buildRoster(rid));
    });

    // Give the freshly-connected client (and everyone) the current snapshot.
    emitRoomsState();

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${userId}`);
      // Announce the part to whichever World Chat room they were in. The socket
      // has already left its rooms, so the broadcast reaches the people staying.
      const wcRoom = socket.data?.wcRoom || 'world';
      emitPresenceEvent('leave', wcRoom, socket.user);
      emitRoster(wcRoom);
      // Only mark offline if no other sockets for this user remain
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActiveAt: new Date(),
        });
        _notifyOnlineStatus(userId, false);
      }
      // Socket has already left its rooms by 'disconnect' → counts are fresh.
      emitRoomsState();
    });
  });

  // World Chat: broadcast per-room online counts every 10s.
  setInterval(() => {
    try {
      emitRoomsState();
    } catch (_) {
      // best effort
    }
  }, 10_000).unref?.();

  return io;
}

/**
 * Notify all matches of a user's online/offline status change.
 */
async function _notifyOnlineStatus(userId, online) {
  try {
    const matches = await Match.find({ users: userId, isActive: true }).lean();
    for (const match of matches) {
      const otherId = match.users
        .find((u) => u.toString() !== userId)
        ?.toString();
      if (otherId) {
        io.to(`user:${otherId}`).emit(
          online ? 'user:online' : 'user:offline',
          { userId, online }
        );
      }
    }
  } catch (_) {
    // best effort
  }
}

/**
 * Get the running io instance (for use from route handlers if needed).
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}

module.exports = { initSocket, getIO, getRoomCounts, roomOnlineCount, buildRoster };
