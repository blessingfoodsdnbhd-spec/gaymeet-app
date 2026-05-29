const mongoose = require('mongoose');

/**
 * Admin-managed announcement shown to users as a modal on first arrival
 * into the main app per session (post-login or cold-start while
 * authenticated). The client decides whether to show it; the backend
 * just serves the most recent active row whose [startsAt, endsAt]
 * window contains "now".
 *
 *   imageUrl   – required; full-bleed image rendered inside the modal
 *   ctaUrl     – optional; tap on the image opens this URL via Linking
 *   title      – optional; not currently rendered, kept for future
 *                richer-content variants (header strip etc.)
 *   startsAt   – optional; null = "active immediately"
 *   endsAt     – optional; null = "active indefinitely"
 *   isActive   – soft-delete switch; DELETE endpoint flips this rather
 *                than removing the row, so we can audit what shipped
 *
 * Index on { isActive, createdAt: -1 } supports the /current query —
 * sorted-newest-active scan terminates on the first row inside the
 * date window.
 */
const announcementSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    ctaUrl: { type: String, default: null },
    title: { type: String, default: null },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

announcementSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
