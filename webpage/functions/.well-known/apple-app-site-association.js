/**
 * Cloudflare Pages Function — meyou.uk/.well-known/apple-app-site-association
 *
 * iOS Universal Links manifest. When the app declares
 * `associatedDomains: ["applinks:meyou.uk"]` (see app-rn/app.json) and is
 * installed, iOS fetches this file and routes matching https URLs straight into
 * the app instead of Safari/the landing page. Tapping a shared
 * https://meyou.uk/r/<slug> then opens the room directly.
 *
 * Served as a Function (not a static file) so we control the Content-Type and so
 * the SPA catch-all can't swallow it. No file extension on the path, no signing
 * required (iOS 9.3+).
 *
 * ⚠️ FILL IN BEFORE THIS WORKS: replace TEAMID with the Apple Developer Team ID
 * for com.meetupnearby.app. Get it from `cd app-rn && eas credentials`
 * (iOS → see the team) or appstoreconnect.apple.com → Membership. The appID is
 * `<TeamID>.<bundleId>`, e.g. ABCDE12345.com.meetupnearby.app.
 */
const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'TEAMID.com.meetupnearby.app',
        // Room share links, the meyou://room bounce path, and invite links.
        paths: ['/r/*', '/room/*', '/invite/*'],
      },
    ],
  },
};

export function onRequestGet() {
  return new Response(JSON.stringify(AASA), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
