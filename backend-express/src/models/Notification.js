const mongoose = require('mongoose');

/**
 * A persisted notification record — written BEFORE the FCM push fires so it
 * always shows in the in-app Notification Center even if push delivery fails.
 * Auto-expires after 30 days. The `data` payload mirrors the FCM data map and
 * is what the client's pushRouter uses to deep-link on tap.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    data: { type: Object, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Inbox list + unread count.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Scheduled-job dedupe ledger lookups (userId + type + recency).
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
// Auto-expire after 30 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
