# GayMeet Deployment Guide

## Overview

Stack: Flutter (mobile) → Express + Socket.io (Render) → MongoDB Atlas

---

## Step 1 — MongoDB Atlas (free cluster)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account.
2. Click **"Build a Database"** → choose **M0 Free** tier → pick a region close to your users.
3. Create a database user:
   - **Security → Database Access → Add New Database User**
   - Username: `gaymeet`, Password: (generate a strong one, save it)
   - Role: **Atlas admin** (or **readWriteAnyDatabase**)
4. Allow network access:
   - **Security → Network Access → Add IP Address**
   - Click **"Allow Access from Anywhere"** (`0.0.0.0/0`) — required for Render's dynamic IPs
5. Get your connection string:
   - **Database → Connect → Drivers**
   - Copy the URI, it looks like:
     ```
     mongodb+srv://gaymeet:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual password and append the database name:
     ```
     mongodb+srv://gaymeet:yourpassword@cluster0.xxxxx.mongodb.net/gaymeet?retryWrites=true&w=majority
     ```

---

## Step 2 — Deploy to Render (free tier)

### Option A — Blueprint (recommended, uses render.yaml)

1. Push this repo to GitHub (make sure `render.yaml` is in the root).
2. Go to [render.com](https://render.com) and sign up / log in.
3. Click **"New" → "Blueprint"**.
4. Connect your GitHub repo.
5. Render will detect `render.yaml` and create the `gaymeet-backend` service.
6. Before confirming, set the two secret env vars that are marked `sync: false`:
   - `MONGODB_URI` — your Atlas connection string from Step 1
   - `CLIENT_URL` — leave blank for now, update after first deploy
7. Click **"Apply"**. First deploy takes ~2 minutes.
8. Once deployed, copy the URL (e.g. `https://gaymeet-backend.onrender.com`).
9. Go to the service **Environment** tab, set `CLIENT_URL` to that URL, and **Save**.

### Option B — Manual

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub repo, set **Root Directory** to `backend-express`.
3. Runtime: **Node**, Build: `npm install`, Start: `node server.js`.
4. Set all env vars from `backend-express/.env.example`.
5. Deploy.

### Important notes about Render free tier

- The service **spins down after 15 minutes of inactivity** and takes ~30s to wake up on the next request.
- Uploaded files (photos) are **ephemeral** — they reset on each deploy. For production, use an object storage service (Cloudflare R2, AWS S3, Backblaze B2).
- For always-on hosting, upgrade to Render's Starter plan ($7/month).

---

## Step 3 — Update the Flutter app

Replace `localhost:3000` with your Render URL at build time using `--dart-define`.
The app reads `API_URL` from the environment — no code changes needed.

### Development (local backend)
```bash
cd app
flutter run
# defaults to http://localhost:3000
```

### Production build (Render backend)
```bash
cd app
# Replace the URL with your actual Render service URL
flutter run --dart-define=API_URL=https://gaymeet-backend.onrender.com

# Release APK
flutter build apk --release --dart-define=API_URL=https://gaymeet-backend.onrender.com

# Release iOS
flutter build ipa --release --dart-define=API_URL=https://gaymeet-backend.onrender.com
```

### Tip — make a `.env` for Flutter builds

Create `app/.env.production`:
```
API_URL=https://gaymeet-backend.onrender.com
```

Then add a Makefile target:
```makefile
prod:
    flutter run --dart-define=API_URL=https://gaymeet-backend.onrender.com
```

---

## Step 4 — Verify deployment

```bash
# Health check
curl https://gaymeet-backend.onrender.com/health
# Expected: {"ok":true}

# Test registration
curl -X POST https://gaymeet-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","nickname":"Test"}'
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for access tokens (Render auto-generates) |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh tokens (Render auto-generates) |
| `JWT_EXPIRES_IN` | No | Access token lifetime (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token lifetime (default: `30d`) |
| `PORT` | No | HTTP port (Render sets this automatically) |
| `UPLOAD_DIR` | No | Local upload directory (default: `./uploads`) |
| `MAX_FILE_SIZE_MB` | No | Max photo upload size (default: `5`) |
| `CLIENT_URL` | No | Deployed frontend/app URL for CORS |

---

## Troubleshooting

**Service crashes on startup**
- Check Render logs for `Missing required env var`. Make sure `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are all set.

**MongoDB connection refused**
- Confirm `0.0.0.0/0` is in Atlas Network Access.
- Double-check the password in the connection string (special chars must be URL-encoded).

**Photos not loading after redeploy**
- Render free tier has ephemeral storage. Use an object storage service for persisting uploads.

**App stuck on spinner (no response)**
- Render free tier sleeps after inactivity. The first request after sleep takes ~30s. This is normal.
