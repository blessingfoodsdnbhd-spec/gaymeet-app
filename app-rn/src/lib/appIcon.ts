import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Alternate app icons (ICON1). DORMANT-NATIVE scaffold — mirrors the Sentry
 * approach (see CLAUDE.md): fully wired on the JS side, but the actual native
 * icon swap is a no-op until `expo-alternate-app-icons` is added to the build.
 *
 * To ACTIVATE (needs a new EAS/prebuild — native config):
 *   1. cd app-rn && npx expo install expo-alternate-app-icons
 *   2. In app.json add the plugin with the 5 assets, e.g.:
 *        ["expo-alternate-app-icons", [
 *          { "name": "pink",   "ios": "./src/assets/icons/icon-pink.png",
 *            "android": { "foregroundImage": "./src/assets/icons/icon-pink.png",
 *                         "backgroundColor": "#FAFAFC" } },
 *          ...(purple/blue/sunset/night)
 *        ]]
 *   3. Rebuild. setAppIcon() below then drives the real swap.
 *
 * Until then the selection still persists and the UI works; the icon just
 * doesn't visually change — zero build risk in the meantime.
 */

export type AppIconId = 'default' | 'pink' | 'purple' | 'blue' | 'sunset' | 'night';

export const APP_ICON_IDS: AppIconId[] = ['default', 'pink', 'purple', 'blue', 'sunset', 'night'];

const STORAGE_KEY = 'meyou:appIcon:selected';

// Static requires so Metro bundles the assets (used by the preview tiles).
export const APP_ICON_ASSETS: Record<Exclude<AppIconId, 'default'>, number> = {
  pink: require('../assets/icons/icon-pink.png'),
  purple: require('../assets/icons/icon-purple.png'),
  blue: require('../assets/icons/icon-blue.png'),
  sunset: require('../assets/icons/icon-sunset.png'),
  night: require('../assets/icons/icon-night.png'),
};

// Optional native module — present only once the plugin is installed + rebuilt.
function nativeModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-alternate-app-icons');
  } catch {
    return null;
  }
}

/** True once the native module is available (post-rebuild). */
export function isAppIconSwapSupported(): boolean {
  const m = nativeModule();
  return !!(m && (m.setAlternateAppIcon || m.setAppIcon));
}

export async function getSelectedAppIcon(): Promise<AppIconId> {
  try {
    const v = (await AsyncStorage.getItem(STORAGE_KEY)) as AppIconId | null;
    if (v && APP_ICON_IDS.includes(v)) return v;
  } catch {}
  return 'default';
}

/**
 * Persist + apply an icon. The native swap is best-effort: if the module isn't
 * present (current builds) we still record the choice so it can be applied once
 * the native side ships. Returns whether the native swap actually ran.
 */
export async function setAppIcon(id: AppIconId): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {}
  const m = nativeModule();
  if (!m) return false;
  try {
    const arg = id === 'default' ? null : id;
    if (typeof m.setAlternateAppIcon === 'function') {
      await m.setAlternateAppIcon(arg);
    } else if (typeof m.setAppIcon === 'function') {
      await m.setAppIcon(arg);
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
