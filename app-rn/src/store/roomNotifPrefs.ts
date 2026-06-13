import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-room notification mute prefs for the 广场 / world chat rooms.
 *
 * Default is NOTIFY (a room is muted only if its id is in the set), so a brand
 * new room notifies out of the box. Persisted as a flat array of muted room ids
 * — cheap and forward-compatible. The header bell toggles this; push delivery
 * consults `isMuted()` before surfacing a room message.
 */
const STORAGE_KEY = 'chat.roomNotifMuted.v1';

interface RoomNotifState {
  /** roomId → true when muted. Absence = notifications on. */
  muted: Record<string, true>;
  isMuted: (roomId: string) => boolean;
  setMuted: (roomId: string, muted: boolean) => void;
  /** Flip and return the NEW muted state. */
  toggle: (roomId: string) => boolean;
}

const persist = (muted: Record<string, true>) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(muted))).catch(() => {});

export const useRoomNotifPrefs = create<RoomNotifState>((set, get) => ({
  muted: {},
  isMuted: (roomId) => !!get().muted[roomId],
  setMuted: (roomId, muted) => {
    const next = { ...get().muted };
    if (muted) next[roomId] = true;
    else delete next[roomId];
    set({ muted: next });
    persist(next);
  },
  toggle: (roomId) => {
    const nextMuted = !get().muted[roomId];
    get().setMuted(roomId, nextMuted);
    return nextMuted;
  },
}));

// Hydrate once from disk.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        const muted: Record<string, true> = {};
        ids.forEach((id) => {
          if (typeof id === 'string') muted[id] = true;
        });
        useRoomNotifPrefs.setState({ muted });
      }
    } catch {
      /* ignore */
    }
  })
  .catch(() => {});
