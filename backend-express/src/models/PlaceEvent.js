const mongoose = require('mongoose');

const placeEventSchema = new mongoose.Schema(
  {
    place: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null },
    coverImage: { type: String, default: null },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'MYR' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

placeEventSchema.index({ place: 1 });
placeEventSchema.index({ date: 1 });

module.exports = mongoose.model('PlaceEvent', placeEventSchema);
