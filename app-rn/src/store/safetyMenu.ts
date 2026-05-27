import { create } from 'zustand';

/** `nav` is structurally typed so we can accept either NavigationProp or the
 *  stricter NativeStackNavigationProp — both expose `navigate(name, params)`. */
type AnyNav = {
  navigate: (name: string, params?: object) => void;
};

export interface SafetyMenuOptions {
  userId: string;
  userName: string;
  nav: AnyNav;
  /** Optional action that runs after a successful block (e.g. close a sheet). */
  onBlocked?: () => void;
  /** Whether to include an Unmatch entry (Chat-detail context). */
  includeUnmatch?: boolean;
  onUnmatch?: () => void;
}

interface SafetyMenuState {
  visible: boolean;
  options: SafetyMenuOptions | null;
  open: (o: SafetyMenuOptions) => void;
  close: () => void;
}

/**
 * Imperative bridge for the Android Safety menu sheet. The sheet itself is
 * mounted globally as <SafetyMenuSheet/> in App.tsx; `showSafetyMenu()` on
 * Android calls `open()` here to surface it. iOS uses native ActionSheetIOS
 * and bypasses this store entirely.
 */
export const useSafetyMenu = create<SafetyMenuState>((set) => ({
  visible: false,
  options: null,
  open: (options) => set({ visible: true, options }),
  close: () => set({ visible: false }),
}));
