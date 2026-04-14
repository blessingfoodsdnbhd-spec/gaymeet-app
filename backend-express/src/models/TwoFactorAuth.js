const mongoose = require('mongoose');

const twoFactorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  secret: { type: String, required: true },
  isEnabled: { type: Boolean, default: false },
  backupCodes: [{ code: String, used: { type: Boolean, default: false } }],
}, { timestamps: true });

module.exports = mongoose.model('TwoFactorAuth', twoFactorSchema);
