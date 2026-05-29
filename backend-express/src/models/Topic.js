const mongoose = require('mongoose');

/**
 * Topic — a niche-interest tab in the Discover UI (e.g. 白襪 / 眼鏡 / 紋身).
 * Admin-managed; users opt in by creating a TopicPersona for the slug.
 *
 *   slug        – stable, URL-safe identifier (white-socks, glasses, …);
 *                 the client refers to topics by slug, NOT _id
 *   name        – { en, zh } localized display label; client picks per locale
 *   icon        – emoji or short glyph rendered in the tab strip; may be ''
 *   order       – low → high left-to-right after the fixed system tabs
 *                 (推薦 / 附近). New topics default to a high order so
 *                 they show last unless the admin rearranges
 *   isActive    – soft-delete switch; admin DELETE flips this to false
 *
 * The compound index { isActive, order } backs the GET /api/topics scan
 * (active topics, ordered).
 */
const topicSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: {
      en: { type: String, required: true, trim: true },
      zh: { type: String, required: true, trim: true },
    },
    icon: { type: String, default: '' },
    order: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

topicSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('Topic', topicSchema);
