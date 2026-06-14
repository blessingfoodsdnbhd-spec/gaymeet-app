const mongoose = require('mongoose');

/**
 * 世界聊天室 / World Chat — a single public broadcast message. Messages
 * auto-expire 7 days after creation via the TTL index; a separate
 * createdAt:-1 index backs reverse-chronological pagination.
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
    // ── Auto-translate cache ──────────────────────────────────────────────────
    // Source language, detected once on the first translation request.
    detectedLang: { type: String, default: null },
    // Lazy per-target-language cache: { 'en': '…', 'ja': '…' }. An empty string
    // marks "source already equals this target" so we never re-detect/re-call.
    translations: { type: Map, of: String, default: undefined },
    // Set once the author edits the text (PATCH /world-chat/:messageId).
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    // Auto-moderation (anti-spam Phase 1): hidden from everyone but the author
    // and admins once N distinct users report it. See services/autoModeration.js.
    hidden: { type: Boolean, default: false },
    autoHiddenAt: { type: Date, default: null },
    autoHiddenReason: { type: String, default: null },
    moderationStatus: {
      type: String,
      enum: ['none', 'auto_hidden', 'confirmed', 'restored'],
      default: 'none',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Per-room reverse-chrono history pagination.
worldChatMessageSchema.index({ roomId: 1, createdAt: -1 });
// Auto-expire after 7 days.
worldChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('WorldChatMessage', worldChatMessageSchema);
