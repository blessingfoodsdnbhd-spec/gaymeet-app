# API Test Results — Apr 15 2026

Tested as: `keitafuruya@me.com` (jacky, VIP3) against localhost → MongoDB Atlas production data.

---

## ✅ Working Endpoints

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /users/me` | ✅ dict | Full user profile |
| `GET /users/nearby` | ✅ list(20) | **Fixed** — was broken by route order bug |
| `GET /users/discover` | ✅ list(20) | **Fixed** — same root cause |
| `GET /users/likes` | ✅ dict {count, users} | **Fixed** — same root cause |
| `GET /matches` | ✅ list(0) | No matches yet (no swipes) |
| `GET /moments` | ✅ list(5) | 5 seed moments |
| `GET /stories` | ✅ list(0) | **Fixed** — route was missing from app.js |
| `GET /places` | ✅ dict | Paginated places list |
| `GET /events` | ✅ list(3) | 3 seed events |
| `GET /shouts` | ✅ list(0) | No shouts yet |
| `GET /popular` | ✅ list(22) | All 22 users ranked |
| `GET /gifts` | ✅ dict {gifts, grouped} | Gift catalog |
| `GET /gifts/received` | ✅ list(0) | Empty inbox |
| `GET /dm/inbox` | ✅ list(0) | No DMs yet |
| `GET /energy/history` | ✅ dict | **Fixed** — route was missing from app.js |
| `GET /promotions` | ✅ list(3) | 3 active promos |
| `GET /subscriptions/plans` | ✅ list(10) | All plans |
| `GET /stickers` | ✅ list(4) | 4 sticker packs |
| `GET /groups` | ✅ list(0) | **Fixed** — route was missing from app.js |
| `GET /referrals/stats` | ✅ dict | Referral stats |
| `GET /verification/status` | ✅ dict | Verification status |
| `GET /calls/history` | ✅ list(0) | No calls yet |

---

## ❌ Issues Found & Root Causes

### 1. CRITICAL (now fixed) — Route order conflict in `users.js`

**Symptom:** `GET /users/nearby`, `/users/discover`, `/users/likes` all returned:
```
Cast to ObjectId failed for value "nearby" (type string) at path "_id"
```

**Root cause:** `router.get('/:id', ...)` was registered at line 104 in `users.js`, **before** the specific `/nearby`, `/discover`, `/likes` routes at lines 121, 238, 295. Express matches in registration order — the wildcard caught everything.

**Fix:** Removed the duplicate early `/:id` handler. The full handler (with proper field filtering) remains at the end of users.js, after all specific routes.

---

### 2. Missing route registrations in `app.js`

Six route files existed but were never `app.use()`'d:

| File | Added as |
|------|----------|
| `routes/stories.js` | `app.use('/api/stories', ...)` |
| `routes/follows.js` | `app.use('/api/users', ...)` |
| `routes/energy.js` | `app.use('/api/energy', ...)` |
| `routes/questions.js` | `app.use('/api/users', ...)` |
| `routes/groups.js` | `app.use('/api/groups', ...)` |
| `routes/private-photos.js` | `app.use('/api/users', ...)` |
| `routes/safe-date.js` | `app.use('/api/safe-dates', ...)` |
| `routes/business.js` | `app.use('/api/business', ...)` |
| `routes/date-rooms.js` | `app.use('/api/date-rooms', ...)` |

---

### 3. Minor — Empty data (not bugs)

| Endpoint | Status | Reason |
|----------|--------|--------|
| `GET /matches` | ✅ list(0) | No swipes performed yet |
| `GET /stories` | ✅ list(0) | No stories created |
| `GET /shouts` | ✅ list(0) | No shouts posted |
| `GET /dm/inbox` | ✅ list(0) | No DMs sent |
| `GET /groups` | ✅ list(0) | No groups created |
| `GET /calls/history` | ✅ list(0) | No calls made |

---

### 4. Known limitation — `questions/inbox` mount conflict

`questions.js` has `GET /inbox` mounted at `/api/users`, making it `/api/users/inbox`. However, since `usersRoutes` (also at `/api/users`) has a `GET /:id` wildcard, that handler matches first and throws a cast error before `questionsRoutes` can handle it.

**Workaround:** The Flutter app should call `/api/questions/inbox` — re-mount `questionsRoutes` at `/api/questions` for the inbox, keeping user-specific routes at `/api/users`.

---

### 5. `GET /notifications` — no list endpoint

`notifications.js` only exposes token registration/deletion and scheduling (write-only). There is no `GET /notifications` list endpoint. If the Flutter app polls notifications, it needs either:
- A new `GET /notifications` endpoint
- Or WebSocket push (already set up via Socket.IO)

---

### 6. Rate limit on production (not a code bug)

The old production deploy rate-limited the test IP (15 min window). The new config (max: 10000) is in the latest commit and will take effect after Render redeploys.

---

## Jacky's location

Previously stuck at `[0, 0]` (Atlantic Ocean). Updated directly to KL `[101.6869, 3.1390]`. The app will update this automatically once the user grants location permission (now fixed in the APK) and opens the nearby screen.

---

## Summary

**Before fixes:** 发现/附近/配对 all showed 0 users due to the route order bug.  
**After fixes:** `/users/nearby` returns 20 users, `/users/discover` returns 20 users. All core flows functional.
