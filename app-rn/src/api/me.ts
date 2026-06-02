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
  photos?: string[];
  age?: number | null;
  height?: number | null; // cm
  weight?: number | null; // kg
  bodyType?: string | null; // 'average' | 'fit' | 'chubby' | 'slim'
  occupation?: string | null;
  city?: string | null;
  countryCode?: string | null;

  // Meyou v2 fields
  interests: InterestTagId[];
  interestsOnboardedAt: string | null;
  prompts: { q: string; a: string }[];

  // Optional / legacy fields read by some screens
  isOnline?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
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
    hideFromNearby?: boolean;
    stealthMode?: boolean;
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
  patch: Partial<Pick<User, 'nickname' | 'bio' | 'bodyType' | 'occupation' | 'city'>> & {
    tags?: string[];
    age?: number;
    height?: number;
    weight?: number;
  },
) => unwrap<User>(api.patch('/users/me', patch));

/** Setting interests is what flips `interestsOnboardedAt` from null → now. */
export const setInterests = (interests: InterestTagId[]) =>
  unwrap<User>(api.patch('/me/interests', { interests }));

export const setPrompts = (prompts: { q: string; a: string }[]) =>
  unwrap<User>(api.patch('/me/prompts', { prompts }));

export const setPrivacy = (patch: { nearbyVisible?: boolean; showDistance?: boolean }) =>
  unwrap<User>(api.patch('/me/privacy', patch));

export const updateLocation = (latitude: number, longitude: number) =>
  unwrap<{ success: true }>(api.put('/users/me/location', { latitude, longitude }));

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

/** A user as returned by /api/users/:id/following — slim profile shape
 *  with the relationship flags needed to render a list row. */
export interface FollowedUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  isFollowing?: boolean;
  isSelf?: boolean;
  level?: number;
}
export const getFollowing = (userId: string) =>
  unwrap<FollowedUser[]>(api.get(`/users/${userId}/following`));

/** Public profile for any user by id. Backend returns User.toPublicJSON()
 *  minus the sensitive fields (password/fcmToken/blockedUsers/swipes). */
export const getUserById = (userId: string) =>
  unwrap<User>(api.get(`/users/${userId}`));

/** Permanently delete the current account. Backend wipes matches, messages,
 * moments, and the user document itself. JWT alone is required — no
 * password — because most users sign in via OTP / Apple / Google. */
export const deleteAccount = () =>
  unwrap<{ success: true; message: string }>(api.delete('/account'));

/** Inbound likes — users who swiped LIKE/SUPER_LIKE on me. Backend gates
 *  on Premium: non-premium gets blurred placeholder rows (nickname '??',
 *  no avatar) so the count is still visible but identities are not. */
export interface LikerUser {
  _id: string;
  nickname: string;
  avatarUrl?: string | null;
  age?: number | null;
  isOnline?: boolean;
  isBlurred?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
}
export interface LikedMeResponse {
  count: number;
  users: LikerUser[];
}
export const getLikedMe = () =>
  unwrap<LikedMeResponse>(api.get('/users/likes'));
