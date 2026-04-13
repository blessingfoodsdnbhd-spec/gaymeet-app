const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const preferencesSchema = new mongoose.Schema(
  {
    hideDistance: { type: Boolean, default: false },
    hideOnlineStatus: { type: Boolean, default: false },
    hideFromNearby: { type: Boolean, default: false },
    stealthMode: { type: Boolean, default: false },
    stealthOption: {
      type: String,
      enum: ['complete', 'friendsOnly', 'timed'],
      default: 'complete',
    },
    stealthUntil: { type: Date, default: null },
    // Virtual location (teleport)
    virtualLat: { type: Number, default: null },
    virtualLng: { type: Number, default: null },
    virtualLocationLabel: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    nickname: { type: String, required: true, trim: true },
    bio: { type: String, default: '' },
    tags: [{ type: String }],
    avatarUrl: { type: String, default: null },
    photos: [{ type: String }],

    // Body stats
    height: { type: Number, default: null }, // cm
    weight: { type: Number, default: null }, // kg
    age: { type: Number, default: null },
    countryCode: { type: String, default: null }, // 'MY', 'SG', etc.

    // Geolocation — 2dsphere index for $geoNear queries
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    lastActiveAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },

    // Premium
    isPremium: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },

    // Privacy preferences
    preferences: { type: preferencesSchema, default: () => ({}) },

    // Daily swipe tracking
    dailySwipes: { type: Number, default: 0 },
    dailySwipesDate: { type: String, default: null }, // ISO date string YYYY-MM-DD

    // FCM push
    fcmToken: { type: String, default: null },

    // Boost
    isBoosted: { type: Boolean, default: false },
    boostExpiresAt: { type: Date, default: null },

    // Virtual currency
    coins: { type: Number, default: 0 },

    // Daily free gift tracking (premium users)
    dailyFreeGiftsDate: { type: String, default: null },
    dailyFreeGiftsUsed: { type: Number, default: 0 },

    // Sticker packs owned
    ownedStickerPacks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack' }],

    // Verification (real-person check)
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    // Looking For status
    lookingFor: {
      type: String,
      enum: ['chat', 'date', 'friends', 'gym', 'makan', 'travel', 'relationship', null],
      default: null,
    },

    // Blocked / reported users
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Referral system
    referralCode: { type: String, unique: true, sparse: true, uppercase: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
    deviceFingerprint: { type: String, default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ isBoosted: 1, lastActiveAt: -1 });
userSchema.index({ referralCode: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual('distanceLabel').get(function () {
  return undefined; // Computed per-query via $geoNear
});

// ── Hooks ─────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// ── Methods ───────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublicJSON = function (distanceMeters) {
  const obj = this.toObject({ virtuals: false });
  delete obj.password;
  delete obj.blockedUsers;
  delete obj.fcmToken;
  delete obj.dailySwipes;
  delete obj.dailySwipesDate;
  delete obj.__v;

  // Expose distance as a human-readable label
  if (distanceMeters != null) {
    if (distanceMeters < 1000) {
      obj.distanceLabel = `${Math.round(distanceMeters)} m`;
    } else {
      obj.distanceLabel = `${(distanceMeters / 1000).toFixed(1)} km`;
    }
  }

  // Expire boost
  if (obj.isBoosted && obj.boostExpiresAt && new Date() > obj.boostExpiresAt) {
    obj.isBoosted = false;
  }

  // Expire premium
  if (obj.isPremium && obj.premiumExpiresAt && new Date() > obj.premiumExpiresAt) {
    obj.isPremium = false;
  }

  // Expire timed stealth
  if (
    obj.preferences?.stealthUntil &&
    new Date() > new Date(obj.preferences.stealthUntil)
  ) {
    obj.preferences.stealthMode = false;
    obj.preferences.stealthUntil = null;
  }

  return obj;
};

module.exports = mongoose.model('User', userSchema);
