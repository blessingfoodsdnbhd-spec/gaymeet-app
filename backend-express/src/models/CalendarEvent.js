const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['date', 'event', 'reminder', 'birthday'],
      default: 'event',
    },
    color: { type: String, default: '#E91E63' }, // hex
    // Optional: tag another user (e.g. a date partner)
    withUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    location: { type: String, default: null, maxlength: 200 },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

calendarEventSchema.index({ user: 1, startAt: 1 });
calendarEventSchema.index({ user: 1, endAt: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
