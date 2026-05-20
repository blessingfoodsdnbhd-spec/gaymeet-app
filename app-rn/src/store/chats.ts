import { create } from 'zustand';
import type { ChatThread, Message } from '../api/chats';

interface ChatsState {
  threads: ChatThread[];
  /** Keyed by matchId. */
  messages: Record<string, Message[]>;
  focusedMatchId: string | null;
  typing: Record<string, boolean>;

  setThreads: (t: ChatThread[]) => void;
  upsertThread: (t: ChatThread) => void;
  setMessages: (matchId: string, ms: Message[]) => void;
  appendMessage: (matchId: string, m: Message) => void;
  replaceMessage: (matchId: string, pendingId: string, real: Message) => void;
  markRead: (matchId: string) => void;
  setFocus: (matchId: string | null) => void;
  setTyping: (matchId: string, isTyping: boolean) => void;
}

export const useChats = create<ChatsState>((set, get) => ({
  threads: [],
  messages: {},
  focusedMatchId: null,
  typing: {},

  setThreads: (threads) => set({ threads }),

  upsertThread: (t) => {
    const idx = get().threads.findIndex((x) => x.matchId === t.matchId);
    if (idx === -1) {
      set({ threads: [t, ...get().threads] });
    } else {
      const next = [...get().threads];
      next[idx] = t;
      set({ threads: next });
    }
  },

  setMessages: (matchId, ms) =>
    set({ messages: { ...get().messages, [matchId]: ms } }),

  appendMessage: (matchId, m) => {
    const prev = get().messages[matchId] ?? [];
    set({ messages: { ...get().messages, [matchId]: [...prev, m] } });
    // bump unread if not focused
    const focused = get().focusedMatchId;
    const isMine = m.senderId === 'me'; // sentinel; resolved by caller
    if (focused !== matchId && !isMine) {
      const threads = get().threads.map((t) =>
        t.matchId === matchId
          ? { ...t, unreadCount: t.unreadCount + 1, lastMessage: m.content, lastMessageAt: m.createdAt }
          : t,
      );
      set({ threads });
    }
  },

  replaceMessage: (matchId, pendingId, real) => {
    const prev = get().messages[matchId] ?? [];
    set({
      messages: {
        ...get().messages,
        [matchId]: prev.map((m) => (m.pendingId === pendingId ? real : m)),
      },
    });
  },

  markRead: (matchId) => {
    const threads = get().threads.map((t) =>
      t.matchId === matchId ? { ...t, unreadCount: 0 } : t,
    );
    set({ threads });
  },

  setFocus: (matchId) => set({ focusedMatchId: matchId }),

  setTyping: (matchId, isTyping) =>
    set({ typing: { ...get().typing, [matchId]: isTyping } }),
}));
