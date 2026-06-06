import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ListSortKey } from '../utils/listSort';

export type ListName = 'matches' | 'likes' | 'following' | 'viewers';

const STORAGE_KEY = 'list.sortPrefs.v1';

interface ListSortState {
  sort: Record<ListName, ListSortKey>;
  setSort: (list: ListName, key: ListSortKey) => void;
}

const DEFAULTS: Record<ListName, ListSortKey> = {
  matches: 'recent',
  likes: 'recent',
  following: 'recent',
  viewers: 'recent',
};

export const useListSortPrefs = create<ListSortState>((set, get) => ({
  sort: { ...DEFAULTS },
  setSort: (list, key) => {
    const next = { ...get().sort, [list]: key };
    set({ sort: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },
}));

// Hydrate once.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      useListSortPrefs.setState((s) => ({ sort: { ...s.sort, ...saved } }));
    } catch {
      /* ignore */
    }
  })
  .catch(() => {});
