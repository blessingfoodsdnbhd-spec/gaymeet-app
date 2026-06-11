const mongoose = require('mongoose');

/**
 * A themed Plaza channel (兴趣频道). The _id is the room id (`interest:<key>`)
 * so it doubles as the World-Chat roomId — messages live in WorldChatMessage
 * keyed by this string, exactly like country rooms. Seeded from
 * config/interestChannels.js; admins can later flip `pinned` / edit copy.
 */
const interestChannelSchema = new mongoose.Schema(
  {
    _id: { type: String }, // 'interest:games'
    key: { type: String, required: true },
    name: { type: String, required: true },
    i18nKey: { type: String, required: true },
    emoji: { type: String, default: '💬' },
    description: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
);

module.exports = mongoose.model('InterestChannel', interestChannelSchema);
