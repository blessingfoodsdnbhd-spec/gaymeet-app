/**
 * Expo config plugin — resolve AndroidManifest meta-data clash between
 * expo-notifications and @react-native-firebase/messaging.
 *
 * Both plugins want to set:
 *   com.google.firebase.messaging.default_notification_channel_id
 *   com.google.firebase.messaging.default_notification_color
 *
 * expo-notifications (host app manifest) sets them based on our app.json
 * plugin config (`defaultChannel: "default"`, `color: "#E25CAE"`).
 * RNFB messaging library manifest sets channel_id="" and color=@color/white.
 *
 * Without intervention the manifest merger sees two conflicting values for
 * each tag and aborts processReleaseMainManifest. Standard fix: add
 * `tools:replace="android:value"` (or `android:resource`) on the host
 * app's meta-data so the merger picks the host app's values.
 *
 * Implementation: walk the merged manifest, find any meta-data named
 * default_notification_channel_id / default_notification_color, and
 * inject the corresponding tools:replace attribute. Also ensures
 * xmlns:tools is declared on <manifest>.
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

const TARGETS = [
  {
    name: 'com.google.firebase.messaging.default_notification_channel_id',
    replaceAttr: 'android:value',
  },
  {
    name: 'com.google.firebase.messaging.default_notification_color',
    replaceAttr: 'android:resource',
  },
];

const withFirebaseMessagingManifestFix = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure xmlns:tools is on the root <manifest> element so tools:replace
    // is valid. AndroidManifest in Expo prebuild usually already has it,
    // but be defensive.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application['meta-data'] = application['meta-data'] || [];

    for (const target of TARGETS) {
      const tag = application['meta-data'].find(
        (m) => m?.$?.['android:name'] === target.name,
      );
      if (tag) {
        tag.$['tools:replace'] = target.replaceAttr;
      }
      // If the tag isn't on the host-app manifest at all yet (e.g. the
      // expo-notifications plugin runs *after* this one), the merge would
      // still surface RNFB's values. That ordering risk is low — our plugin
      // is declared after expo-notifications in app.json — but if it ever
      // changes we'd need to add the tag here too.
    }

    return cfg;
  });
};

module.exports = withFirebaseMessagingManifestFix;
