# meyou.uk Cloudflare Pages Functions

These functions are uploaded to the `meyou` Cloudflare Pages project (direct
upload — the site source itself lives outside this repo). They are kept here so
the share-link routing is version-controlled alongside the app + backend.

## `r/[roomId].js` — room share landing

Serves `meyou.uk/r/{roomId}`. Proxies the canonical landing HTML from the API
(`/r/:roomId`), which renders a page that:

- attempts the `meyou://room/{roomId}` deep link (opens the app + room),
- offers an "Open in Meyou" button, and
- falls back to the app store for visitors without the app.

### Deploy

Upload this `functions/` directory with the rest of the `meyou` Pages project.
Optional env var in Pages settings:

- `MEYOU_API_ORIGIN` — API origin to proxy from (default
  `https://gaymeet-api.onrender.com`).

The backend store fallbacks are also env-configurable (set on the API service):
`ANDROID_PLAY_URL`, `IOS_APP_STORE_URL`, `IOS_APP_STORE_ID` (the last enables
the native iOS smart app banner once the App Store listing id is known).

> Universal Links / App Links (auto-opening `https://meyou.uk/r/...` without the
> landing page) are a future enhancement — they need an
> `apple-app-site-association` file + `assetlinks.json` and a native rebuild with
> `associatedDomains`. The custom-scheme bounce above works today without that.
