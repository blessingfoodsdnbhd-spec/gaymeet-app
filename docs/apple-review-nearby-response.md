# App Review response — Nearby & location (Guideline 5.1.2(i))

**App:** Meyou 密友 · `com.meetupnearby.app` · ASC app ID `6762375260`
**Applies to:** v3.1.22 build **140** and later
**Prepared:** 2026-07-26

---

## Reply to paste into App Store Connect › Resolution Center

> Meyou does not use a map view. Nearby displays a list of user cards with an
> approximate distance shown as a range only — "under 1 km", "1–5 km", "5–10 km"
> or "over 10 km". The server never returns precise coordinates or a precise
> distance for another user; the range is computed server-side and only the
> range is sent to the device, so no finer value exists in the client or in the
> API response.
>
> The first time a member opens the Nearby tab, an explanatory prompt appears
> before any of their information is shown to others. It states that they will
> appear in other members' Nearby list, that only an approximate range is shown,
> and that they can turn this off at any time. The prompt offers a real choice:
> declining immediately turns their Nearby visibility off.
>
> Members can also opt out at any time in Settings › Privacy › "Show me in
> Nearby". Turning it off removes them from every other member's Nearby list
> immediately. Location data is used only to compute the approximate range; it
> is never shared with third parties.
>
> Block and Report are available on every member profile (the ⋯ menu) and
> directly from the Nearby grid by long-pressing a card. Blocking is mutual and
> immediate: neither member appears to the other in Nearby, search, or messages.

---

## What changed in build 140

Build 136 was rejected under 5.1.2(i). Build 138 answered it with a per-session
"check in" flow: a member was invisible on Nearby until they manually checked in,
and the check-in expired after 15–60 minutes. That satisfied the guideline but
made the feature unusable, and the matching server-side filter emptied Nearby for
the entire existing user base — no shipped client ever wrote the check-in field,
so every account failed the filter. Build 140 replaces it with a design that is
compliant *and* usable.

| Requirement (5.1.2(i)) | How build 140 satisfies it |
| --- | --- |
| Members must consent before their data is shared | One-time disclosure sheet on first opening the Nearby tab, before any sharing. `src/screens/discover/NearbyConsentPrompt.tsx` |
| Members must be able to decline | "Turn off" on that sheet calls `PATCH /api/me/privacy {nearbyVisible:false}` and hides them immediately |
| Consent must be revocable | Settings › Privacy › "Show me in Nearby", always available |
| Location must not be shared beyond what the feature needs | Distance leaves the server only as one of four coarse ranges; no coordinates, no metre values, no map |
| Members must be able to block others | ⋯ menu on every profile + long-press on any Nearby card |

### Precision: what the API actually returns

All user-facing distance is collapsed into four buckets **server-side**, in
`backend-express/src/utils/distanceBucket.js`, before the response is
serialised:

| Bucket key | Range | Label |
| --- | --- | --- |
| `lt1` | < 1 000 m | under 1 km |
| `1to5` | 1 000–4 999 m | 1–5 km |
| `5to10` | 5 000–9 999 m | 5–10 km |
| `gt10` | ≥ 10 000 m | over 10 km |

Every endpoint that previously emitted a finer value was changed:

- `GET /api/discover/nearby`, `/api/discover/cards`, `/api/discover/search` —
  `distance` is now a bucket label, `distanceBucket` carries the key, and the
  raw `distanceMeters` that `$geoNear` attaches is stripped from the response.
  `distKm` is now always `null`.
- `GET /api/users/nearby` — same; `distanceMeters` stripped.
- `GET /api/conversations`, `/api/users/me/viewers`, `/api/users/me/likers`,
  `/api/follows/*` — these lists sort by distance on the device, so they receive
  `distanceM` quantised to a single representative value per bucket
  (500 / 3 000 / 7 500 / 15 000). Ordering is preserved at bucket granularity;
  no finer value is transmitted.
- `GET /api/shouts` — bucket only.

The previous formatter rounded to the nearest 100 m. That is precise enough to
trilaterate a home address from three samples, which is the risk the guideline
addresses; it no longer exists anywhere in the codebase.

### No map view

Meyou has never shipped a map of other members. The Nearby tab is a grid of
profile cards. The unused `NearbyMapView` component was deleted in build 140 so
the claim is true of the source as well as the UI. The only map in the app is
the Premium "virtual location" picker, which sets **the member's own** location
and shows no one else.

### Default state

"Show me in Nearby" defaults to **on**, and the disclosure is shown before the
member is visible to anyone. This matches how the guideline is written — it
requires informed consent and a working opt-out, not that the feature ship
disabled. A member who declines the prompt, or who toggles the setting off
later, is removed from every other member's Nearby list on the next request.

---

## Where to look in the build

| Concern | File |
| --- | --- |
| One-time consent sheet | `app-rn/src/screens/discover/NearbyConsentPrompt.tsx` |
| Settings opt-out | `app-rn/src/screens/profile/settings/PrivacySettings.tsx` |
| Bucket definition (server) | `backend-express/src/utils/distanceBucket.js` |
| Bucket rendering (client) | `app-rn/src/utils/distanceBucket.ts` |
| Nearby visibility filter | `backend-express/src/routes/discover.js`, `routes/users.js` (`nearbyEnabled: { $ne: false }`) |
| Consent persistence | `User.nearbyEnabled` (default `true`), written by `PATCH /api/me/privacy` |
| Block / report | `app-rn/src/utils/safetyMenu.tsx` |

## Demo account

`apple-review@meyou.uk` / `demo1234` — fully onboarded, Premium, with seeded
neighbours so the Nearby grid is populated. The account has not yet answered the
Nearby disclosure, so a reviewer signing in fresh will see the prompt and can
exercise both the accept and the decline path.

---

### Note on precedent

Do **not** argue that other dating apps do the same thing. App Review does not
accept comparisons to competitors, and the obvious comparators here show
*precise* distance — citing them would concede the exact point at issue. The
argument that works is the one above: no map, no coordinates, no precise
distance, consent before exposure, and a working opt-out.
