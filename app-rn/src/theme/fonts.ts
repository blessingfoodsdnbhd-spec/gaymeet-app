import * as Font from 'expo-font';

/**
 * Bundled fonts.
 *
 * We ship only the Fraunces italic display weights — Latin-only, ~170KB
 * total. Chinese rendering falls back to the system font (PingFang SC on
 * iOS, Noto Sans CJK SC on Android), which is what every Chinese reader
 * already expects to look "right" on their device, and saves us from
 * bundling 30 MB of CJK glyphs.
 *
 * `fontFamily: 'Fraunces'`         → italic 400 (default Welcome wordmark)
 * `fontFamily: 'Fraunces-Medium'`  → italic 500 (MatchOverlay headline, prompts)
 */
export async function loadFonts() {
  return Font.loadAsync({
    Fraunces: require('../assets/fonts/Fraunces-Italic.ttf'),
    'Fraunces-Medium': require('../assets/fonts/Fraunces-MediumItalic.ttf'),
  });
}
