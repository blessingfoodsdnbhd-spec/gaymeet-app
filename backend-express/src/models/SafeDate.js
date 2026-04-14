const mongoose = require('mongoose');

const trustedContactSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nickname: { type: String, required: true },
  },
  { _id: false }
);

const safeDateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trustedContacts: [trustedContactSchema],
    isActive:        { type: Boolean, default: true },
    startedAt:       { type: Date, default: Date.now },
    endedAt:         { type: Date, default: null },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    meetingWith:      { type: String, default: '' },
    venue:            { type: String, default: '' },
    expectedEndTime:  { type: Date, default: null },
    panicTriggered:   { type: Boolean, default: false },
    panicAt:          { type: Date, default: null },
    lastCheckinAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

safeDateSchema.index({ location: '2dsphere' });
safeDateSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('SafeDate', safeDateSchema);
