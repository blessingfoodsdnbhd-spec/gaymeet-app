const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');
const CallLog = require('../models/CallLog');
const GroupChat = require('../models/GroupChat');
const GroupMessage = require('../models/GroupMessage');

let io;

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

    // Join a personal room so server can push to this user directly
    socket.join(`user:${userId}`);

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
    // Payload: { matchId: string, content: string, type?: 'text'|'sticker' }
    socket.on('chat:send', async ({ matchId, content, type = 'text' } = {}) => {
      if (!matchId || !content?.trim()) return;
      if (content.length > 2000) return;

      // Verify sender is in the match
      const match = await Match.findOne({
        _id: matchId,
        users: userId,
        isActive: true,
      });
      if (!match) return;

      // Persist message
      const message = await Message.create({
        matchId,
        senderId: userId,
        content: content.trim(),
        type: ['text', 'sticker'].includes(type) ? type : 'text',
        readBy: [userId],
      });

      // Find the other user
      const otherId = match.users
        .find((u) => u.toString() !== userId)
        ?.toString();

      // Increment unread for the other user
      await Match.findByIdAndUpdate(matchId, {
        lastMessage: content.trim().slice(0, 100),
        lastMessageAt: new Date(),
        lastMessageBy: userId,
        $inc: { [`unreadCounts.${otherId}`]: 1 },
      });

      const payload = {
        id: message._id.toString(),
        matchId,
        senderId: userId,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        readBy: [userId],
      };

      // Exactly one delivery each: sender gets confirmation, receiver gets the message.
      // Using personal rooms avoids the double-delivery that occurred when the receiver
      // was in both the match room AND their personal user room simultaneously.
      io.to(`user:${userId}`).emit('chat:receive', payload);
      io.to(`user:${otherId}`).emit('chat:receive', payload);
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

      // Notify the other party that messages were read
      io.to(`match:${matchId}`).emit('chat:read', { matchId, readBy: userId });
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

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${userId}`);
      // Only mark offline if no other sockets for this user remain
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActiveAt: new Date(),
        });
        _notifyOnlineStatus(userId, false);
      }
    });
  });

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

module.exports = { initSocket, getIO };
