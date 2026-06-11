import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Fixed target language, or 'auto' to follow the app UI language. */
export type TranslateTarget = 'auto' | 'zh' | 'en' | 'ko' | 'ja';
export type ResolvedLang = 'zh' | 'en' | 'ko' | 'ja';

const STORAGE_KEY = 'chat.translatePrefs.v1';

interface TranslatePrefsState {
  /** Auto-translate foreign-language messages in world/country rooms. */
  enabled: boolean;
  target: TranslateTarget;
  setEnabled: (v: boolean) => void;
  setTarget: (t: TranslateTarget) => void;
}

const persist = (enabled: boolean, target: TranslateTarget) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, target })).catch(() => {});

export const useTranslatePrefs = create<TranslatePrefsState>((set, get) => ({
  // Default ON — breaks the language barrier out of the box (the whole point).
  // Cost is bounded by the server-side daily quota + per-message cache.
  enabled: true,
  target: 'auto',
  setEnabled: (v) => {
    set({ enabled: v });
    persist(v, get().target);
  },
  setTarget: (t) => {
    set({ target: t });
    persist(get().enabled, t);
  },
}));

/** Collapse the i18n language tag (e.g. 'zh-Hans') to a supported target. */
export function resolveTarget(target: TranslateTarget, uiLang: string): ResolvedLang {
  const base = target === 'auto' ? (uiLang || 'en').slice(0, 2).toLowerCase() : target;
  return (['zh', 'en', 'ko', 'ja'].includes(base) ? base : 'en') as ResolvedLang;
}

// Hydrate once from disk.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      useTranslatePrefs.setState((s) => ({
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : s.enabled,
        target: (saved.target as TranslateTarget) ?? s.target,
      }));
    } catch {
      /* ignore */
    }
  })
  .catch(() => {});
