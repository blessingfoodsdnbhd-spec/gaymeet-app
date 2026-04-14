const mongoose = require('mongoose');
const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  endDate: { type: Date, default: null },
  type: { type: String, enum: ['pride', 'health', 'community', 'party', 'holiday'], default: 'community' },
  location: { type: String, default: '' },
  isRecurring: { type: Boolean, default: false },
  recurringYear: { type: Boolean, default: false }, // same month/day every year
  country: { type: String, default: 'MY' },
  emoji: { type: String, default: '📅' },
}, { timestamps: true });
module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
