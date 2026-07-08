const mongoose = require('mongoose');

/**
 * Meyou 密友 — app version gate (force / soft upgrade).
 *
 * A single global config document (there is only ever ONE row — see
 * AppVersionConfig.get()) that the client polls on launch via
 * GET /api/config/version to decide whether to nag or hard-block the user
 * into updating. Admins edit it from webpage/.../admin/version.html
 * (PUT /api/admin/version, X-Admin-Token).
 *
 * Per platform:
 *   minimum      – builds strictly BELOW this are hard-blocked (un-dismissable
 *                  modal, "立即更新" → store). Use for security / breaking-API
 *                  releases. Leave equal to the oldest supported build to never
 *                  hard-block.
 *   recommended  – builds strictly BELOW this get a soft, dismissable nudge.
 *   latest       – the newest build in the store; informational only (shown in
 *                  the modal copy, and echoed to the admin panel).
 *   storeUrl     – deep link the "更新" button opens for that platform.
 *
 * Versions are compared with a plain dotted-numeric semver compare on the
 * client (see app-rn/src/updates/versionCompare.ts) — keep them as
 * "MAJOR.MINOR.PATCH" strings that line up with expo.version in app.json.
 */
const platformGate = {
  minimum: { type: String, default: '0.0.0' },
  recommended: { type: String, default: '0.0.0' },
  latest: { type: String, default: '0.0.0' },
  storeUrl: { type: String, default: '' },
  // Optional override copy for the modal (falls back to i18n on the client).
  message: { type: String, default: '' },
};

const appVersionConfigSchema = new mongoose.Schema(
  {
    // Discriminator so we can guarantee a singleton via a fixed key.
    key: { type: String, default: 'global', unique: true, index: true },
    ios: { type: platformGate, default: () => ({}) },
    android: { type: platformGate, default: () => ({}) },
  },
  { timestamps: true },
);

/** Default store URLs — overridable per-platform in the admin panel. */
const DEFAULT_IOS_STORE =
  'https://apps.apple.com/app/id0000000000'; // TODO: real App Store id once live
const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.meetupnearby.app';

/**
 * Fetch the singleton config, creating it with safe (never-blocking) defaults
 * on first call. minimum/recommended default to 0.0.0 so nobody is ever
 * blocked until an admin deliberately raises the floor.
 */
appVersionConfigSchema.statics.get = async function get() {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) {
    doc = await this.create({
      key: 'global',
      ios: { storeUrl: DEFAULT_IOS_STORE },
      android: { storeUrl: DEFAULT_ANDROID_STORE },
    });
  }
  return doc;
};

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
module.exports.DEFAULT_IOS_STORE = DEFAULT_IOS_STORE;
module.exports.DEFAULT_ANDROID_STORE = DEFAULT_ANDROID_STORE;
