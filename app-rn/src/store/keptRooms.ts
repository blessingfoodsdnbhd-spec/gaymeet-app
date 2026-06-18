import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Rooms the user has explicitly chosen to 保留 ("keep") when backing out of a
 * 广场 / world-chat room.
 *
 * Entering a custom room auto-subscribes you server-side (enterRoom), so server
 * membership / `isMember` can't tell "I deliberately kept this" from "I just
 * peeked in once". This local, persisted set records the explicit keep decision
 * so we DON'T re-prompt 保留/离开 every time the user re-enters a room they
 * already decided to keep (v3.1.4 bug fix). 离开 clears the id again.
 */
const STORAGE_KEY = 'chat.keptRooms.v1';

interface KeptRoomsState {
  /** roomId → true when the user chose 保留. Absence = ask on next exit. */
  kept: Record<string, true>;
  isKept: (roomId: string) => boolean;
  setKept: (roomId: string, kept: boolean) => void;
}

const persist = (kept: Record<string, true>) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(kept))).catch(() => {});

export const useKeptRooms = create<KeptRoomsState>((set, get) => ({
  kept: {},
  isKept: (roomId) => !!get().kept[roomId],
  setKept: (roomId, kept) => {
    const next = { ...get().kept };
    if (kept) next[roomId] = true;
    else delete next[roomId];
    set({ kept: next });
    persist(next);
  },
}));

// Hydrate once from disk.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        const kept: Record<string, true> = {};
        ids.forEach((id) => {
          if (typeof id === 'string') kept[id] = true;
        });
        useKeptRooms.setState({ kept });
      }
    } catch {
      /* ignore */
    }
  })
  .catch(() => {});
