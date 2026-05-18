import { create } from 'zustand';
import type { DiscoverCardUser } from '../api/discover';

interface DiscoverState {
  cards: DiscoverCardUser[];
  lastFetchAt: number | null;
  setCards: (cards: DiscoverCardUser[]) => void;
  appendCards: (cards: DiscoverCardUser[]) => void;
  popTop: () => void;
}

export const useDiscover = create<DiscoverState>((set, get) => ({
  cards: [],
  lastFetchAt: null,
  setCards: (cards) => set({ cards, lastFetchAt: Date.now() }),
  appendCards: (more) => {
    const existing = new Set(get().cards.map((c) => c.id));
    set({
      cards: [...get().cards, ...more.filter((c) => !existing.has(c.id))],
      lastFetchAt: Date.now(),
    });
  },
  popTop: () => set({ cards: get().cards.slice(1) }),
}));
