// Metro config (item 12 — perf). Extends Expo's default preset to enable
// `inlineRequires`, which defers each module's evaluation until first use
// instead of running every module at startup. This measurably improves cold-
// start TTI on a large bundle (195+ modules) with no behavioural change for
// well-behaved modules. If a module relies on import-time side effects and
// misbehaves, import it eagerly at the entrypoint rather than disabling this.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
