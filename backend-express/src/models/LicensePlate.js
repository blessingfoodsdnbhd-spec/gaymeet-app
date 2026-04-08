const mongoose = require('mongoose');

const licensePlateSchema = new mongoose.Schema(
  {
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    carImageUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

licensePlateSchema.index({ plateNumber: 1 });
licensePlateSchema.index({ owner: 1 });

module.exports = mongoose.model('LicensePlate', licensePlateSchema);
