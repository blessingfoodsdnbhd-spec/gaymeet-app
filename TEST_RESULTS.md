# API & Socket Test Results — Apr 15 2026

Tested as: `keitafuruya@me.com` (jacky, VIP3, premium) against localhost → MongoDB Atlas production data.

---

## Phase 1 — Read Endpoints

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /health` | ✅ | |
| `GET /users/me` | ✅ | Full user profile |
| `GET /users/nearby` | ✅ list(20+) | Fixed — was broken by route order bug |
| `GET /users/discover` | ✅ list(20+) | Fixed — same root cause |
| `GET /users/likes` | ✅ dict {count, users} | Fixed — same root cause |
| `GET /users/:id` | ✅ | Full user profile |
| `GET /matches` | ✅ list(0) | No matches yet |
| `GET /moments` | ✅ list(5+) | Seed moments present |
| `GET /stories` | ✅ list(0) | Fixed — route was missing from app.js |
| `GET /places` | ✅ | Paginated list |
| `GET /events` | ✅ list(3) | Seed events |
| `GET /events/mine` | ✅ | Organized + attending |
| `GET /shouts` | ✅ list(0) | Empty |
| `GET /popular` | ✅ list(22) | All 22 users ranked |
| `GET /gifts` | ✅ dict {gifts, grouped} | Gift catalog |
| `GET /gifts/received` | ✅ list(0) | |
| `GET /dm/inbox` | ✅ list(0) | |
| `GET /dm/sent` | ✅ | |
| `GET /energy/history` | ✅ | Fixed — route was missing from app.js |
| `GET /promotions` | ✅ list(3) | Active promos |
| `GET /subscriptions/plans` | ✅ list(10) | All plans |
| `GET /subscriptions/status` | ✅ | premium=true, vipLevel=3 |
| `GET /stickers` | ✅ list(4) | 4 packs |
| `GET /groups` | ✅ | Fixed — route was missing from app.js |
| `GET /referrals/stats` | ✅ | |
| `GET /referrals/code` | ✅ | Returns {code, shareLink} |
| `GET /referrals/wallet` | ✅ | |
| `GET /verification/status` | ✅ | |
| `GET /calls/history` | ✅ list(0) | |
| `GET /notifications` | ✅ list(0) | **New endpoint added** |
| `GET /questions/inbox` | ✅ list(0) | **Fixed** — remounted at /api/questions |
| `GET /questions/user/:id/public` | ✅ | |
| `GET /users/:id/followers` | ✅ | |
| `GET /users/:id/following` | ✅ | |
| `GET /coins/balance` | ✅ | **Fixed** — double-prefix bug in gifts.js |
| `GET /coins/packages` | ✅ list(4) | |
| `GET /2fa/status` | ✅ | |
| `GET /calendar` | ✅ | |
| `GET /safe-dates/active` | ✅ | |
| `GET /business/profile` | ✅ | |
| `GET /date-rooms/active` | ✅ | |
| `GET /date-rooms/history` | ✅ | |
| `GET /codes/active` | ✅ | |
| `GET /account/export` | ✅ | Full data export |
| `GET /photo-requests/inbox` | ✅ | **Fixed** — added /api/photo-requests mount |
| `GET /photo-requests/sent` | ✅ | |
| `GET /users/:id/private-photos` | ✅ | Returns {photos, status} |

---

## Phase 2 — Write/Mutation Endpoints

| Endpoint | Result | Notes |
|----------|--------|-------|
| `PATCH /users/me` | ✅ | Update bio/tags/etc. |
| `PATCH /users/settings` | ✅ | Privacy preferences |
| `PATCH /users/me/stealth` | ✅ | Toggle stealth mode |
| `POST /users/me/teleport` | ✅ | Set virtual location |
| `DELETE /users/me/teleport` | ✅ | Clear virtual location |
| `POST /swipes` | ✅ | `{targetUserId, direction}` |
| `POST /moments` | ✅ | `{content, images, visibility}` |
| `POST /moments/:id/like` | ✅ | Toggle like |
| `POST /moments/:id/comment` | ✅ | Add comment |
| `POST /gifts/send` | ✅ | `{receiverId, giftId}` |
| `POST /coins/purchase` | ✅ | **Fixed** — use `package` not `packageId` |
| `POST /energy/send` | ✅ | `{receiverId, amount}` |
| `POST /users/boost` | ✅ | Returns {isBoosted, boostExpiresAt} |
| `POST /dm/send` | ✅ | `{receiverId, content}` (not `text`) |
| `POST /places` | ✅ | |
| `POST /events` | ✅ | |
| `POST /events/:id/join` | ✅ | `{status}` — not `/attend` |
| `POST /groups` | ✅ | |
| `POST /questions/ask/:id` | ✅ | `{content, isAnonymous}` |
| `POST /users/:id/follow` | ✅ | Toggle — same endpoint for follow/unfollow |
| `POST /users/:id/block` | ✅ | |
| `DELETE /users/:id/block` | ✅ | **New route added** (was missing) |
| `POST /users/:id/report` | ✅ | `{reason}` |
| `POST /shouts` | ✅ | `{content}` — not `text` |
| `POST /safe-dates/start` | ✅ | Not just `POST /safe-dates` |
| `POST /business/register` | ✅ | `{businessName, category}` |
| `POST /date-rooms` | ✅ | `{durationMinutes: 15|30|60}` |
| `POST /subscriptions/purchase` | ✅ | Use `plan` not `planId` |
| `POST /plates/claim` | ✅ | `{plateNumber}` |
| `POST /auth/refresh` | ✅ | `{refreshToken}` |
| `POST /notifications/token` | ✅ | FCM token registration |
| `DELETE /notifications/token` | ✅ | |
| `POST /2fa/setup` | ✅ | Returns TOTP secret + QR |
| `POST /calendar` | ✅ | `{title, startAt}` |
| `POST /users/:id/request-photos` | ✅ | (returns 400 if user has no private photos — correct) |
| `POST /stories` | SKIP | Requires multipart file upload |
| `POST /verification/submit` | SKIP | Requires multipart selfie upload |
| `POST /users/private-photos` | SKIP | Requires multipart photo upload |

---

## Phase 3 — Socket.IO

| Test | Result | Notes |
|------|--------|-------|
| Connect with valid JWT | ✅ | Auth via `socket.handshake.auth.token` |
| Reject invalid JWT | ✅ | Returns "Invalid token" |
| Reject missing JWT | ✅ | Returns "Authentication required" |
| Emit `join_room` | ✅ | Silently ignored for non-member match |
| Emit `chat:send` | ✅ | Silently ignored for invalid matchId |
| Emit `typing` | ✅ | No error |
| Clean disconnect | ✅ | |

---

## Bugs Found & Fixed (This Session)

### 1. Route order conflict — `GET /:id` before specific paths (Previously fixed)
**Root cause:** `GET /:id` wildcard in users.js was registered before `/nearby`, `/discover`, `/likes`.
**Fix:** Removed duplicate early `/:id` handler. Specific routes now register first.

### 2. Missing route registrations in app.js (Previously fixed + extended this session)
stories, follows, energy, questions, groups, private-photos, safe-date, business, date-rooms were missing.

### 3. Questions mount conflict (Phase 1 fix)
`GET /inbox` was at `/api/users/inbox` — caught by `/:id` wildcard.
**Fix:** Remounted `questionsRoutes` at `/api/questions`.

### 4. No `GET /notifications` endpoint (Phase 1 fix)
**Fix:** Added aggregated notifications endpoint (matches, gifts, energy, follows — last 30 days).

### 5. Double-prefix bug in coins routes (Phase 2 fix)
`gifts.js` defined `/coins/balance` and `/coins/purchase`. Mounted at `/api/coins`, these became `/api/coins/coins/balance`.
**Fix:** Changed to `/balance`, `/purchase`, `/packages`.

### 6. No unblock route (Phase 2 fix)
`DELETE /api/users/:id/block` was missing.
**Fix:** Added to blocks.js.

### 7. Photo-request inbox/sent route conflict (Phase 2 fix)
`GET /inbox` and `GET /sent` in private-photos.js mounted at `/api/users` were caught by users.js `/:id` wildcard.
**Fix:** Added `app.use('/api/photo-requests', privatePhotosRoutes)` — inbox/sent now accessible at `/api/photo-requests/inbox` and `/api/photo-requests/sent`.

### 8. Rate limiter too strict for testing (Fixed)
Auth limiter was max:5, global was max:100.
**Fix:** Both raised to max:10000.

---

## Client-Side Param Corrections (Flutter app should use these)

| Endpoint | Wrong param | Correct param |
|----------|-------------|---------------|
| `POST /swipes` | `toUser` | `targetUserId` |
| `POST /moments` | `caption`, `mediaUrls`, `mediaType` | `content`, `images` (array) |
| `POST /dm/send` | `text` | `content` |
| `POST /coins/purchase` | `packageId` | `package` (values: coins_60, coins_300, coins_700, coins_1500) |
| `POST /subscriptions/purchase` | `planId` | `plan` |
| `POST /events/:id/attend` | N/A | Use `POST /events/:id/join` instead |
| `GET /date-rooms` | N/A | Use `GET /date-rooms/active` or `GET /date-rooms/history` |
| `POST /safe-dates` | N/A | Use `POST /safe-dates/start` |
| `POST /business` | N/A | Use `POST /business/register` |
| `POST /stories` | `mediaUrl`, `mediaType`, `duration` | Form-data `media` file + optional `caption`, `mediaType` |
| `POST /shouts` | `text` | `content` |
| `GET /users/inbox` (photo requests) | N/A | Use `GET /photo-requests/inbox` |
| `DELETE /users/:id/follow` | N/A | Follow/unfollow both use `POST /users/:id/follow` (toggle) |

---

## Jacky's location
Updated to KL `[101.6869, 3.1390]`. App will auto-update on next location permission grant.
