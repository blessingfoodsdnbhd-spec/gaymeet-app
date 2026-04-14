const router = require('express').Router();
const GroupChat = require('../models/GroupChat');
const GroupMessage = require('../models/GroupMessage');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

// ── GET /api/groups — public groups + my groups ───────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const { tab = 'discover', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const uid = req.user._id;

    let filter;
    if (tab === 'mine') {
      filter = { 'members.user': uid };
    } else {
      // Discover: all public groups, sorted by activity
      filter = { isPublic: true };
    }

    const groups = await GroupChat.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('creator', 'nickname avatarUrl')
      .lean();

    // Annotate with membership
    ok(
      res,
      groups.map((g) => ({
        ...g,
        memberCount: g.members.length,
        isMember: g.members.some((m) => m.user.toString() === uid.toString()),
        members: undefined, // don't send full list in feed
      }))
    );
  } catch (e) {
    next(e);
  }
});

// ── GET /api/groups/:id — group detail ───────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const group = await GroupChat.findById(req.params.id)
      .populate('creator', 'nickname avatarUrl')
      .populate('members.user', 'nickname avatarUrl isOnline level')
      .lean();
    if (!group) return err(res, 'Group not found', 404);

    const uid = req.user._id.toString();
    ok(res, {
      ...group,
      memberCount: group.members.length,
      isMember: group.members.some((m) => m.user._id.toString() === uid),
      isAdmin: group.admins.some((a) => a.toString() === uid),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/groups — create group ──────────────────────────────────────────
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description = '', isPublic = true, tags = [] } = req.body;
    if (!name?.trim()) return err(res, 'name required');

    const uid = req.user._id;
    const group = await GroupChat.create({
      name: name.trim().slice(0, 60),
      description: description.slice(0, 200),
      creator: uid,
      admins: [uid],
      members: [{ user: uid, role: 'admin' }],
      isPublic: !!isPublic,
      tags,
    });

    created(res, { ...group.toObject(), memberCount: 1, isMember: true, isAdmin: true });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/groups/:id — edit group (admin only) ───────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const uid = req.user._id.toString();
    const group = await GroupChat.findById(req.params.id);
    if (!group) return err(res, 'Group not found', 404);
    if (!group.admins.some((a) => a.toString() === uid)) {
      return err(res, 'Admin only', 403);
    }

    const allowed = ['name', 'description', 'isPublic', 'tags', 'avatar', 'maxMembers'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) group[key] = req.body[key];
    }
    await group.save();
    ok(res, group.toObject());
  } catch (e) {
    next(e);
  }
});

// ── POST /api/groups/:id/join ─────────────────────────────────────────────────
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const uid = req.user._id;
    const group = await GroupChat.findById(req.params.id);
    if (!group) return err(res, 'Group not found', 404);
    if (!group.isPublic) return err(res, 'Private group — invite required', 403);
    if (group.members.length >= group.maxMembers) {
      return err(res, 'Group is full', 400);
    }

    const alreadyMember = group.members.some((m) => m.user.toString() === uid.toString());
    if (alreadyMember) return ok(res, { joined: true });

    group.members.push({ user: uid, role: 'member' });
    await group.save();

    // System message
    const caller = await require('../models/User').findById(uid).select('nickname').lean();
    await GroupMessage.create({
      group: group._id,
      sender: uid,
      content: `${caller?.nickname ?? 'Someone'} joined the group`,
      type: 'system',
    });

    ok(res, { joined: true, memberCount: group.members.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/groups/:id/leave ────────────────────────────────────────────────
router.post('/:id/leave', auth, async (req, res, next) => {
  try {
    const uid = req.user._id.toString();
    const group = await GroupChat.findById(req.params.id);
    if (!group) return err(res, 'Group not found', 404);

    group.members = group.members.filter((m) => m.user.toString() !== uid);
    group.admins = group.admins.filter((a) => a.toString() !== uid);
    await group.save();

    ok(res, { left: true, memberCount: group.members.length });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/groups/:id/invite ───────────────────────────────────────────────
router.post('/:id/invite', auth, async (req, res, next) => {
  try {
    const uid = req.user._id.toString();
    const { userId: inviteeId } = req.body;
    if (!inviteeId) return err(res, 'userId required');

    const group = await GroupChat.findById(req.params.id);
    if (!group) return err(res, 'Group not found', 404);
    if (!group.admins.some((a) => a.toString() === uid)) {
      return err(res, 'Admin only', 403);
    }
    if (group.members.length >= group.maxMembers) {
      return err(res, 'Group is full', 400);
    }

    const alreadyMember = group.members.some((m) => m.user.toString() === inviteeId);
    if (alreadyMember) return ok(res, { invited: true });

    group.members.push({ user: inviteeId, role: 'member' });
    await group.save();
    ok(res, { invited: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/groups/:id/messages ──────────────────────────────────────────────
router.get('/:id/messages', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const group = await GroupChat.findById(req.params.id).lean();
    if (!group) return err(res, 'Group not found', 404);

    const uid = req.user._id.toString();
    const isMember = group.members.some((m) => m.user.toString() === uid);
    if (!isMember && !group.isPublic) {
      return err(res, 'Not a member', 403);
    }

    const messages = await GroupMessage.find({ group: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'nickname avatarUrl level isPremium')
      .lean();

    ok(res, messages.reverse());
  } catch (e) {
    next(e);
  }
});

// ── POST /api/groups/:id/messages — send message (REST fallback) ──────────────
router.post('/:id/messages', auth, async (req, res, next) => {
  try {
    const { content, type = 'text' } = req.body;
    if (!content?.trim()) return err(res, 'content required');

    const uid = req.user._id.toString();
    const group = await GroupChat.findById(req.params.id);
    if (!group) return err(res, 'Group not found', 404);

    const isMember = group.members.some((m) => m.user.toString() === uid);
    if (!isMember) return err(res, 'Not a member', 403);

    const msg = await GroupMessage.create({
      group: group._id,
      sender: req.user._id,
      content: content.trim().slice(0, 2000),
      type: ['text', 'sticker', 'image'].includes(type) ? type : 'text',
    });

    group.lastMessage = content.trim().slice(0, 100);
    group.lastMessageAt = new Date();
    await group.save();

    const populated = await msg.populate('sender', 'nickname avatarUrl level');

    // Broadcast via socket if available
    try {
      const { getIO } = require('../services/socketService');
      getIO().to(`group:${group._id}`).emit('group:receive', populated.toObject());
    } catch (_) { /* socket may not be initialised */ }

    created(res, populated.toObject());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
