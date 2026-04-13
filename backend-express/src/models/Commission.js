const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    amount: { type: Number, required: true }, // 10% of payment
    currency: { type: String, default: 'MYR' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

commissionSchema.index({ referrer: 1 });
commissionSchema.index({ referred: 1 });
commissionSchema.index({ status: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
