import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'discover.prefs.introVoice';
const COLS_KEY = 'discover.prefs.gridColumns';

export type GridColumns = 2 | 3 | 4;

interface DiscoverPrefsState {
  /** When true, opening a profile in Nearby auto-plays their voice intro. Default ON. */
  introVoice: boolean;
  setIntroVoice: (v: boolean) => void;
  /** Nearby grid column count (2/3/4). Default 3. */
  gridColumns: GridColumns;
  setGridColumns: (n: GridColumns) => void;
}

export const useDiscoverPrefs = create<DiscoverPrefsState>((set) => ({
  introVoice: true,
  setIntroVoice: (v) => {
    set({ introVoice: v });
    AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  },
  gridColumns: 3,
  setGridColumns: (n) => {
    set({ gridColumns: n });
    AsyncStorage.setItem(COLS_KEY, String(n)).catch(() => {});
  },
}));

// Hydrate once from storage. The default is now ON, so an absent key keeps ON
// for first-time users — but a user who explicitly toggled must keep their
// choice, so honor a stored '0' (opt-out) as well as '1'.
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '0') useDiscoverPrefs.setState({ introVoice: false });
    else if (v === '1') useDiscoverPrefs.setState({ introVoice: true });
  })
  .catch(() => {});

// Restore the saved grid column count (2/3/4).
AsyncStorage.getItem(COLS_KEY)
  .then((v) => {
    const n = parseInt(v ?? '', 10);
    if (n === 2 || n === 3 || n === 4) useDiscoverPrefs.setState({ gridColumns: n });
  })
  .catch(() => {});
