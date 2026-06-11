import { api } from './client';
import type { InterestTagId } from '../data/interestTags';

/**
 * User shape returned by the backend's User.toPublicJSON().
 * The display name on the wire is `nickname` (not `name`) — see User.js.
 */
export interface User {
  id: string;
  email: string;
  nickname: string;
  bio?: string;
  avatarUrl?: string | null;
  /** ~5s voice intro (audio URL). Auto-plays in Nearby when the viewer opts in. */
  voiceIntroUrl?: string | null;
  photos?: string[];
  age?: number | null;
  /** Date of birth (ISO). Source of truth for age + zodiac when set; `age` is
   *  denormalized server-side. Legacy users have `age` but no `dob`. */
  dob?: string | null;
  /** Computed server-side from `dob`. Absent for legacy (age-only) users. */
  zodiacSign?: {
    key: string;
    en: string;
    zh: string;
    emoji: string;
    range: string;
  } | null;
  height?: number | null; // cm
  weight?: number | null; // kg
  bodyType?: string | null; // 'average' | 'fit' | 'chubby' | 'slim'
  /** 'single' | 'in_relationship' | 'married' */
  relationshipStatus?: string | null;
  /** One of the 16 MBTI codes. */
  mbti?: string | null;
  /** Multi-select: 'friends' | 'chat' | 'date' | 'serious' | 'activity' | 'language' */
  intents?: string[];
  city?: string | null;
  countryCode?: string | null;

  // Meyou v2 fields
  interests: InterestTagId[];
  interestsOnboardedAt: string | null;
  prompts: { q: string; a: string }[];
  /** Specific mobile games the user plays (only when 'mobile-games' interest is on). */
  mobileGames?: string[];
  /** Premium incognito browsing — self-only; views aren't logged when on. */
  incognitoBrowsing?: boolean;
  /** Whether the public web profile (meyou.uk/u/:id) shows details. Default true. */
  isPublicProfile?: boolean;

  // Optional / legacy fields read by some screens
  /** Likes ("想认识") received — drives the popularity badge on cards. */
  popularity?: number;
  /** Follow relationship from the requester's POV (set on cards + GET /users/:id). */
  followStatus?: 'mutual' | 'following' | 'followed-by' | 'none';
  /** True when this user already liked ("想认识") the viewer — tapping like
   *  would create a match, so the button shows "成为同频". */
  likedByThem?: boolean;
  isOnline?: boolean;
  /** ISO timestamp of last activity. null when a Premium user hides presence. */
  lastActiveAt?: string | null;
  isVerified?: boolean;
  /** Stronger video-pose verification (Premium). Implies isVerified. */
  isVideoVerified?: boolean;
  isOfficial?: boolean;
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  /** Plaza chat level (Lv1–20) + lifetime XP — drives room-color unlocks + level
   *  badges (Phase 4). */
  level?: number;
  currentExp?: number;
  /** Daily-login streak (STREAK1). */
  streak?: { current: number; longest: number; lastActiveDate: string | null };
  isBoosted?: boolean;
  boostExpiresAt?: string | null;
  /** Count of the user's locked photos. Backend strips the actual URLs
   *  from any public profile object — use getPrivatePhotos(userId) with
   *  an active grant to view them. */
  privatePhotosCount?: number;
  distanceLabel?: string | null;
  preferences?: {
    hideDistance?: boolean;
    hideOnlineStatus?: boolean;
    hidePopularity?: boolean;
    ghostMode?: boolean;
    hideFromNearby?: boolean;
    stealthMode?: boolean;
    /** Premium virtual location ("location spoofing"). Coords drive whether it's
     *  ACTIVE (the indicator keys off these, not the label which may be empty). */
    virtualLat?: number | null;
    virtualLng?: number | null;
    virtualLocationLabel?: string | null;
  };
}

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export const getMe = () => unwrap<User>(api.get('/users/me'));

export const patchMe = (
  patch: Partial<Pick<User, 'nickname' | 'bio' | 'bodyType' | 'city' | 'countryCode'>> & {
    tags?: string[];
    age?: number;
    /** ISO 'YYYY-MM-DD'; null clears DOB (and the denormalized age). */
    dob?: string | null;
    height?: number;
    weight?: number;
    /** Enum fields — pass null to clear (NOT '' — that fails the server enum). */
    relationshipStatus?: string | null;
    mbti?: string | null;
    intents?: string[];
    /** Game titles (server trims/dedupes, ≤30 chars each, ≤10 total). */
    mobileGames?: string[];
    incognitoBrowsing?: boolean;
    isPublicProfile?: boolean;
    /** App UI language synced to the backend for push localization. */
    preferredLanguage?: 'en' | 'zh';
  },
) => unwrap<User>(api.patch('/users/me', patch));

/**
 * Best-effort: tell the backend the user's current UI language so server-sent
 * push notifications (e.g. "X is following you") arrive localized. Safe to call
 * unauthenticated — it no-ops when there's no session (avoids a pre-login 401).
 */
export async function syncPreferredLanguage(lang: string) {
  const code = (lang || '').slice(0, 2).toLowerCase();
  if (code !== 'en' && code !== 'zh') return;
  try {
    const { getAccessToken } = await import('../store/auth');
    if (!(await getAccessToken())) return;
    await patchMe({ preferredLanguage: code });
  } catch {
    // best-effort — language sync must never disrupt the app
  }
}

/** Setting interests is what flips `interestsOnboardedAt` from null → now. */
export const setInterests = (interests: InterestTagId[]) =>
  unwrap<User>(api.patch('/me/interests', { interests }));

export const setPrompts = (prompts: { q: string; a: string }[]) =>
  unwrap<User>(api.patch('/me/prompts', { prompts }));

export const setPrivacy = (patch: {
  nearbyVisible?: boolean;
  showDistance?: boolean;
  /** Premium-only; backend returns 402 if a non-Premium user sets this true. */
  hideOnlineStatus?: boolean;
  /** Premium-only (SSSS); backend returns 402 if a non-Premium user sets true. */
  hidePopularity?: boolean;
  /** Premium-only ghost mode; backend returns 402 if a non-Premium user sets true. */
  ghostMode?: boolean;
}) => unwrap<User>(api.patch('/me/privacy', patch));

export const updateLocation = (latitude: number, longitude: number) =>
  unwrap<{ success: true }>(api.put('/users/me/location', { latitude, longitude }));

/** Premium virtual location ("location spoofing"). Backend 403s non-Premium
 *  with code PREMIUM_REQUIRED. label is shown in the Nearby indicator. */
export const setVirtualLocation = (latitude: number, longitude: number, label: string) =>
  unwrap<{ success: true }>(api.post('/users/me/teleport', { latitude, longitude, label }));

export const clearVirtualLocation = () =>
  unwrap<{ success: true }>(api.delete('/users/me/teleport'));

export interface MyStats {
  matches: number;
  following: number;
  moments: number;
  /** Inbound likes count — added with the "Who Liked You" feature.
   *  Optional so the client doesn't crash if hitting an older backend
   *  before the field rolls out. */
  likes?: number;
}
export const getMyStats = () => unwrap<MyStats>(api.get('/me/stats'));

/** Per-user analytics ("我的数据"). Windowed fields + percentile are null for
 *  non-Premium users (premium=false) — the client shows an upsell for those. */
export interface MyAnalytics {
  premium: boolean;
  profileViews: { uniqueViewers: number; last7d: number | null; last30d: number | null };
  likesReceived: { total: number; last7d: number | null; last30d: number | null };
  popularity: { score: number; percentileRank: number | null };
  streak: { current: number; longest: number };
}
export const getMyAnalytics = () => unwrap<MyAnalytics>(api.get('/me/analytics'));

/** Gift 7 days of Premium to a followed user (item 8 / GIFT1). Quotas: 5/month
 *  if Premium, 1/month if free (429 `MONTHLY_QUOTA_EXCEEDED`); each recipient
 *  may be gifted at most once ever (409 `RECIPIENT_ALREADY_GIFTED`). */
export const giftPremium = (recipientId: string) =>
  unwrap<{ success: true; days: number; recipientPremiumExpiresAt: string }>(
    api.post('/premium/gift', { recipientId }),
  );

/** Remaining premium-gift quota for the current calendar month. `total` is 5
 *  for effective-Premium users, 1 for free. Drives the quota header. */
export interface GiftQuota {
  used: number;
  total: number;
  remaining: number;
  isPremium: boolean;
}
export const getGiftQuota = () => unwrap<GiftQuota>(api.get('/premium/gift/quota'));

/** A user as returned by /api/users/:id/following — slim profile shape
 *  with the relationship flags needed to render a list row. */
export interface FollowedUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isPremium?: boolean;
  /** Server-computed effective Premium (expiry + vip aware). Prefer this over
   *  the raw `isPremium` field for gating UI. */
  isPremiumEffective?: boolean;
  /** True if I (the viewer) have already gifted this user Premium (lifetime). */
  alreadyGifted?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  isFollowing?: boolean;
  isSelf?: boolean;
  level?: number;
  dob?: string | null;
  lastActiveAt?: string | null;
  /** Distance in meters; for client-side 距离 sort. */
  distanceM?: number | null;
}
export const getFollowing = (userId: string) =>
  unwrap<FollowedUser[]>(api.get(`/users/${userId}/following`));

export const getFollowers = (userId: string) =>
  unwrap<FollowedUser[]>(api.get(`/users/${userId}/followers`));

/** Public profile for any user by id. Backend returns User.toPublicJSON()
 *  minus the sensitive fields (password/fcmToken/blockedUsers/swipes). */
export const getUserById = (userId: string) =>
  unwrap<User>(api.get(`/users/${userId}`));

/** Permanently delete the current account. Backend wipes matches, messages,
 * moments, and the user document itself. JWT alone is required — no
 * password — because most users sign in via OTP / Apple / Google. */
export const deleteAccount = () =>
  unwrap<{ success: true; message: string }>(api.delete('/account'));

/** GDPR — fetch a full JSON export of everything the account owns
 * (profile, matches, messages, moments, comments, swipes, follows, gifts,
 * payments). Returned raw for the client to write to a file + share. */
export const exportAccountData = () =>
  api.get('/account/export').then((r) => r.data?.data ?? r.data);

/** Inbound likes — users who swiped LIKE/SUPER_LIKE on me. Backend gates
 *  on Premium: non-premium gets blurred placeholder rows (nickname '??',
 *  no avatar) so the count is still visible but identities are not. */
export interface LikerUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  age?: number | null;
  dob?: string | null;
  isOnline?: boolean;
  isBlurred?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  lastActiveAt?: string | null;
  /** Distance in meters (premium only); for client-side 距离 sort. */
  distanceM?: number | null;
}
export interface LikedMeResponse {
  count: number;
  users: LikerUser[];
}
export const getLikedMe = () =>
  unwrap<LikedMeResponse>(api.get('/users/likes'));

/** Upload a ~5s voice intro (audio file:// uri) → returns the stored URL.
 *  Separate from uploadFile() which is image-only (resizes/forces JPEG). */
export const uploadVoiceIntro = (uri: string) => {
  const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
  const fd = new FormData();
  fd.append('file', { uri, name: `voice.${ext}`, type: `audio/${ext === 'm4a' ? 'm4a' : ext}` } as any);
  return unwrap<{ voiceIntroUrl: string }>(
    api.post('/me/voice-intro', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (d) => d,
      timeout: 60_000,
    }) as any,
  );
};

export const deleteVoiceIntro = () =>
  unwrap<{ ok: true }>(api.delete('/me/voice-intro') as any);

/** Log that I opened someone's profile ("谁在看你"). Fire-and-forget from
 *  AboutUserSheet on mount; backend skips self and de-dups per viewer→viewed. */
export const logProfileView = (userId: string) =>
  api.post(`/users/${userId}/view`).catch(() => {});

/** A profile viewer. Premium sees real identity (nickname/avatar/online/dob);
 *  free gets blurred rows (nickname '??', real avatar for the blur teaser). */
export interface ViewerUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  dob?: string | null;
  /** ISO timestamp of the most recent view. */
  viewedAt: string;
  isBlurred?: boolean;
  lastActiveAt?: string | null;
  /** Distance in meters (premium only); for client-side 距离 sort. */
  distanceM?: number | null;
}
export interface ViewersResponse {
  count: number;
  viewers: ViewerUser[];
}
export const getViewers = () =>
  unwrap<ViewersResponse>(api.get('/users/me/viewers'));
