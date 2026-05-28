const mongoose = require('mongoose');

/**
 * Per-user persistent gallery of B2 URLs the user has uploaded for later
 * re-use in chat / moments / etc. Capacity-gated (Free 30, Premium 100)
 * — see routes/photo-library.js for the limit + enforcement.
 *
 *   user        – owner; required, indexed for list queries
 *   url         – B2 URL produced by /api/upload
 *   uploadedAt  – when the row landed
 *   lastUsedAt  – touched whenever the photo is actually sent / used,
 *                 so the list sorts most-recently-used first (LRU UI)
 *
 * Two compound indexes back the two common reads:
 *   { user, lastUsedAt: -1 } — the LRU list
 *   { user, uploadedAt: -1 } — historic ordering, used by clients that
 *                              want "newest upload first" instead
 */
const photoLibrarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

photoLibrarySchema.index({ user: 1, lastUsedAt: -1 });
photoLibrarySchema.index({ user: 1, uploadedAt: -1 });

module.exports = mongoose.model('PhotoLibrary', photoLibrarySchema);
