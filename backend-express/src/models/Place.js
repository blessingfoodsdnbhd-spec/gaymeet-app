const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, min: 1, max: 5, required: true },
    review: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

const placeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    category: {
      type: String,
      enum: ['bar', 'club', 'restaurant', 'cafe', 'sauna', 'hotel', 'event_venue', 'park', 'gym', 'other'],
      required: true,
    },
    address: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    city: { type: String, default: '' },
    country: { type: String, default: 'MY' },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    openingHours: { type: String, default: null },
    photos: [{ type: String }],
    tags: [{ type: String }],
    priceRange: { type: String, enum: ['$', '$$', '$$$'], default: '$$' },
    isVerified: { type: Boolean, default: false },
    ratings: [ratingSchema],
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

placeSchema.index({ location: '2dsphere' });
placeSchema.index({ category: 1 });
placeSchema.index({ city: 1 });
placeSchema.index({ isActive: 1 });
placeSchema.index({ averageRating: -1 });
placeSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Place', placeSchema);
