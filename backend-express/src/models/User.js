const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { computeAge, computeZodiac } = require('../utils/zodiac');

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
    // ~5s voice intro (B2 audio URL). Auto-plays in Nearby when the viewer
    // has the "介绍声音" toggle on. Community/social feature.
    voiceIntroUrl: { type: String, default: null },
    photos: [{ type: String }],

    // ── Meyou 密友 (v2) interest matching ─────────────────────────────────
    // The interest tag IDs the user has selected (validated against
    // VALID_TAG_IDS in routes/interests.js). Set during the mandatory
    // InterestTagsPicker onboarding step; required ≥3 to enter app.
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

    // When false, the public web profile (meyou.uk/u/:id) shows a generic
    // "private profile" page instead of the user's details. Default true.
    isPublicProfile: { type: Boolean, default: true },

    // Specific mobile games the user plays — only meaningful when the
    // 'mobile-games' interest tag is selected. Free-form titles (王者荣耀 etc.).
    mobileGames: { type: [String], default: [] },

    // Premium "incognito browsing": when true (and Premium active), viewing
    // another profile does NOT log a ProfileView (谁在看你). Private to self.
    incognitoBrowsing: { type: Boolean, default: false },

    // Body stats
    height: { type: Number, default: null }, // cm
    weight: { type: Number, default: null }, // kg
    age: { type: Number, default: null }, // denormalized from dob on write (kept for legacy users + the nearby age filter)
    dob: { type: Date, default: null }, // date of birth — source of truth for age + zodiac when set
    bodyType: { type: String, default: null }, // 'average' | 'fit' | 'chubby' | 'slim'
    occupation: { type: String, default: null }, // free text
    city: { type: String, default: null }, // free text
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
    // Relationship status (感情状态)
    relationshipStatus: {
      type: String,
      enum: ['single', 'in_relationship', 'married', 'open_relationship', 'polyamorous', null],
      default: null,
    },
    // Purpose / what they're here for (目的) — multi-select.
    // ('date' was intentionally dropped — App Store 4.3(b) caution.)
    intents: {
      type: [{ type: String, enum: ['friends', 'chat', 'serious', 'activity', 'language'] }],
      default: [],
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

// ── User serialization — ALLOWLIST model ────────────────────────────────────
// Security posture: we expose ONLY the fields named below. Anything not on a
// list (now or added to the schema later) is hidden by default — the opposite
// of a blacklist, which silently leaks every new field until someone remembers
// to add it to the delete list. See SENSITIVE_USER_FIELDS for the audit trail
// of what must NEVER ship.

// Fields safe to show to ANY viewer (public profile surface).
const PUBLIC_USER_FIELDS = [
  '_id', 'id', 'nickname', 'bio', 'tags', 'avatarUrl', 'photos', 'voiceIntroUrl',
  'interests', 'interestsOnboardedAt', 'prompts', 'mobileGames',
  'height', 'weight', 'age', 'dob', 'bodyType', 'city', 'countryCode', 'location',
  'lastActiveAt', 'isOnline',
  'isPremium', 'premiumExpiresAt', 'isBoosted', 'boostExpiresAt',
  'isVerified', 'verifiedAt', 'vipLevel', 'vipExpiresAt',
  'level', 'currentExp', 'popularityScore',
  'lookingFor', 'role', 'zodiac', 'mbti', 'bloodType', 'kinks',
  'relationshipStatus', 'intents',
  'followersCount', 'followingCount', 'totalLikesReceived', 'profileViews',
  'createdAt', 'updatedAt',
  // computed below: id, privatePhotosCount, distanceLabel
];

// Fields shown ONLY to the account owner viewing their own record (self=true).
// PII + personal economy/state nobody else should see.
const SELF_ONLY_FIELDS = [
  'email', 'coins', 'currency',
  'ticketBalance', 'ticketRefillDate', 'dailyTicketsReceived', 'dailyTicketsDate',
  'dailyFreeGiftsDate', 'dailyFreeGiftsUsed',
  'dailyEnergySends', 'dailyEnergySendsDate',
  'ownedStickerPacks', 'totalExpReceived', 'referralCode', 'referralCount',
  'isDeleted', 'deletedAt', 'deleteScheduledAt',
];

// Preference keys safe to show to other users (display hints only). The full
// preferences object also holds virtualLat/Lng (teleport) + stealth internals,
// which must never reach another user — so non-self viewers get this subset.
const PUBLIC_PREFERENCE_FIELDS = ['hideDistance', 'hideOnlineStatus'];

// Documentation-only: the fields the allowlist deliberately excludes for
// EVERYONE. Kept so reviewers can see the intent at a glance and so the
// PUBLIC_PROJECTION (for aggregation/lean callers) stays in sync.
const SENSITIVE_USER_FIELDS = [
  'password', 'resetCode', 'resetCodeExpiry', 'otpCode', 'otpExpiry',
  'googleId', 'appleId', 'appleOriginalTransactionId',
  'googleOriginalPurchaseToken', 'deviceFingerprint',
  'devices', // login IPs + refresh tokens
  'blockedUsers', 'fcmToken', 'dailySwipes', 'dailySwipesDate',
  'loginAttempts', 'lockoutUntil', 'referredBy', '__v',
];

// Exclusion projection for queries that bypass toPublicJSON (aggregations
// bypass select:false; .lean() skips the method). Strips every sensitive field
// AND every self-only field (aggregate/lean callers serve lists of OTHER users,
// never the owner's own record). 0 = exclude.
const PUBLIC_USER_PROJECTION = [...SENSITIVE_USER_FIELDS, ...SELF_ONLY_FIELDS].reduce(
  (acc, f) => {
    acc[f] = 0;
    return acc;
  },
  {}
);

/**
 * Serialize a user for API output using a strict allowlist.
 * @param {number} [distanceMeters] optional distance to annotate.
 * @param {{ self?: boolean }} [opts] self=true → the account owner viewing
 *   their own record; adds SELF_ONLY_FIELDS (email, coins, economy state, full
 *   preferences). Defaults to true so own-profile callsites need no change;
 *   any endpoint returning ANOTHER user must pass { self: false }.
 */
userSchema.methods.toPublicJSON = function (distanceMeters, opts = {}) {
  const { self = true } = opts;
  const src = this.toObject({ virtuals: false });

  // Build the output from the allowlist only — nothing leaks by omission.
  const obj = {};
  for (const f of PUBLIC_USER_FIELDS) {
    if (src[f] !== undefined) obj[f] = src[f];
  }
  if (self) {
    for (const f of SELF_ONLY_FIELDS) {
      if (src[f] !== undefined) obj[f] = src[f];
    }
  }

  obj.id = src._id.toString(); // Flutter reads 'id', not '_id'

  // Popularity = likes ("想认识") received + followers received. Surfaced as a
  // single number so the client renders a badge without knowing the signal mix.
  obj.popularity = (src.totalLikesReceived || 0) + (src.followersCount || 0);

  // Date of birth is the source of truth for age + zodiac when present. Age is
  // recomputed live so it never goes stale on a birthday; zodiacSign is a rich
  // {key,en,zh,emoji,range} object the client renders directly. Legacy users
  // (stored age, no dob) keep their age and simply get no zodiacSign.
  if (src.dob) {
    const computedAge = computeAge(src.dob);
    if (computedAge != null) obj.age = computedAge;
    obj.zodiacSign = computeZodiac(src.dob);
  }

  // Preferences: full object for self; a safe display subset for others.
  if (src.preferences) {
    if (self) {
      obj.preferences = { ...src.preferences };
    } else {
      obj.preferences = {};
      for (const k of PUBLIC_PREFERENCE_FIELDS) {
        if (src.preferences[k] !== undefined) obj.preferences[k] = src.preferences[k];
      }
    }
  }

  // Private photo URLs are never inlined — only a count so the UI can show the
  // "Request to view" CTA. The URLs come from GET /:id/private-photos, gated by
  // the PhotoRequest table.
  obj.privatePhotosCount = Array.isArray(src.privatePhotos)
    ? src.privatePhotos.length
    : 0;

  // Human-readable distance label.
  if (distanceMeters != null) {
    obj.distanceLabel =
      distanceMeters < 1000
        ? `${Math.round(distanceMeters)} m`
        : `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  // Expire boost.
  if (obj.isBoosted && obj.boostExpiresAt && new Date() > obj.boostExpiresAt) {
    obj.isBoosted = false;
  }

  // Compute isPremium from vipLevel (new tier) OR legacy isPremium field.
  const vipActive =
    obj.vipLevel > 0 &&
    (!obj.vipExpiresAt || new Date() < new Date(obj.vipExpiresAt));
  if (vipActive) {
    obj.isPremium = true;
  } else if (obj.isPremium && obj.premiumExpiresAt && new Date() > obj.premiumExpiresAt) {
    obj.isPremium = false;
  }

  // Hide online presence from OTHER viewers when a Premium user opted in.
  // (Self always sees their own real status.) Free users can't hide, so the
  // toggle has no effect if their Premium lapses.
  if (!self && src.preferences?.hideOnlineStatus && obj.isPremium) {
    obj.lastActiveAt = null;
    obj.isOnline = false;
  }

  // Expire timed stealth (only meaningful in the self preferences object).
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
// Exclusion projection for aggregation/lean callers (which bypass
// toPublicJSON). Use as a $project stage or .select(). Strips all sensitive +
// self-only fields. Allowlist serialization still lives in toPublicJSON.
UserModel.PUBLIC_PROJECTION = PUBLIC_USER_PROJECTION;
UserModel.PUBLIC_FIELDS = PUBLIC_USER_FIELDS;
UserModel.SELF_ONLY_FIELDS = SELF_ONLY_FIELDS;
UserModel.SENSITIVE_FIELDS = SENSITIVE_USER_FIELDS;
module.exports = UserModel;
