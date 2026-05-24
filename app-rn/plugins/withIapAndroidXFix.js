/**
 * Expo config plugin — flip react-native-iap from legacy support libs to AndroidX.
 *
 * react-native-iap's own Expo plugin (registered as "react-native-iap") sets
 *   supportLibVersion = "28.0.0"
 * in the project-level android/build.gradle. Its android/build.gradle then has:
 *   if (supportLibVersion && androidXVersion == null) {
 *     implementation "com.android.support:support-annotations:$supportLibVersion"
 *     implementation "com.android.support:customtabs:$supportLibVersion"
 *   } else {
 *     implementation "androidx.annotation:annotation:$annotationVersion"
 *     implementation "androidx.browser:browser:$browserVersion"
 *   }
 *
 * Pulling the legacy com.android.support:* causes a manifest-merger conflict
 * with androidx.core (Application@appComponentFactory clash). The cleanest
 * fix is to set androidXVersion to a truthy value so the else-branch wins.
 * This plugin appends `androidXVersion = "1.0.0"` to the project build.gradle's
 * ext block, after react-native-iap's own injection runs.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const ANDROIDX_LINE = 'androidXVersion = "1.0.0"';

const withIapAndroidXFix = (config) => {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(ANDROIDX_LINE)) {
      return cfg;
    }
    // Insert right after the supportLibVersion line that react-native-iap's
    // own plugin adds. If that line isn't present yet (plugin order
    // surprise), fall back to inserting after the first `ext {` block.
    const lines = cfg.modResults.contents.split('\n');
    const supportIdx = lines.findIndex((l) => /supportLibVersion\s*=/.test(l));
    if (supportIdx !== -1) {
      lines.splice(supportIdx + 1, 0, ANDROIDX_LINE);
    } else {
      const extIdx = lines.findIndex((l) => /\bext\s*\{/.test(l));
      if (extIdx === -1) return cfg; // nothing to do
      lines.splice(extIdx + 1, 0, '    ' + ANDROIDX_LINE);
    }
    cfg.modResults.contents = lines.join('\n');
    return cfg;
  });
};

module.exports = withIapAndroidXFix;
