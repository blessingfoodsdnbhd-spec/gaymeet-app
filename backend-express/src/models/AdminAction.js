const mongoose = require('mongoose');

/**
 * Tamper-evident audit trail for admin moderation actions (who did what to whom,
 * when, and why). Written by services/adminAudit.logAdminAction on every
 * destructive or state-changing admin endpoint (ban, capability ban, content
 * deletion, verification decision, report resolution). Append-only — nothing in
 * the app ever updates or deletes these rows.
 */
const adminActionSchema = new mongoose.Schema(
  {
    // The admin who performed the action.
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminEmail: { type: String, default: '' }, // denormalized for readable logs

    // What was done. Free-form-ish but conventionally one of:
    //   ban | unban | chat_ban | chat_unban | photo_ban | photo_unban |
    //   delete_photo | delete_moment | delete_vote_entry |
    //   verify_approve | verify_reject | report_resolve
    action: { type: String, required: true, index: true },

    // The user whose account/content was affected (when applicable).
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // 'user' | 'photo' | 'moment' | 'vote_entry' | 'verification' | 'report'
    targetType: { type: String, default: null },
    // The affected document id or resource identifier (e.g. a photo URL).
    targetId: { type: String, default: null },

    reason: { type: String, default: '' },
    // Free-form context: before/after snapshot, removed URL, report kind, etc.
    meta: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Newest-first audit feed, optionally scoped to one target user.
adminActionSchema.index({ createdAt: -1 });
adminActionSchema.index({ targetUser: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAction', adminActionSchema);
