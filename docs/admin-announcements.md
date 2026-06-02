# Admin Announcements — First-Page Ad with 3-2-1 Close

The app can show a full-screen **announcement modal** the first time a logged-in
user lands on the main app each session. It's the "first-page ad" with the
**3 → 2 → 1 countdown close** button.

- **Image** is full-bleed inside the modal.
- **Top-right "關閉 (N)"** button counts down `3 → 2 → 1 → 0`; only tappable at 0.
- **Tapping the image** (if `ctaUrl` is set) opens that URL in the browser.
- Backdrop tap also closes — but only after the countdown finishes.

You manage announcements entirely over HTTP — no admin UI needed.

## Auth

All `/api/admin/*` endpoints require the `X-Admin-Token` header to match the
`ADMIN_TOKEN` env var set on Render.

- If `ADMIN_TOKEN` is **not** set on the server → endpoints return `503`.
- If the header is missing/wrong → `403`.

> Keep the token secret. Don't commit it. The examples below use a
> `$ADMIN_TOKEN` shell variable so you never paste it into files.

```bash
export ADMIN_TOKEN='paste-the-render-ADMIN_TOKEN-here'
export API='https://gaymeet-api.onrender.com'
```

## 1. Post an announcement (the common case)

`imageUrl` is the only required field. Use a hosted image URL (HTTPS).

```bash
curl -X POST "$API/api/admin/announcements" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://your-cdn.example.com/promo-banner.jpg"
  }'
```

With a tap-through link (image tap opens this URL) and an active window:

```bash
curl -X POST "$API/api/admin/announcements" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://your-cdn.example.com/promo-banner.jpg",
    "ctaUrl":   "https://meyou.uk/promo",
    "title":    "Launch promo",
    "startsAt": "2026-06-02T00:00:00Z",
    "endsAt":   "2026-06-09T00:00:00Z"
  }'
```

Fields:

| Field      | Required | Meaning |
|------------|----------|---------|
| `imageUrl` | ✅ | Full-bleed image shown in the modal (HTTPS). |
| `ctaUrl`   | — | Tapping the image opens this URL. Omit/`null` = image not tappable. |
| `title`    | — | Stored for future richer layouts; not currently rendered. |
| `startsAt` | — | ISO timestamp. `null`/omitted = active immediately. |
| `endsAt`   | — | ISO timestamp. `null`/omitted = active indefinitely. |

The client shows the **most recent active** announcement whose
`[startsAt, endsAt]` window contains "now". Posting a new one supersedes older
ones automatically (newest-active wins).

## 2. List all announcements

Newest first, includes soft-deleted (inactive) rows so you can resurrect them.

```bash
curl "$API/api/admin/announcements" -H "X-Admin-Token: $ADMIN_TOKEN"
```

## 3. Update an announcement

Partial update — send only the keys you want to change. Use the `_id` from the
list response.

```bash
curl -X PATCH "$API/api/admin/announcements/<ID>" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ctaUrl": "https://meyou.uk/new-link" }'
```

Disable without deleting (hide it from users, keep the row):

```bash
curl -X PATCH "$API/api/admin/announcements/<ID>" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'
```

## 4. Delete (soft-delete)

Flips `isActive` to false rather than removing the row (auditable).

```bash
curl -X DELETE "$API/api/admin/announcements/<ID>" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

## 5. Verify what users will see

This is the **public** endpoint the app calls (no admin token). It returns the
single currently-active announcement, or empty.

```bash
curl "$API/api/announcements/current"
```

## Notes

- To **turn off** the ad entirely, set every active row to `isActive:false`
  (step 3) — `/current` then returns nothing and the modal won't show.
- Host the image somewhere reliable (your CDN / object storage). The modal
  loads it directly; a dead URL = blank modal.
- The countdown length (3s) is a client constant
  (`app-rn/src/components/AnnouncementModal.tsx` → `COUNTDOWN_SECS`); changing
  it requires an app rebuild.
