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

    // ── Meyou 密友 (v2) interest matching ─────────────────────────────────
    // The 16 fixed interest tag IDs the user has selected. Set during the
    // mandatory InterestTagsPicker onboarding step; required ≥3 to enter app.
    interests: { type: [String], default: [] },
    // When the user first completed (or last re-confirmed) the interests
    // picker. Null → client routes to InterestTagsPicker on next launch.
    interestsOnboardedAt: { type: Date, default: null },
    // Free-form profile prompts ("本周想找人一起" → "去 APW 喝咖啡。")
    prompts: {
      type: [
        {
          q: { type: String, required: true },
          a: { type: String, required: true },
          _id: false,
        },
      ],
      default: [],
    },

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
    // Apple IAP — used by /api/subscriptions/apple-webhook to find the user
    // a renewal/expiry event belongs to. Set by verify-apple-receipt.
    appleOriginalTransactionId: { type: String, default: null, sparse: true },
    // Google Play — purchaseToken used by /api/subscriptions/google-webhook
    // to find the user a renewal/expiry event belongs to. Set by
    // verify-google-purchase; updated on the upgrade/downgrade token chain.
    googleOriginalPurchaseToken: { type: String, default: null, sparse: true },

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
    dailyTicketsReceived: { type: Number, default: 0 },  // tickets received today (reset daily)
    dailyTicketsDate: { type: String, default: null },    // YYYY-MM-DD of dailyTicketsReceived

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

    // Personality / profile fields
    zodiac: {
      type: String,
      enum: ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces', null],
      default: null,
    },
    mbti: {
      type: String,
      enum: ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP', null],
      default: null,
    },
    bloodType: {
      type: String,
      enum: ['A', 'B', 'AB', 'O', null],
      default: null,
    },
    kinks: { type: [String], default: [] },

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
userSchema.index({ googleOriginalPurchaseToken: 1 }, { sparse: true });

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

// Fields that must NEVER appear in any API response, for any user. Shared by
// toPublicJSON and the aggregation/lean projections (see PUBLIC_USER_PROJECTION).
// `email` is handled separately — owners may see their own.
const SENSITIVE_USER_FIELDS = [
  'password',
  'resetCode',
  'resetCodeExpiry',
  'otpCode',
  'otpExpiry',
  'googleId',
  'appleId',
  'appleOriginalTransactionId',
  'googleOriginalPurchaseToken',
  'deviceFingerprint',
  'devices', // contains login IPs + refresh tokens
  'blockedUsers',
  'fcmToken',
  'dailySwipes',
  'dailySwipesDate',
  'loginAttempts',
  'lockoutUntil',
  '__v',
];

// Exclusion projection ($project / .select) for queries that bypass this
// method (aggregations bypass select:false; .lean() skips toPublicJSON).
// Includes `email` because aggregate/lean callers never serve the owner's
// own record specially. 0 = exclude.
const PUBLIC_USER_PROJECTION = SENSITIVE_USER_FIELDS.reduce(
  (acc, f) => {
    acc[f] = 0;
    return acc;
  },
  { email: 0 }
);

/**
 * Serialize a user for API output.
 * @param {number} [distanceMeters] optional distance to annotate.
 * @param {{ self?: boolean }} [opts] when self=true (the account owner viewing
 *   their own profile) the `email` field is retained; otherwise it is stripped.
 */
userSchema.methods.toPublicJSON = function (distanceMeters, opts = {}) {
  // Default self=true (keep email) so the many own-profile callsites are
  // unaffected. Other-user endpoints pass { self: false } to strip email.
  const { self = true } = opts;
  const obj = this.toObject({ virtuals: false });
  obj.id = obj._id.toString(); // Flutter reads 'id', not '_id'
  // Strip every secret / internal field. Several are select:false and thus
  // usually absent, but we delete defensively in case the doc was loaded with
  // +field selection.
  for (const f of SENSITIVE_USER_FIELDS) delete obj[f];
  // Email is PII — only the account owner may see their own.
  if (!self) delete obj.email;
  // Never leak private photo URLs in the public profile object. Viewers
  // get the eventual approved URLs only via the dedicated
  // GET /:id/private-photos endpoint, which checks the PhotoRequest table.
  // Expose only the count so the UI can decide whether to show the
  // "Request to view" CTA.
  const privatePhotosCount = Array.isArray(obj.privatePhotos)
    ? obj.privatePhotos.length
    : 0;
  delete obj.privatePhotos;
  obj.privatePhotosCount = privatePhotosCount;

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

const UserModel = mongoose.model('User', userSchema);
// Reusable exclusion projection for queries that bypass toPublicJSON
// (aggregations + .lean()). Use as: .select(User.PUBLIC_PROJECTION) or as a
// $project stage. Strips all sensitive fields incl. email.
UserModel.PUBLIC_PROJECTION = PUBLIC_USER_PROJECTION;
UserModel.SENSITIVE_FIELDS = SENSITIVE_USER_FIELDS;
module.exports = UserModel;
