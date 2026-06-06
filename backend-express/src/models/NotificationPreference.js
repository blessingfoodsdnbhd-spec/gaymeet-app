const mongoose = require('mongoose');

/**
 * Per-user notification preferences. We store the OFF set (`disabled`) rather
 * than every toggle, so new notification types default to ON without a
 * migration. High-priority types (match / dm / note / room invite·kick) ignore
 * `disabled` and always deliver. `quietStartHour`/`quietEndHour` are 0–23 hour
 * marks (UTC for v1 — no per-user timezone yet); during the window we still
 * PERSIST the notification but skip the push.
 */
const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    disabled: { type: [String], default: [] },
    quietStartHour: { type: Number, default: null },
    quietEndHour: { type: Number, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
