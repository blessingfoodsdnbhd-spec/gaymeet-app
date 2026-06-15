const mongoose = require('mongoose');

/**
 * 世界聊天室 / World Chat — a single public broadcast message. Retention is
 * cron-driven (services/notificationJobs.roomMessageSweep), NOT a fixed TTL:
 *   - custom (user-created) rooms keep messages for ChatRoom.retentionDays
 *     (7 / 30 / ∞), so "我开的房间 / 我在的房间" history persists.
 *   - official/virtual lobby rooms ('world', country codes, channel ids) keep
 *     only the last ~24h (live-focused).
 * The legacy 7-day TTL index is dropped at boot (server.js dropLegacyTTL).
 */
const worldChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 'world' (default/global) or a country code (MY/CN/KR/…). Existing
    // messages default to 'world' for backward compatibility.
    roomId: { type: String, default: 'world' },
    // Text body. Empty for photo messages (validated per-type in the route).
    body: { type: String, default: '', maxlength: 500 },
    // Message kind. Legacy docs without the field are treated as 'text'.
    type: { type: String, enum: ['text', 'photo', 'voice'], default: 'text' },
    // Photo messages: B2 public URL + optional caption.
    photoUrl: { type: String, default: null },
    caption: { type: String, default: null, maxlength: 500 },
    // Voice messages: uploaded audio URL + clip length (ms) + optional waveform
    // peaks for the bubble. Mirrors the private-chat voice flow (PR HH).
    voiceUrl: { type: String, default: null },
    voiceDurationMs: { type: Number, default: null },
    voiceWaveform: { type: [Number], default: undefined },
    // Optional quoted reply → the original message in the same room.
    replyToMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorldChatMessage', default: null },
    // @-mentioned users in this room (resolved from the live roster at send).
    mentions: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: undefined },
    // ── Auto-translate cache ──────────────────────────────────────────────────
    // Source language, detected once on the first translation request.
    detectedLang: { type: String, default: null },
    // Lazy per-target-language cache: { 'en': '…', 'ja': '…' }. An empty string
    // marks "source already equals this target" so we never re-detect/re-call.
    translations: { type: Map, of: String, default: undefined },
    // Set once the author edits the text (PATCH /world-chat/:messageId).
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Per-room reverse-chrono history pagination + retention sweep scan.
worldChatMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('WorldChatMessage', worldChatMessageSchema);
