# GayMeet Express Backend

Node.js + Express + MongoDB + Socket.io backend for the GayMeet Flutter app.

## Quick Start

```bash
cd backend-express
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run seed      # populate dummy data
npm run dev       # start with hot-reload (nodemon)
```

## Production

```bash
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_EXPIRES_IN` | Access token TTL (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: 30d) |
| `UPLOAD_DIR` | Directory for uploaded photos (default: ./uploads) |
| `MAX_FILE_SIZE_MB` | Max upload size in MB (default: 5) |

## API Overview

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Register with email + password + nickname |
| POST | /api/auth/login | No | Login, returns access + refresh tokens |
| POST | /api/auth/refresh | No | Exchange refresh token for new access token |
| POST | /api/auth/logout | Yes | Mark user offline, invalidate session |
| GET | /api/auth/me | Yes | Get current user profile |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users/me | Full profile |
| PATCH | /api/users/me | Update nickname, bio, tags, height, weight, age, countryCode |
| PATCH | /api/users/settings | Update privacy preferences |
| POST | /api/users/me/teleport | Set virtual location |
| DELETE | /api/users/me/teleport | Clear virtual location |
| PATCH | /api/users/me/stealth | Toggle stealth mode |
| GET | /api/users/nearby | Geo-sorted user list (2dsphere) |
| GET | /api/users/discover | Randomised swipe deck |
| GET | /api/users/likes | Who liked me (blurred for free users) |
| POST | /api/users/:id/block | Block a user |
| POST | /api/users/:id/report | Report + auto-block a user |

### Photos
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/users/photos | Upload photo (multipart/form-data, field: photo) |
| DELETE | /api/users/photos | Delete photo by URL |
| PATCH | /api/users/photos/reorder | Reorder photos array (first = avatar) |

### Swipes & Matches
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/swipes | Record swipe, returns { matched, matchId } |
| GET | /api/matches | List active matches with last message |
| GET | /api/matches/:id/messages | Paginated chat history |
| DELETE | /api/matches/:id | Unmatch |

### Saw You (License Plates)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/plates/claim | Claim a plate number |
| GET | /api/plates/check/:plate | Check if plate exists/claimed |
| POST | /api/plates/message | Send message to plate owner |
| GET | /api/plates/messages | Inbox (messages on my plate) |
| POST | /api/plates/messages/:id/report | Report a plate message |
| POST | /api/plates/messages/:id/block | Block plate message sender |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/shouts | Nearby shouts within radius |
| GET | /api/shouts/mine | My active shout |
| POST | /api/shouts | Post a shout (max 140 chars, 24h TTL) |
| DELETE | /api/shouts | Delete my shout |
| GET | /api/popular | Top users leaderboard |
| POST | /api/popular/ticket/use | Use a popularity ticket |
| POST | /api/popular/ticket/purchase | Purchase tickets (Premium only) |
| GET | /api/promotions | Active promotions |
| POST | /api/subscriptions/purchase | Purchase Premium plan |
| GET | /api/subscriptions/status | Check Premium status |
| POST | /api/users/boost | Activate profile boost (Premium only) |
| POST | /api/notifications/token | Register FCM push token |
| DELETE | /api/notifications/token | Remove FCM push token |

## Socket.io Events

Connect with: `io('http://localhost:3000', { auth: { token: '<accessToken>' } })`

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `join_room` | `{ matchId }` | Join a chat room |
| Client → Server | `leave_room` | `{ matchId }` | Leave a chat room |
| Client → Server | `chat:send` | `{ matchId, content }` | Send a message |
| Client → Server | `chat:read` | `{ matchId }` | Mark messages as read |
| Server → Client | `chat:receive` | MessageObject | New message received |
| Server → Client | `chat:read` | `{ matchId, readBy }` | Read receipt |
| Server → Client | `user:online` | `{ userId, online: true }` | Match came online |
| Server → Client | `user:offline` | `{ userId, online: false }` | Match went offline |

## Free Tier Limits

| Feature | Free Limit |
|---------|------------|
| Daily swipes | 20/day |
| Plate messages | 3/day |
| Who Liked You | Count only (blurred avatars) |
| Boost | Premium only |
| Stealth | 1 activation/day |
| Teleport | Premium only |
