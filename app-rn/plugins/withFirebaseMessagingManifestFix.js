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
 * @react-native-firebase/messaging library manifest sets channel_id=""
 * and color=@color/white.
 *
 * Without tools:replace, the manifest merger sees two conflicting values
 * for each tag and aborts processReleaseMainManifest.
 *
 * Implementation: withDangerousMod runs AFTER all withAndroidManifest
 * mods, on the serialized AndroidManifest.xml file on disk. A regex
 * patch is robust to plugin ordering (the previous withAndroidManifest
 * approach didn't take — the tools:replace attr didn't reach the final
 * XML, probably because expo-notifications added the tag via a later
 * mod that overwrote ours).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const META_DATA_FIXES = [
  {
    name: 'com.google.firebase.messaging.default_notification_channel_id',
    toolsAttr: 'android:value',
  },
  {
    name: 'com.google.firebase.messaging.default_notification_color',
    toolsAttr: 'android:resource',
  },
];

function patchManifestXml(xml) {
  // 1. Ensure xmlns:tools is declared on <manifest> root. Without it,
  //    tools:replace attributes would be unrecognized.
  if (!/<manifest[^>]*xmlns:tools=/.test(xml)) {
    xml = xml.replace(
      /<manifest\b/,
      '<manifest xmlns:tools="http://schemas.android.com/tools"',
    );
  }

  // 2. For each Firebase meta-data tag, inject tools:replace.
  //    Matches both self-closing (<meta-data ... />) and open
  //    (<meta-data ...>...</meta-data>) forms.
  for (const { name, toolsAttr } of META_DATA_FIXES) {
    const tagPattern = new RegExp(
      `<meta-data([^>]*android:name="${name.replace(/\./g, '\\.')}"[^>]*?)(\\s*/?>)`,
      'g',
    );
    xml = xml.replace(tagPattern, (match, attrs, end) => {
      if (/tools:replace=/.test(attrs)) return match; // already patched
      return `<meta-data${attrs} tools:replace="${toolsAttr}"${end}`;
    });
  }

  return xml;
}

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml',
      );
      if (!fs.existsSync(manifestPath)) {
        // Prebuild didn't generate it yet — nothing to patch. (This is
        // rare; would only happen if expo prebuild was skipped.)
        return cfg;
      }
      const before = fs.readFileSync(manifestPath, 'utf8');
      const after = patchManifestXml(before);
      if (after !== before) {
        fs.writeFileSync(manifestPath, after, 'utf8');
      }
      return cfg;
    },
  ]);

// Export for unit-testability if we ever want to test the regex.
module.exports.patchManifestXml = patchManifestXml;
