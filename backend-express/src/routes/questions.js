const router = require('express').Router();
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');
const { ok, created, err } = require('../utils/respond');

// ── Rate-limit helper: 3 questions/day for free users ─────────────────────────
async function checkDailyLimit(senderUser) {
  if (senderUser.isPremium || (senderUser.vipLevel && senderUser.vipLevel > 0)) return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await Question.countDocuments({
    senderUser: senderUser._id,
    createdAt: { $gte: start },
  });
  return count < 3;
}

// ── POST /api/questions/ask/:id ───────────────────────────────────────────────
// Send a question to a user (optionally anonymous).
// Previously: POST /api/users/:id/questions
router.post('/ask/:id', auth, async (req, res, next) => {
  try {
    const { content, isAnonymous = true } = req.body;
    if (!content || !content.trim()) return err(res, 'Content is required');
    if (req.params.id === req.user._id.toString()) {
      return err(res, 'Cannot ask yourself');
    }

    const canAsk = await checkDailyLimit(req.user);
    if (!canAsk) {
      return err(res, '今日提问次数已达上限（免费用户3次/天），升级VIP即可无限提问', 429);
    }

    const question = await Question.create({
      targetUser: req.params.id,
      senderUser: isAnonymous ? null : req.user._id,
      content: content.trim(),
      isAnonymous,
    });

    created(res, question);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/questions/inbox ──────────────────────────────────────────────────
// My received questions (newest first, paginated).
router.get('/inbox', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find({ targetUser: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('senderUser', 'nickname avatarUrl isPremium')
      .lean();

    ok(res, questions);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/questions/:id/answer ────────────────────────────────────────────
router.post('/:id/answer', auth, async (req, res, next) => {
  try {
    const { answer, isPublic = false } = req.body;
    if (!answer || !answer.trim()) return err(res, 'Answer is required');

    const question = await Question.findOne({
      _id: req.params.id,
      targetUser: req.user._id,
    });
    if (!question) return err(res, 'Question not found', 404);

    question.answer = answer.trim();
    question.isPublic = isPublic;
    question.answeredAt = new Date();
    await question.save();

    ok(res, question);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/questions/:id ─────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      targetUser: req.user._id,
    });
    if (!question) return err(res, 'Question not found', 404);
    await question.deleteOne();
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/questions/user/:id/public ────────────────────────────────────────
// Public answered Q&A shown on a user's profile.
// Previously: GET /api/users/:id/questions/public
router.get('/user/:id/public', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find({
      targetUser: req.params.id,
      isPublic: true,
      answer: { $ne: null },
    })
      .sort({ answeredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('senderUser', 'nickname avatarUrl')
      .lean();

    ok(res, questions);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
