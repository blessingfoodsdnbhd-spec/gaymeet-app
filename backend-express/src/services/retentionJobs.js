// Data-retention sweeps (RETENTION1, Phase 9). DESTRUCTIVE — disabled by default
// so merging/redeploying never deletes prod data unexpectedly. Enable explicitly
// with env RETENTION_ENABLED=true once the client keeps its own durable copy
// (Phase 10 SQLite). Mirrors the "relay-only + short server TTL" privacy model.
//
// Note: Plaza / World Chat already auto-expires via a 7-day TTL index on
// WorldChatMessage (see that model) — intentionally NOT reduced to zero here, so
// short-term history + the room long-press preview keep working.
const Message = require('../models/Message');
const Vote = require('../models/Vote');
const VoteEvent = require('../models/VoteEvent');

const DAY = 24 * 60 * 60 * 1000;
const DM_TTL_MS = 30 * DAY; // private chat: 30-day server retention
const VOTE_TTL_MS = 30 * DAY; // votes for ended contests: 30-day retention

function enabled() {
  return String(process.env.RETENTION_ENABLED || '').toLowerCase() === 'true';
}

// Delete private-chat messages older than the DM window. Server is relay-only;
// the durable history lives on-device (Phase 10).
async function sweepDirectMessages() {
  const cutoff = new Date(Date.now() - DM_TTL_MS);
  try {
    const r = await Message.deleteMany({ createdAt: { $lt: cutoff } });
    if (r.deletedCount) console.log(`[retention] purged ${r.deletedCount} DM messages older than 30d`);
  } catch (e) {
    console.warn('[retention] DM sweep failed:', e?.message ?? e);
  }
}

// Delete votes belonging to contests that ENDED more than the window ago. Keyed
// on ended events (not a blanket createdAt TTL) so a long-running active contest
// never loses live votes.
async function sweepVotes() {
  const cutoff = new Date(Date.now() - VOTE_TTL_MS);
  try {
    const endedIds = await VoteEvent.find({ endAt: { $lt: cutoff } }).distinct('_id');
    if (!endedIds.length) return;
    const r = await Vote.deleteMany({ eventId: { $in: endedIds } });
    if (r.deletedCount) console.log(`[retention] purged ${r.deletedCount} votes from contests ended >30d ago`);
  } catch (e) {
    console.warn('[retention] vote sweep failed:', e?.message ?? e);
  }
}

async function dailySweep() {
  if (!enabled()) return;
  await sweepDirectMessages();
  await sweepVotes();
}

/** Start the daily retention cron. No-op (logs once) unless RETENTION_ENABLED. */
function startRetentionJobs() {
  if (!enabled()) {
    console.log('[retention] disabled (set RETENTION_ENABLED=true to activate 30-day cleanup)');
    return;
  }
  console.log('[retention] enabled — 30-day DM + ended-contest vote cleanup running daily');
  // First pass shortly after boot, then every 24h.
  setTimeout(dailySweep, 30 * 1000).unref?.();
  setInterval(dailySweep, DAY).unref?.();
}

module.exports = { startRetentionJobs, dailySweep };
