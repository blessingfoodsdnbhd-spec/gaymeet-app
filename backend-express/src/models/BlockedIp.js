const mongoose = require('mongoose');

/**
 * An IP address that is blocked from the API. Checked by the ipBlocklist
 * middleware on every request (with a short in-process cache). Managed by
 * admins via /api/admin/ban-ip, /ban-user-ip, DELETE /ban-ip/:ip.
 */
const blockedIpSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: 'admin-manual' },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BlockedIp || mongoose.model('BlockedIp', blockedIpSchema);
