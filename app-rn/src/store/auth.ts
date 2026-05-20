import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/me';
import { disconnect as wsDisconnect } from '../api/ws';

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

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  setUser: (u) => set({ user: u }),

  signIn: async (access, refresh, user) => {
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
    await setTokens(null, null);
    set({ user: null });
  },
}));
