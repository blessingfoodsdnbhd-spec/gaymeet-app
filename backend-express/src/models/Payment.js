const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['premium', 'coins', 'boost', 'event'],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'MYR' },
    referralProcessed: { type: Boolean, default: false },

    // ── Store-purchase provenance (IAP) ──────────────────────────────────────
    // Set by the Apple/Google verify + webhook handlers so we have an actual
    // purchase event log. Before this existed, a real purchase only flipped
    // isPremium/premiumExpiresAt on the User and left no dated record, which
    // made "how much did we earn yesterday" unanswerable.
    platform: {
      type: String,
      enum: ['apple', 'google', 'manual', null],
      default: null,
    },
    productId: { type: String, default: null },
    // Apple: originalTransactionId + expiry ms. Google: purchaseToken + expiry ms.
    // Unique (sparse) so replaying a receipt — which happens every time a user
    // taps "Restore Purchases" — cannot create a second Payment row and inflate
    // revenue. One purchase period == one Payment, no matter how often verified.
    externalTxId: { type: String, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1 });
paymentSchema.index({ referralProcessed: 1 });
paymentSchema.index({ type: 1, createdAt: -1 });
paymentSchema.index(
  { externalTxId: 1 },
  { unique: true, partialFilterExpression: { externalTxId: { $type: 'string' } } },
);

module.exports = mongoose.model('Payment', paymentSchema);
