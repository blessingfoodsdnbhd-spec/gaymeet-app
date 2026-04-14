# GayMeet — Comprehensive Feature Test Report
**Generated:** 2026-04-14  
**Backend:** Express + MongoDB (backend-express/)  
**Frontend:** Flutter (app/)  
**Analyzer:** `flutter analyze` · `node -e "require('./src/app')"`

---

## Executive Summary

| Category | Count |
|---|---|
| ✅ PASS (full stack, routed) | 21 |
| ⚠️ WARNING (partial / minor issues) | 12 |
| ❌ FAIL / NOT BUILT | 10 |
| Flutter compile errors | **0** |
| Flutter warnings | 31 |
| Flutter infos (deprecation) | 222 |
| Backend load errors | **0** |
| Backend mongoose warnings | 4 (duplicate index) |

---

## Backend Load Test

```
node -e "require('./src/app')" → APP_LOAD_OK
```

**4 Mongoose duplicate-index warnings** (non-fatal, performance impact):
- `User`: `email` field has both `unique: true` in schema and `userSchema.index({ email: 1 })`
- `LicensePlate`: `plateNumber` — same pattern
- `Referral`: `referralCode` field
- `Swipe`: `user` field

---

## Feature Status Table

### 🔐 Auth & Security

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Login / Register** | ✅ PASS | `routes/auth.js` ✅ registered `/api/auth` | `login_screen.dart`, `register_screen.dart` — routed `/login` `/register` | JWT access+refresh, bcrypt |
| **Token Refresh** | ✅ PASS | `POST /api/auth/refresh` ✅ | `api_client.dart` — auto-retry on 401 ✅ | Interceptor handles rotation |
| **Account Lockout** | ⚠️ WARNING | In worktree PR `claude/flamboyant-burnell` only | N/A | Not merged to main yet; 5-attempt lockout implemented |
| **Rate Limiting** | ⚠️ WARNING | In worktree PR only (`rateLimiter.js`) | N/A | `express-rate-limit` added in PR, not on main |
| **NoSQL Injection Guard** | ⚠️ WARNING | In worktree PR only (`express-mongo-sanitize`) | N/A | Not on main branch yet |
| **Two-Factor Auth (2FA)** | ❌ NOT BUILT | No route | No screen | No TOTP/SMS model, route, or UI |
| **Biometric / PIN lock** | ❌ NOT BUILT | N/A | No screen | No `flutter_local_auth` integration |

---

### 👤 Profile & Onboarding

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Profile Setup (Onboarding)** | ✅ PASS | `routes/users.js` `PATCH /api/users/me` ✅ | `profile_setup_screen.dart` → `/onboarding` | Photo upload, bio, tags |
| **Edit Profile** | ✅ PASS | `PATCH /api/users/me` ✅ | `edit_profile_screen.dart` → `/profile/edit` | Height, weight, age, bio, tags |
| **Profile View** | ✅ PASS | `GET /api/users/:id` ✅ | `profile_screen.dart` → `/profile` | Avatar, photos, looking-for badge |
| **Photo Upload** | ✅ PASS | `routes/photos.js` → `/api/users/photos` ✅ | `photo_service.dart` | Multer, up to 6 photos |
| **Private Photos** | ⚠️ WARNING | Photos uploaded but no per-photo `isPrivate` flag | No lock/unlock UI | `Payment.js` model exists but no private-photo route |
| **Looking For** | ✅ PASS | `lookingFor` field on User ✅ | `looking_for_sheet.dart`, shown on profile | 7 options: chat/date/friends/gym/makan/travel/relationship |
| **Verification (real-person)** | ✅ PASS | `routes/verification.js` → `/api/verification` ✅ | `verification_screen.dart` → `/verification` | Photo selfie upload, manual review flow |

---

### 🔍 Discover & Matching

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Discover / Swipe** | ✅ PASS | `routes/swipes.js` → `/api/swipes` ✅ | `discover_screen.dart` → `/discover` | Card swiper, like/pass |
| **Filters** | ✅ PASS | Age/distance/height/weight filters sent as query params | `filter_provider.dart`, `filter_sheet.dart` | Master toggle + per-type enable |
| **Matches** | ✅ PASS | `routes/matches.js` → `/api/matches` ✅ | `matches_screen.dart` → `/matches` | Lists mutual matches |
| **Match Success Screen** | ✅ PASS | N/A (client-side) | `match_success_screen.dart` → `/match-success` | Animated confetti on mutual |
| **Likes (Who Liked Me)** | ✅ PASS | `GET /api/swipes/likes-me` ✅ (in users.js) | `likes_screen.dart` → `/likes` | Premium gate: blurred until subscribed |
| **Super Like** | ⚠️ WARNING | `POST /api/swipes` accepts `type: 'superlike'` ✅ | `subscription_provider.dart` tracks daily quota | Backend saves but no separate inbox for superlike receiver |
| **Follow System** | ❌ NOT BUILT | No follow/unfollow route | No follow UI | No Follow model |

---

### 💬 Chat & Messaging

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Chat (matched users)** | ✅ PASS | `socket_service.js` real-time + `Message.js` ✅ | `chat_list_screen.dart` `/chats`, `chat_room_screen.dart` `/chat/:id` | Socket.io rooms per match |
| **Direct Messages (cold DM)** | ✅ PASS | `routes/direct-messages.js` → `/api/dm` ✅ | `dm_inbox_screen.dart` → `/dm/inbox`, `send_dm_sheet.dart` | Non-matched user DMs, coin-gated |
| **Typing Indicators** | ⚠️ WARNING | Socket `typing` event emitted | `chat_room_screen.dart` listens | No persistence; only ephemeral socket events |
| **Read Receipts** | ⚠️ WARNING | `Message.js` has no `readAt`/`isRead` field | No read-receipt UI | Messages marked delivered but not read |
| **Message Reactions** | ❌ NOT BUILT | No reaction model/route | No reaction UI | — |

---

### 📞 Calls (VoIP)

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Call History** | ✅ PASS | `routes/calls.js` `GET /api/calls/history` ✅ | `call_history_screen.dart` → `/call/history` | `CallLog.js` model |
| **Outgoing / Active Call UI** | ⚠️ WARNING | No WebRTC signaling route | `active_call_screen.dart` (Navigator.push, no named route) | UI complete; needs Agora/WebRTC backend |
| **Incoming Call** | ⚠️ WARNING | Triggered via FCM push only | `incoming_call_screen.dart` (overlaid via home_screen.dart) | Socket event triggers overlay |
| **Calling Tab (CallingScreen)** | ✅ PASS | Embedded in LocationHub tabs | `calling_screen.dart` (tab, no named route) | VoIP UI placeholder |

---

### 📍 Location & Nearby

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Nearby Grid** | ✅ PASS | `GET /api/users/nearby` in `users.js` ✅ | `nearby_grid_screen.dart` → `/location/nearby` | `$geoNear` MongoDB query |
| **Nearby List** | ✅ PASS | Same endpoint | `nearby_list_screen.dart` (embedded tab, no named route) | Alternate view |
| **Location Hub** | ✅ PASS | N/A | `location_hub_screen.dart` → `/location` | Tabs: grid/list/calling/map |
| **Location Map** | ⚠️ WARNING | N/A | `location_map_screen.dart` (embedded tab, no named route) | Renders map; no real-time user pins |
| **Teleport (virtual location)** | ✅ PASS | `PATCH /api/users/me` with `virtualLat/Lng` ✅ | `teleport_screen.dart` → `/teleport` | Stored in user preferences |
| **Stealth Mode** | ✅ PASS | `preferences.stealthMode` on User ✅ | `stealth_settings_screen.dart` → `/stealth` | complete / friendsOnly / timed |
| **Shout** | ✅ PASS | `routes/shouts.js` → `/api/shouts` ✅ | `shout_screen.dart` → `/location/shout` | Geo-radius broadcast |
| **Popular (trending users)** | ✅ PASS | `routes/popular.js` → `/api/popular` ✅ | `popular_screen.dart` → `/location/popular` | Sorted by isBoosted + activity |
| **Location Settings** | ✅ PASS | `PATCH /api/users/me` ✅ | `location_settings_screen.dart` → `/location/settings` | hideDistance, hideOnlineStatus |

---

### 💎 Premium & Monetisation

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Premium Subscription** | ✅ PASS | `routes/subscriptions.js` → `/api/subscriptions` ✅ | `premium_screen.dart` → `/premium` | Weekly RM9.90 / Monthly RM19.90 / Yearly RM99.90 |
| **Premium Plans Endpoint** | ✅ PASS | `GET /api/subscriptions/plans` ✅ | `subscription_provider.dart` | Added in worktree PR |
| **Boost** | ✅ PASS | `routes/boost.js` → `/api/users/boost` ✅ | `boost_provider.dart` | Premium-only, 30 min, 3× visibility |
| **Coin Shop** | ✅ PASS | `GET /api/coins/packages`, `POST /api/coins/purchase` ✅ | `coin_shop_screen.dart` → `/coins` | 4 MYR tiers with bonus coins |
| **Gift Send** | ✅ PASS | `POST /api/gifts/send` ✅ | `gift_sheet.dart` (bottom sheet) | Coin deduction + 10% receiver reward |
| **Gift Inbox** | ✅ PASS | `GET /api/gifts/received` ✅ | `gift_inbox_screen.dart` → `/gifts/inbox` | Shows all received gifts |
| **Coin Balance** | ✅ PASS | `GET /api/coins/balance` ✅ | `gifts_provider.dart` | Synced from backend |
| **Energy / Levels** | ❌ NOT BUILT | No model or route | No screen | Gamification system not implemented |

---

### 📸 Moments (Social Feed)

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Moments Feed** | ✅ PASS | `routes/moments.js` → `/api/moments` ✅ | `moments_feed_screen.dart` → `/moments` | Reverse-chron feed |
| **Create Moment** | ✅ PASS | `POST /api/moments` ✅ | `create_moment_screen.dart` → `/moments/create` | Photo + text |
| **Moment Detail** | ✅ PASS | `GET /api/moments/:id` ✅ | `moment_detail_screen.dart` → `/moments/:id` | Comments, likes |
| **Stories** | ❌ NOT BUILT | No route | No screen | 24h expiry stories not implemented |

---

### 📅 Events & Calendar

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Events List** | ✅ PASS | `routes/events.js` → `/api/events` ✅ | `events_screen.dart` → `/events` | Category filter chips |
| **Create Event** | ✅ PASS | `POST /api/events` ✅ | `create_event_screen.dart` → `/events/create` | Venue, date, price, max attendees |
| **Event Detail / RSVP** | ✅ PASS | `POST /api/events/:id/attend` ✅ | `event_detail_screen.dart` → `/events/:id` | going/interested/cancelled |
| **Calendar View** | ⚠️ WARNING | N/A (reads from events endpoint) | `calendar_screen.dart` exists — **NOT yet in main routes.dart** | In worktree PR only; pending merge |

---

### 🏳️‍🌈 Places (Gay-Friendly Directory)

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Places List** | ✅ PASS | `routes/places.js` → `/api/places` ✅ | `places_screen.dart` → `/places` | Category filter, geo-sort |
| **Place Detail** | ✅ PASS | `GET /api/places/:id` ✅ | `place_detail_screen.dart` → `/places/:id` | Reviews, events tab |
| **Create Place** | ✅ PASS | `POST /api/places` ✅ | `create_place_screen.dart` → `/places/create` | Requires Premium |
| **Rate Place** | ✅ PASS | `POST /api/places/:id/rate` ✅ | `rate_place_sheet.dart` | 1–5 star rating with comment |

---

### 👀 Saw You (License Plate)

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Saw You Screen** | ✅ PASS | `routes/plates.js` → `/api/plates` ✅ | `saw_you_screen.dart` → `/saw-you` | Send anonymous plate to someone |
| **Plate Inbox** | ✅ PASS | `GET /api/plates/inbox` ✅ | `plate_inbox_screen.dart` → `/saw-you/inbox` | Manage received plates |
| **Claim Plate** | ✅ PASS | `POST /api/plates/claim` ✅ | `claim_plate_screen.dart` → `/saw-you/claim` | Reveal your plate number |

---

### 🤫 Secret Code

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Secret Code** | ✅ PASS | `routes/secret-codes.js` → `/api/codes` ✅ | `secret_code_screen.dart` → `/secret-code` | Send/receive private connection codes |

---

### 🎮 Stickers

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Sticker Store** | ✅ PASS | `routes/stickers.js` → `/api/stickers` ✅ | `sticker_store_screen.dart` → `/stickers` | `StickerPack.js` model |
| **Sticker Picker** | ✅ PASS | N/A | `sticker_picker.dart` (bottom sheet) | Used in chat |

---

### 🔗 Referral & Wallet

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Referral Program** | ✅ PASS | `routes/referrals.js` → `/api/referrals` ✅ | `referral_screen.dart` → `/referral` | Code generation, fraud detection (device fingerprint) |
| **Wallet / Withdrawals** | ✅ PASS | `Wallet.js` + `Withdrawal.js` + `Commission.js` ✅ | `wallet_screen.dart` → `/wallet` | Commission tracking, withdrawal requests |
| **Referral Input (Register)** | ✅ PASS | `referralCode` param on register ✅ | `referral_input_widget.dart` (used in register) | Applied during signup |

---

### 📢 Promotions / Ads

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Promotions Banner** | ✅ PASS | `routes/promotions.js` → `/api/promotions` ✅ | `promo_banner.dart`, `promo_popup.dart` | `Promotion.js` model with date range |
| **Promotion Provider** | ✅ PASS | N/A | `promotion_provider.dart` | Fetches active promos |

---

### 🌍 i18n & Theming

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Language Selection** | ✅ PASS | N/A | `language_screen.dart` → `/settings/language`, `locale_provider.dart` | EN/ZH/MS |
| **Theme (Dark/Light)** | ✅ PASS | N/A | `theme_screen.dart` → `/settings/theme`, `theme_provider.dart` | Persisted via SharedPreferences |

---

### 🏥 Health Reminder

| Feature | Status | Backend | Frontend | Notes |
|---|---|---|---|---|
| **Health Reminder** | ✅ PASS | N/A | `health_reminder_screen.dart` → `/health-reminder`, `health_reminder_provider.dart` | STI testing reminders, local scheduling |

---

### ❌ Not Built (Planned Features)

| Feature | Status | Notes |
|---|---|---|
| **Stories (24h)** | ❌ NOT BUILT | No model, route, or screen. Needs `Story` model + expiry TTL index |
| **Groups / Tribes** | ❌ NOT BUILT | No model or route. Needs `Group`, `GroupMember`, group chat |
| **Business Profiles** | ❌ NOT BUILT | Separate account type, dashboard, analytics — not implemented |
| **Date Rooms (group matching)** | ❌ NOT BUILT | No room model or matchmaking logic |
| **Icebreaker Questions** | ❌ NOT BUILT | No prompt model; profile questions not collected |
| **Safe Date Mode** | ❌ NOT BUILT | No check-in/emergency contact system |
| **Maintenance Mode** | ❌ NOT BUILT | No `GET /health` maintenance flag; no splash gate in Flutter |
| **Two-Factor Authentication** | ❌ NOT BUILT | No TOTP/SMS flow; `loginAttempts` lockout is available in PR but not 2FA |
| **Follow System** | ❌ NOT BUILT | No Follow model or routes; no follower/following counts |
| **Energy / Levels System** | ❌ NOT BUILT | No XP model, level calculations, or reward triggers |

---

## Flutter Static Analysis Summary

```
flutter analyze (ran in 2.7s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  error   •  0     ← CLEAN COMPILE
  warning •  31
  info    •  222
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Warnings Breakdown

| Count | Rule | Severity | Files |
|---|---|---|---|
| 4 | `use_key_in_widget_constructors` | Low | Various widgets |
| 4 | `curly_braces_in_flow_control_structures` | Low | Various |
| 3 | `body_might_complete_normally_catch_error` | Medium | `app.dart`, `boost_provider.dart`, `subscription_provider.dart` |
| 3 | `unnecessary_brace_in_string_interps` | Low | Multiple |
| 3 | `no_leading_underscores_for_local_identifiers` | Low | Multiple |
| 2 | `unused_import` | Low | `popular_service.dart`, `dm_provider.dart`, others |
| 2 | `avoid_print` | Low | Multiple |
| 2 | `unnecessary_non_null_assertion` | Medium | `push_notification_service.dart` |
| 1 | `use_build_context_synchronously` | **High** | `settings_screen.dart:302` |
| 1 | `unused_field` | Low | `health_reminder_screen.dart:19` |
| 1 | `unused_shown_name` | Low | `place_detail_screen.dart:10` |

> **⚠️ HIGH: `use_build_context_synchronously`** at `settings_screen.dart:302` — BuildContext used after async gap without proper mounted guard. Can crash in release builds.

### Infos Breakdown (222 total)

| Count | Rule |
|---|---|
| 200 | `deprecated_member_use` — `.withOpacity()` deprecated in Flutter 3.x, use `.withValues()` |
| 4 | `use_key_in_widget_constructors` |
| others | Minor style issues |

---

## Backend Route Coverage

| Route File | Mount Path | Auth Guarded | Models Used | Status |
|---|---|---|---|---|
| `auth.js` | `/api/auth` | `POST /logout` only | User, Referral | ✅ |
| `users.js` | `/api/users` | All except discovery | User, Swipe | ✅ |
| `photos.js` | `/api/users` | All | User | ✅ |
| `swipes.js` | `/api/swipes` | All | Swipe, Match, User | ✅ |
| `matches.js` | `/api/matches` | All | Match, Message | ✅ |
| `blocks.js` | `/api/users` | All | User | ✅ |
| `subscriptions.js` | `/api/subscriptions` | All + strictLimiter in PR | User | ✅ |
| `boost.js` | `/api/users` | All | User | ✅ |
| `plates.js` | `/api/plates` | All | LicensePlate, PlateMessage, User | ✅ |
| `promotions.js` | `/api/promotions` | All | Promotion | ✅ |
| `notifications.js` | `/api/notifications` | All | User | ✅ |
| `shouts.js` | `/api/shouts` | All | Shout, User | ✅ |
| `popular.js` | `/api/popular` | All | User | ✅ |
| `moments.js` | `/api/moments` | All | Moment, MomentComment | ✅ |
| `gifts.js` | `/api/gifts` + `/api/coins` | All + strictLimiter in PR | Gift, GiftTransaction, User | ✅ |
| `events.js` | `/api/events` | All | Event, User | ✅ |
| `verification.js` | `/api/verification` | All | Verification, User | ✅ |
| `direct-messages.js` | `/api/dm` | All | DirectMessage, User | ✅ |
| `calls.js` | `/api/calls` | All | CallLog | ⚠️ History only, no WebRTC |
| `stickers.js` | `/api/stickers` | All | StickerPack, User | ✅ |
| `secret-codes.js` | `/api/codes` | All | SecretCode, Match | ✅ |
| `referrals.js` | `/api/referrals` | All | User, Referral, Commission, Wallet, Withdrawal | ✅ |
| `places.js` | `/api/places` | All | Place, PlaceEvent, User | ✅ |

**Orphaned models (no route):** `Payment.js` — exists but not wired to any route.

---

## Screens Not in routes.dart (Intentional)

These 5 screens are navigated via `Navigator.push()` or embedded as tabs inside other screens — they do NOT need named GoRouter routes:

| Screen | How Accessed |
|---|---|
| `LocationMapScreen` | Tab inside `LocationHubScreen` |
| `CallingScreen` | Tab inside `LocationHubScreen` |
| `NearbyListScreen` | Tab inside `LocationHubScreen` |
| `ActiveCallScreen` | `Navigator.push` from chat + `IncomingCallScreen` |
| `IncomingCallScreen` | Overlay shown from `HomeScreen` socket listener |

---

## Pending Merge (worktree: `claude/flamboyant-burnell`)

The following improvements exist in the PR branch but are **not yet on `main`**:

| Item | File |
|---|---|
| Rate limiting (auth/API/strict) | `src/middleware/rateLimiter.js` |
| NoSQL injection sanitize | `src/app.js` (mongoSanitize) |
| Account lockout after 5 failed logins | `src/routes/auth.js`, `src/models/User.js` |
| MYR coin shop (4 tiers + bonus) | `src/routes/gifts.js` |
| Premium extends rather than replaces | `src/routes/subscriptions.js` |
| `/api/subscriptions/plans` GET endpoint | `src/routes/subscriptions.js` |
| Events calendar screen | `app/lib/features/events/calendar_screen.dart` |
| `/events/calendar` route | `app/lib/config/routes.dart` |
| Calendar button on events screen | `app/lib/features/events/events_screen.dart` |
| Animated premium screen rewrite | `app/lib/features/premium/premium_screen.dart` |
| `CoinPackage.bonus` / `totalCoins` fields | `app/lib/core/models/gift.dart` |

---

## Recommended Fixes (Priority Order)

### 🔴 Critical
1. **`settings_screen.dart:302`** — `use_build_context_synchronously`: wrap the post-await code with a proper `if (!mounted) return;` guard.
2. **Merge PR `claude/flamboyant-burnell`** — brings security hardening (rate limiting, lockout, sanitize) to main.

### 🟡 Medium
3. **Fix duplicate Mongoose indexes** in `User.js`, `LicensePlate.js`, `Referral.js`, `Swipe.js` — remove the redundant `schema.index()` calls for fields already marked `unique: true`.
4. **`push_notification_service.dart`** — Remove unnecessary `!` assertions (lines 51, 64, 70, 79).
5. **Wire `Payment.js`** — either add a `/api/payments` route or remove the orphaned model.
6. **`body_might_complete_normally`** — Add explicit `return;` in `catchError` callbacks in `app.dart:63`, `boost_provider.dart:103`, `subscription_provider.dart:124`.

### 🟢 Low / Style
7. Replace all `.withOpacity()` with `.withValues(alpha: x)` (200 occurrences — run a project-wide replace).
8. Remove unused imports: `popular_service.dart`, `dm_provider.dart`, `secret_code_provider.dart`, `stickers_provider.dart`.
9. Add WebRTC/Agora signaling backend to `calls.js` for real VoIP.
10. Add `readAt` field to `Message.js` and implement read-receipt UI.
