/**
 * Expo config plugin — iOS build fixes for the Expo 53 / RN 0.79 + Nitro (react-native-iap 14)
 * stack. Injected into the generated ios/Podfile's post_install block during prebuild.
 *
 * Two problems this works around:
 *
 * 1. fmt 11.0.2 (pulled by React) marks `basic_format_string` as `consteval` for modern
 *    Apple clang. Xcode 26's clang miscompiles that path ("call to consteval function ...
 *    is not a constant expression"). We patch fmt's base.h so the Apple branch disables
 *    consteval (constexpr fallback) — harmless, only drops compile-time format checking.
 *    (Not needed on the EAS sdk-53 image / Xcode 16, but harmless there.)
 *
 * 2. RCT-Folly ships no generated `folly/folly-config.h`; RN normally relies on the
 *    FOLLY_NO_CONFIG define so `portability/Config.h` skips the include. Under
 *    `use_frameworks!:static` (required by Firebase) the __has_include probe
 *    false-positives against the `folly` framework, so NitroModules/jsi/NitroIap fail with
 *    "'folly/folly-config.h' file not found". Defining FOLLY_NO_CONFIG (+ mobile flags) on
 *    every pod target makes Config.h skip the missing header everywhere.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# --- billing8-ios-build-fixes ---';

const FIX_RUBY = `${MARKER}
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      original = File.read(fmt_base)
      patched = original.gsub('#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L', '#elif defined(__apple_build_version__)')
      File.write(fmt_base, patched) if patched != original
    end
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        defs = bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        defs |= ['FOLLY_NO_CONFIG=1', 'FOLLY_MOBILE=1', 'FOLLY_USE_LIBCPP=1', 'FOLLY_CFG_NO_COROUTINES=1']
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end`;

const withIosBuildFixes = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        // Insert our fixes at the top of the post_install block.
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|\n    ${FIX_RUBY}\n`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);

module.exports = withIosBuildFixes;
