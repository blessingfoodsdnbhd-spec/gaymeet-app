/**
 * Fonts are not yet bundled — drop these files into `src/assets/fonts/` and
 * uncomment the loader below. Until then the app falls back to system fonts
 * (Helvetica on iOS, Roboto on Android), and any `fontFamily: 'Fraunces'`
 * silently renders as system.
 *
 * Required files:
 *  - Fraunces-Italic.ttf         (variable; download from Google Fonts)
 *  - Fraunces-MediumItalic.ttf
 *  - NotoSansSC-Regular.otf
 *  - NotoSansSC-Medium.otf
 *  - NotoSansSC-SemiBold.otf
 *
 * Switch from this stub to the real loader by uncommenting and ensuring
 * the files exist — Metro will throw if a `require()` resolves to nothing.
 */
export async function loadFonts() {
  // Placeholder — see comment above.
  return Promise.resolve();

  // Real implementation (enable once font files are committed):
  //
  // const Font = await import('expo-font');
  // return Font.loadAsync({
  //   Fraunces: require('../assets/fonts/Fraunces-Italic.ttf'),
  //   'Fraunces-Medium': require('../assets/fonts/Fraunces-MediumItalic.ttf'),
  //   NotoSansSC: require('../assets/fonts/NotoSansSC-Regular.otf'),
  //   'NotoSansSC-Medium': require('../assets/fonts/NotoSansSC-Medium.otf'),
  //   'NotoSansSC-SemiBold': require('../assets/fonts/NotoSansSC-SemiBold.otf'),
  // });
}
