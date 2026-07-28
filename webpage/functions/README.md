# meyou.uk Cloudflare Pages Functions

These functions are uploaded to the `meyou` Cloudflare Pages project (direct
upload — the site source itself lives outside this repo). They are kept here so
the share-link routing is version-controlled alongside the app + backend.

## `r/[roomId].js` — room share landing

Serves `meyou.uk/r/{slug}`. Proxies the canonical landing HTML from the API
(`/r/:roomId`), which renders a page that:

- attempts the `meyou://room/{roomId}` deep link (opens the app + room),
- offers an "Open in Meyou" button, and
- falls back to the app store for visitors without the app.

The `{slug}` is the friendly form of a room id (`world-chitchat` for
`country:world:chitchat`); the backend decodes it. Old colon links
(`/r/country:world:chitchat`) still resolve.

## `api/waitlist.js` — beta waitlist email collection

Backs the landing-page signup form (`index.html` `#waitlist`, "搶先預約 /
Notify me"). The form already POSTs `{ email, source }` JSON to its
`data-endpoint` attribute — set that attribute to `/api/waitlist` to turn it on:

```html
<form class="waitlist" id="waitlist" data-endpoint="/api/waitlist" novalidate>
```

(That one-attribute edit lives in the site source outside this repo; everything
server-side is here.)

Stores each signup in a KV namespace bound as `WAITLIST`, one key per address
(`email:<lower>`), so it dedupes automatically. Owner reads the list back:

- `GET /api/waitlist?key=<WAITLIST_ADMIN_KEY>` → JSON of all signups
- `GET /api/waitlist?key=<WAITLIST_ADMIN_KEY>&format=csv` → CSV download
- `GET /api/waitlist?count=1` → `{ count }` only (public, no emails — for an
  optional "N people on the list" badge)

**One-time setup in the `meyou` Pages project:**

1. Create the KV namespace: `wrangler kv:namespace create meyou_waitlist`
2. Pages → Settings → Functions → **KV namespace bindings**: add
   variable `WAITLIST` → that namespace.
3. Pages → Settings → **Environment variables**: set `WAITLIST_ADMIN_KEY` to a
   long random string (this is the export password — keep it private).

Without the KV binding the endpoint still returns `{ ok: true, stored: false }`
so visitors see the thank-you state; it logs a warning instead of dropping
silently. Includes a `website` honeypot field check for bots.

## `.well-known/apple-app-site-association.js` & `.well-known/assetlinks.json.js`

iOS Universal Links + Android App Links manifests. With these served **and** the
app rebuilt with `associatedDomains` / autoVerify intentFilters (see
`app-rn/app.json`), tapping `https://meyou.uk/r/...` opens the room directly in
the app instead of bouncing through the landing page.

**These need two real values filled in before they verify** (placeholders ship
as `TEAMID` / `REPLACE_WITH_SHA256`):

- **AASA** — `TEAMID`: Apple Developer Team ID. `cd app-rn && eas credentials`
  (iOS) or App Store Connect → Membership. appID = `<TeamID>.com.meetupnearby.app`.
- **assetlinks** — `REPLACE_WITH_SHA256`: SHA-256 of the **app-signing** cert.
  `cd app-rn && eas credentials` (Android) or Play Console → App signing.

Verify after deploy + the next native build:
`https://meyou.uk/.well-known/apple-app-site-association` returns the JSON with
`Content-Type: application/json`; Apple's CDN may cache it — use
`https://app-site-association.cdn-apple.com/a/v1/meyou.uk` to check what iOS sees.
Android: `https://developers.google.com/digital-asset-links/tools/generator`.

### Deploy

Upload this `functions/` directory with the rest of the `meyou` Pages project.
Optional env var in Pages settings:

- `MEYOU_API_ORIGIN` — API origin to proxy from (default
  `https://gaymeet-api.onrender.com`).

The backend store fallbacks are also env-configurable (set on the API service):
`ANDROID_PLAY_URL`, `IOS_APP_STORE_URL`, `IOS_APP_STORE_ID` (default
`6762375260`, the App Store id — also enables the native iOS smart app banner).
