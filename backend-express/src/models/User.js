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
    password: { type: String, select: false },
    resetCode: { type: String, select: false },
    resetCodeExpiry: { type: Date, select: false },
    // Social login
    googleId: { type: String, select: false, sparse: true },
    appleId:  { type: String, select: false, sparse: true },
    // OTP email login
    otpCode:   { type: String, select: false },
    otpExpiry: { type: Date,   select: false },
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

    // Popularity leaderboard
    popularityScore: { type: Number, default: 0 },  // incremented when others vote
    ticketBalance: { type: Number, default: 5 },     // votes the user can cast today
    ticketRefillDate: { type: String, default: null }, // YYYY-MM-DD of last refill

    // Daily free gift tracking (premium users)
    dailyFreeGiftsDate: { type: String, default: null },
    dailyFreeGiftsUsed: { type: Number, default: 0 },

    // Sticker packs owned
    ownedStickerPacks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack' }],

    // Verification (real-person check)
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    // VIP tier system (0=free, 1=VIP1 RM19, 2=VIP2 RM39, 3=VIP3 RM69)
    vipLevel: { type: Number, default: 0, min: 0, max: 3 },
    vipExpiresAt: { type: Date, default: null },

    // Energy / Level system
    level: { type: Number, default: 1 },
    currentExp: { type: Number, default: 0 },
    totalExpReceived: { type: Number, default: 0 },

    // Private photos (locked, require request to view)
    privatePhotos: [{ type: String }],

    // Daily energy sends (for free-user rate limiting)
    dailyEnergySends: { type: Number, default: 0 },
    dailyEnergySendsDate: { type: String, default: null },

    // Looking For status
    lookingFor: {
      type: String,
      enum: ['chat', 'date', 'friends', 'gym', 'makan', 'travel', 'relationship', null],
      default: null,
    },

    // Sexual role preference
    role: {
      type: String,
      enum: ['top', 'bottom', 'versatile', null],
      default: null,
    },

    // Blocked / reported users
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Follow system
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    // Social stats
    totalLikesReceived: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },

    // Referral system
    referralCode: { type: String, unique: true, sparse: true, uppercase: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
    deviceFingerprint: { type: String, default: null },

    // Device/session management
    devices: [{
      deviceId: { type: String },
      deviceName: { type: String, default: 'Unknown Device' },
      lastUsed: { type: Date, default: Date.now },
      ip: { type: String, default: null },
      refreshToken: { type: String, default: null },
    }],
    // Multi-currency
    currency: { type: String, enum: ['MYR', 'SGD', 'THB', 'USD'], default: 'MYR' },
    // Account status
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deleteScheduledAt: { type: Date, default: null },
    // Brute-force protection
    loginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ isBoosted: 1, lastActiveAt: -1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ appleId: 1 }, { sparse: true });

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual('distanceLabel').get(function () {
  return undefined; // Computed per-query via $geoNear
});

// ── Hooks ─────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
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
  obj.id = obj._id.toString(); // Flutter reads 'id', not '_id'
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

  // Compute isPremium from vipLevel (new tier system) OR legacy isPremium field
  const vipActive =
    (obj.vipLevel > 0) &&
    (!obj.vipExpiresAt || new Date() < new Date(obj.vipExpiresAt));
  if (vipActive) {
    obj.isPremium = true;
  } else if (obj.isPremium && obj.premiumExpiresAt && new Date() > obj.premiumExpiresAt) {
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
