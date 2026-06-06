import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'meyou.onboarded.v1';

interface OnboardingState {
  /** True once the user has seen (completed or skipped) the intro flow. */
  done: boolean;
  /** Becomes true after the AsyncStorage value has loaded. */
  hydrated: boolean;
  /** One-shot: land on the Profile tab right after finishing onboarding. */
  landProfile: boolean;
  complete: () => void;
  clearLandProfile: () => void;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  done: false,
  hydrated: false,
  landProfile: false,
  complete: () => {
    set({ done: true, landProfile: true });
    AsyncStorage.setItem(KEY, '1').catch(() => {});
  },
  clearLandProfile: () => set({ landProfile: false }),
}));

// Hydrate once from storage.
AsyncStorage.getItem(KEY)
  .then((v) => useOnboarding.setState({ done: v === '1', hydrated: true }))
  .catch(() => useOnboarding.setState({ hydrated: true }));
