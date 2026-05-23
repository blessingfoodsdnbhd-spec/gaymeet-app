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
  countryCode?: string | null;

  // Meyou v2 fields
  interests: InterestTagId[];
  interestsOnboardedAt: string | null;
  prompts: { q: string; a: string }[];

  // Optional / legacy fields read by some screens
  isOnline?: boolean;
  isVerified?: boolean;
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
  patch: Partial<Pick<User, 'nickname' | 'bio'>> & { tags?: string[]; age?: number },
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

/** Permanently delete the current account. Backend wipes matches, messages,
 * moments, and the user document itself. JWT alone is required — no
 * password — because most users sign in via OTP / Apple / Google. */
export const deleteAccount = () =>
  unwrap<{ success: true; message: string }>(api.delete('/account'));
