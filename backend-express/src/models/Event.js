const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['going', 'interested', 'cancelled'],
      default: 'going',
    },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    coverImage: { type: String, default: null },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number], // [lng, lat]
    },
    venue: { type: String, default: '' },
    address: { type: String, default: '' },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null },
    maxAttendees: { type: Number, default: 50 },
    price: { type: Number, default: 0 }, // 0 = free
    currency: { type: String, default: 'MYR' },
    category: {
      type: String,
      enum: ['makan', 'party', 'sports', 'hangout', 'other'],
      default: 'hangout',
    },
    attendees: [attendeeSchema],
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eventSchema.virtual('currentAttendees').get(function () {
  return this.attendees.filter((a) => a.status === 'going').length;
});

eventSchema.index({ location: '2dsphere' });
eventSchema.index({ date: 1, isActive: 1 });
eventSchema.index({ category: 1, date: 1 });

module.exports = mongoose.model('Event', eventSchema);
