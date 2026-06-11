/**
 * Cloudflare Pages Function — meyou.uk/.well-known/assetlinks.json
 *
 * Android App Links (Digital Asset Links) manifest. With the autoVerify
 * intentFilter in app-rn/app.json, Android fetches this file and, if the signing
 * fingerprint matches, opens https://meyou.uk/r/* directly in the app instead of
 * Chrome/the landing page.
 *
 * Served as a Function so we control the Content-Type (application/json) and the
 * SPA catch-all can't swallow it.
 *
 * ⚠️ FILL IN BEFORE THIS WORKS: replace REPLACE_WITH_SHA256 with the SHA-256
 * fingerprint of the app-signing cert. Because the build is signed by EAS /
 * Play App Signing, get the fingerprint from one of:
 *   • `cd app-rn && eas credentials` → Android → see the SHA-256, or
 *   • Play Console → Release → Setup → App signing → "App signing key
 *     certificate" SHA-256 (this is the key Google re-signs with — use it, not
 *     the upload key, for production installs).
 * Add BOTH the upload-key and app-signing-key fingerprints if you also want
 * internal/sideloaded builds to verify. Format: uppercase hex, colon-separated.
 */
const ASSETLINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.meetupnearby.app',
      sha256_cert_fingerprints: ['REPLACE_WITH_SHA256'],
    },
  },
];

export function onRequestGet() {
  return new Response(JSON.stringify(ASSETLINKS), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
