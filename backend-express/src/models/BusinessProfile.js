const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    businessName: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      enum: ['bar', 'club', 'restaurant', 'sauna', 'hotel', 'gym', 'other'],
      required: true,
    },
    description: { type: String, maxlength: 500, default: '' },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },
    address: { type: String, maxlength: 200, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    openingHours: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    promotedUntil: { type: Date, default: null },
    monthlyBudget: { type: Number, default: 0 },
    // Stats
    totalViews: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    weeklyViews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

businessProfileSchema.index({ location: '2dsphere' });
businessProfileSchema.index({ promotedUntil: 1 });
businessProfileSchema.index({ category: 1, isActive: 1 });

businessProfileSchema.virtual('isPromoted').get(function () {
  return this.promotedUntil != null && this.promotedUntil > new Date();
});

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
