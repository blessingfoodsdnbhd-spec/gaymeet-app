// Plaza role colors (Phase 3). A single coloured dot next to a user's name in
// chat / sidebar / profile, computed from existing User fields — NO new model.
//
// Precedence (highest first): Admin → VIP/Premium → Veteran → New → Normal.
// Kept here so the same logic backs User.toPublicJSON(), the World Chat message
// payloads, and the Plaza leaderboards (one source of truth).

const ROLE_COLORS = {
  admin: '#A855F7', // 🟣 official / staff account
  vip: '#FBBF24', // 🟡 active Premium / VIP
  veteran: '#3B82F6', // 🔵 level ≥ 10
  new: '#22C55E', // 🟢 account < 7 days old
  normal: '#9CA3AF', // ⚪ default
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const VETERAN_LEVEL = 10;

/** Is the user an actively-paying Premium / VIP right now? Mirrors the
 *  vipLevel-or-legacy-isPremium logic in User.toPublicJSON / utils/premium. */
function isPremiumActive(u) {
  if (!u) return false;
  const now = Date.now();
  const vipActive =
    (u.vipLevel || 0) > 0 &&
    (!u.vipExpiresAt || now < new Date(u.vipExpiresAt).getTime());
  if (vipActive) return true;
  return (
    !!u.isPremium &&
    (!u.premiumExpiresAt || now < new Date(u.premiumExpiresAt).getTime())
  );
}

/**
 * Compute a user's Plaza role tag from a plain User doc (lean or hydrated).
 * @returns {'admin'|'vip'|'veteran'|'new'|'normal'}
 */
function computeRoleTag(u) {
  if (!u) return 'normal';
  if (u.isOfficial) return 'admin';
  if (isPremiumActive(u)) return 'vip';
  if ((u.level || 1) >= VETERAN_LEVEL) return 'veteran';
  if (u.createdAt && Date.now() - new Date(u.createdAt).getTime() < SEVEN_DAYS_MS) {
    return 'new';
  }
  return 'normal';
}

/** Hex colour for a role tag (falls back to normal). */
function roleColor(tag) {
  return ROLE_COLORS[tag] || ROLE_COLORS.normal;
}

// Fields a lean query must .select() for computeRoleTag to work.
const ROLE_TAG_FIELDS =
  'isOfficial isPremium premiumExpiresAt vipLevel vipExpiresAt level createdAt';

module.exports = { ROLE_COLORS, computeRoleTag, roleColor, isPremiumActive, ROLE_TAG_FIELDS };
