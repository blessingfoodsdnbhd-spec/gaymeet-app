/**
 * Expo config plugin — bundle a single custom notification sound into
 * both iOS and Android native projects.
 *
 *   iOS:     notification_sound.caf  → ios/<projectName>/notification_sound.caf
 *            + registered in Xcode project as a bundle resource
 *            (so [UNNotificationSound soundNamed:@"notification_sound.caf"]
 *             resolves at runtime)
 *
 *   Android: notification_sound.wav  → android/app/src/main/res/raw/
 *            (referenced from JS as `sound: "notification_sound"` and
 *             from FCM payload as `android.notification.sound:
 *             "notification_sound"` — Android resource lookup is by base
 *             name, no extension)
 *
 * Source files (committed in-repo):
 *   app-rn/assets/sounds/notification_sound.caf  (iOS-format)
 *   app-rn/assets/sounds/notification_sound.wav  (Android-format)
 *
 * Filename rules (don't change without re-syncing all 4 sites):
 *   - Android res/raw names must be [a-z0-9_]+ — underscores only, no
 *     hyphens, no uppercase. `notification_sound` is compliant.
 *   - iOS .caf bundle name is matched verbatim at runtime by the APNs
 *     `aps.sound` field on the push payload. Backend sends
 *     `'notification_sound.caf'`.
 *
 * Sound is changed via the existing custom plugin (we already have
 * withIapAndroidXFix and withFirebaseMessagingManifestFix). Same
 * pattern: tiny self-contained file, registered last in app.json so
 * it runs after any other plugin that might touch the same resources.
 */
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOUND_CAF = 'notification_sound.caf';
const SOUND_WAV = 'notification_sound.wav';

const ANDROID_RESOURCE_NAME = 'notification_sound'; // no extension, Android-safe

function srcDir() {
  // __dirname is .../app-rn/plugins, sounds live at .../app-rn/assets/sounds
  return path.join(__dirname, '..', 'assets', 'sounds');
}

// ── iOS ──────────────────────────────────────────────────────────────────────
function withSoundIOS(config) {
  // Step 1: copy the .caf file into ios/<projectName>/ so Xcode can bundle it.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName;
      if (!projectName) return cfg;
      const src = path.join(srcDir(), SOUND_CAF);
      if (!fs.existsSync(src)) {
        // Hard fail — without this asset push notifications would be
        // silent on iOS and we'd have no signal during prebuild.
        throw new Error(
          `[withCustomNotificationSound] missing source file: ${src}`,
        );
      }
      const destDir = path.join(cfg.modRequest.platformProjectRoot, projectName);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, SOUND_CAF);
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);

  // Step 2: register the .caf as a bundle resource in the Xcode project.
  // Uses @expo/config-plugins' IOSConfig.XcodeUtils helper.
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const groupName = cfg.modRequest.projectName;
    if (!groupName) return cfg;
    try {
      // pbxprojConfigBuildPhase doesn't track duplicates well — guard.
      const existing = project.pbxResourcesBuildPhaseObj()?.files || [];
      const alreadyAdded = existing.some((f) => f && /notification_sound\.caf/.test(f.comment || ''));
      if (alreadyAdded) return cfg;
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.join(groupName, SOUND_CAF),
        groupName,
        project,
        isBuildFile: true,
      });
    } catch (e) {
      console.warn(
        '[withCustomNotificationSound] iOS Xcode wiring failed:',
        e?.message ?? e,
      );
    }
    return cfg;
  });

  return config;
}

// ── Android ──────────────────────────────────────────────────────────────────
function withSoundAndroid(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = path.join(srcDir(), SOUND_WAV);
      if (!fs.existsSync(src)) {
        throw new Error(
          `[withCustomNotificationSound] missing source file: ${src}`,
        );
      }
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'raw',
      );
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${ANDROID_RESOURCE_NAME}.wav`);
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);
}

module.exports = (config) => withSoundIOS(withSoundAndroid(config));
