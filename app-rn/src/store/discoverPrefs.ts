import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'discover.prefs.introVoice';

interface DiscoverPrefsState {
  /** When true, opening a profile in Nearby auto-plays their voice intro. Default OFF. */
  introVoice: boolean;
  setIntroVoice: (v: boolean) => void;
}

export const useDiscoverPrefs = create<DiscoverPrefsState>((set) => ({
  introVoice: false,
  setIntroVoice: (v) => {
    set({ introVoice: v });
    AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  },
}));

// Hydrate once from storage (default stays OFF until proven otherwise).
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1') useDiscoverPrefs.setState({ introVoice: true });
  })
  .catch(() => {});
