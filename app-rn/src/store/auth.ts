import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/me';
import { disconnect as wsDisconnect } from '../api/ws';
import { queryClient } from '../api/queryClient';
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
 * three leak vectors: the React Query cache (own profile / stats / moments /
 * discover, all cached under userId-agnostic keys), the chats store (threads +
 * private messages), and the discover store (cards). Tokens, WS, push and the
 * `user` field are handled separately by signOut. Called on BOTH signOut and
 * signIn (defense in depth: signIn still starts clean even if a prior signOut
 * was interrupted, e.g. the app was killed mid-logout or the token was wiped
 * by a failed refresh without a user-initiated signOut).
 */
function clearSessionCaches() {
  queryClient.clear();
  useChats.setState({ threads: [], messages: {}, focusedMatchId: null, typing: {} });
  useDiscover.setState({ cards: [], lastFetchAt: null });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  setUser: (u) => set({ user: u }),

  signIn: async (access, refresh, user) => {
    // Start from a clean slate so no stale cache from a prior session shows.
    clearSessionCaches();
    await setTokens(access, refresh);
    set({ user });
    // Register push token in the background — see utils/push.ts.
    // Imported lazily to avoid a circular dep at module-evaluation time.
    import('../utils/push')
      .then(({ registerPushToken }) => registerPushToken().catch(() => {}))
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
    // signed-in user never sees the previous user's profile, stats, messages
    // or discover cards.
    clearSessionCaches();
    await setTokens(null, null);
    set({ user: null });
  },
}));
