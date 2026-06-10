const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional now — image and location messages don't carry text.
    // text/sticker callers still pass content; the route layer enforces
    // per-type required-ness.
    content: { type: String, maxlength: 2000 },
    type: {
      type: String,
      enum: ['text', 'sticker', 'image', 'location', 'voice'],
      default: 'text',
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // System messages (e.g. the "you matched" greeting) — rendered centered,
    // no bubble/avatar. Stored content is a fallback; the client localizes.
    isSystem: { type: Boolean, default: false },
    // Image messages: mediaUrl points to the B2 URL produced by
    // /api/upload. mediaType is 'image' for now; 'gif' reserved for
    // when sticker-style animated images get their own pipeline.
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, enum: ['image', 'gif', null], default: null },
    // Voice messages: mediaUrl points to the B2 audio URL; duration is the
    // clip length in milliseconds (rendered in the bubble next to the play
    // button). null for non-voice messages.
    duration: { type: Number, default: null },
    // Location messages. lat/lng required at the route layer; label is
    // an optional reverse-geocode string ("Bukit Bintang, KL" etc).
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      label: { type: String, default: null },
    },
    // Image-message expiry. Set by the send routes to now + 30d for
    // type='image'; null for text / sticker / location (which never
    // expire). The GET /messages handler lazily rotates the mediaUrl
    // to null + flags expired:true once expiresAt passes — real B2
    // cleanup is done by the admin endpoint (after a 7-day grace).
    expiresAt: { type: Date, default: null, index: true },
    // Stamped by the admin cleanup pass once mediaUrl has been
    // nullified and the underlying B2 object has been removed.
    cleanedAt: { type: Date, default: null },
    // Edit metadata. Owners can edit their own text messages within 24h
    // (Premium-gated; see routes/conversations.js PATCH).
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    // Emoji reactions (WhatsApp/iMessage-style). Map of emoji glyph → array of
    // userId strings who reacted with it, e.g. { "❤️": ["u1","u2"], "😂": ["u3"] }.
    // Left undefined (not an empty Map) for messages with no reactions so the
    // doc stays compact. Toggled via POST /:matchId/messages/:msgId/reactions.
    reactions: { type: Map, of: [String], default: undefined },
  },
  { timestamps: true }
);

messageSchema.index({ matchId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

/**
 * Compact preview string used for:
 *   - Match.lastMessage (the chats-list snippet)
 *   - FCM push notification body
 *
 * Image/location collapse to a constant glyph + label so a receiver
 * who only sees the push (without opening the app) understands the
 * message type without leaking content.
 */
/**
 * Normalize a message's `reactions` into a plain wire object
 * { emoji: [userId, …] }. Necessary because `.lean()` returns the field as a
 * Map instance (which JSON.stringify renders as `{}`), and a hydrated doc's
 * field is also a Map. Empty/absent → `{}`. Empty emoji buckets are dropped.
 */
Message.serializeReactions = function serializeReactions(reactions) {
  if (!reactions) return {};
  const entries =
    reactions instanceof Map ? reactions.entries() : Object.entries(reactions);
  const out = {};
  for (const [emoji, ids] of entries) {
    const arr = (ids || []).map((x) => x.toString());
    if (arr.length) out[emoji] = arr;
  }
  return out;
};

Message.previewOf = function previewOf(msg) {
  if (!msg) return '';
  switch (msg.type) {
    case 'image':
      return '📷 Photo';
    case 'location':
      return '📍 Location';
    case 'voice':
      return '🎙️ Voice message';
    case 'text':
    case 'sticker':
    default:
      return (msg.content || '').slice(0, 100);
  }
};

module.exports = Message;
