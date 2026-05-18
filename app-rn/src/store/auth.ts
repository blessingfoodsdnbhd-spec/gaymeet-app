import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/me';

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
  },

  signOut: async () => {
    await setTokens(null, null);
    set({ user: null });
  },
}));
