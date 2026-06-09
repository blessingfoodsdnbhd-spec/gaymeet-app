import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/me';
import { disconnect as wsDisconnect } from '../api/ws';
import { queryClient } from '../api/queryClient';
import { clearCachedIsAdmin } from '../api/admin';
import { useChats } from './chats';
import { useDiscover } from './discover';

const ACCESS_KEY = 'meyou.access';
const REFRESH_KEY = 'meyou.refresh';

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}
export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens(access: string | null, refresh: string | null) {
  if (access == null) await SecureStore.deleteItemAsync(ACCESS_KEY);
  else await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh == null) await SecureStore.deleteItemAsync(REFRESH_KEY);
  else await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

interface AuthState {
  user: User | null;
  hydrated: boolean;
  setUser: (u: User | null) => void;
  signIn: (access: string, refresh: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Wipe every piece of the previous session's user data held in memory, so it
 * can never bleed into the next signed-in user on the same app run. Covers all
 * four leak vectors: the React Query cache (own profile / stats / moments /
 * discover, all cached under userId-agnostic keys), the chats store (threads +
 * private messages), the discover store (cards), and the on-disk isAdmin flag
 * (api/admin.ts — not user-scoped, survives force-quit). Tokens, WS, push and
 * the `user` field are handled separately by signOut. Called on BOTH signOut and
 * signIn (defense in depth: signIn still starts clean even if a prior signOut
 * was interrupted, e.g. the app was killed mid-logout or the token was wiped
 * by a failed refresh without a user-initiated signOut).
 */
async function clearSessionCaches() {
  // In-memory vectors — cleared synchronously.
  queryClient.clear();
  useChats.setState({ threads: [], messages: {}, focusedMatchId: null, typing: {} });
  useDiscover.setState({ cards: [], lastFetchAt: null });
  // On-disk, user-scoped flag — must be removed too, or it re-seeds the admin
  // UI gate for the next user (survives force-quit). Awaited so it's gone
  // before the next user's screens mount.
  await clearCachedIsAdmin();
}

/**
 * Clean logout triggered by an expired/invalid session (a 401 the refresh
 * couldn't recover). Unlike signOut() this makes NO network calls — calling an
 * API here would 401 again and recurse. Wipes caches + tokens + user so
 * RootNavigator routes back to Welcome. Guarded so parallel 401s only run it
 * once.
 */
let _expiring = false;
export async function expireSession() {
  if (_expiring) return;
  _expiring = true;
  try {
    wsDisconnect();
    await clearSessionCaches();
    await setTokens(null, null);
    useAuth.setState({ user: null });
  } finally {
    setTimeout(() => {
      _expiring = false;
    }, 2000);
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  setUser: (u) => set({ user: u }),

  signIn: async (access, refresh, user) => {
    // Start from a clean slate so no stale cache from a prior session shows.
    await clearSessionCaches();
    await setTokens(access, refresh);
    set({ user });
    // Push registration is NO LONGER triggered here (PUSH1): firing it at
    // sign-in shows the OS permission prompt before a new user has even
    // finished onboarding. MainTabs now drives it — silently refreshing the
    // token when permission is already granted, or showing a priming explainer
    // (once) after the user reaches the app proper. See navigation/MainTabs.tsx.
    // Sync the current UI language to the backend so push notifications are
    // localized (best-effort; lazy import to avoid a module-load cycle).
    import('../api/me')
      .then(({ syncPreferredLanguage }) =>
        syncPreferredLanguage(require('../i18n').default.language),
      )
      .catch(() => {});
  },

  signOut: async () => {
    // Best-effort wipe of the server-side push token + WS disconnect, then
    // clear local credentials.
    await import('../utils/push')
      .then(({ clearPushToken }) => clearPushToken())
      .catch(() => {});
    wsDisconnect();
    // Drop all cached user data BEFORE clearing the user/tokens so the next
    // signed-in user never sees the previous user's profile, stats, messages,
    // discover cards or admin flag.
    await clearSessionCaches();
    await setTokens(null, null);
    set({ user: null });
  },
}));
