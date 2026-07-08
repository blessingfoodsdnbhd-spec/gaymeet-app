# Meyou OTA — Cloudflare Worker (deploy)

Self-hosted Expo Updates server. Replaces EAS Update. **$0/month** on the
Cloudflare free tier (10M Worker req + 10GB R2 + 1GB KV — Meyou uses a tiny
fraction of this).

- `worker.js` — the Worker (Expo Updates Protocol v0/v1: `/manifest`,
  `/bundles/:key`, `/assets/:key`, `/admin/*`).
- `wrangler.toml` — bindings + config.

Day-to-day publishing/rollback lives in the repo-root **[`OTA-GUIDE.md`](../../OTA-GUIDE.md)**.
This file is the one-time infrastructure setup.

---

## One-time setup (~5 min)

You need the Cloudflare account that owns `meyou.uk`, and `wrangler`
(`npm i -g wrangler`, already on this machine).

```bash
cd webpage/meyou-ota

# 1. Log in (opens a browser)
wrangler login

# 2. Create the R2 bucket for bundles + assets
wrangler r2 bucket create meyou-ota-bundles

# 3. Create the KV namespace for manifest pointers + rollback history
wrangler kv namespace create MANIFESTS
#    → prints:  id = "abc123..."   ← copy that id

# 4. Paste the id into wrangler.toml  →  [[kv_namespaces]] id = "..."

# 5. Set the admin secret (any long random string — save it in your password
#    manager; the publish script and rollback need it)
wrangler secret put OTA_ADMIN_TOKEN
#    → paste the secret when prompted

# 6. Deploy
wrangler deploy
```

## 7. Point `updates.meyou.uk` at the Worker

Cloudflare dashboard → **Workers & Pages → `meyou-ota-updates` → Settings →
Domains & Routes → Add → Custom Domain →** `updates.meyou.uk` → **Add domain**.

Because `meyou.uk` is already on Cloudflare, DNS is created automatically. Give
it ~1 min, then verify:

```bash
curl https://updates.meyou.uk/health
# → { "ok": true }

curl "https://updates.meyou.uk/manifest?platform=ios&runtimeVersion=1.0.0" \
     -H "expo-protocol-version: 1"
# → multipart body with a "noUpdateAvailable" directive  (nothing published yet)
```

Done. The infrastructure is live. Now publish JS with
`./scripts/publish-ota.sh` (see OTA-GUIDE.md).

---

## Architecture

```
App cold start
  → GET https://updates.meyou.uk/manifest   (expo-updates, native)
      Worker reads KV  latest:<channel>:<platform>:<runtimeVersion>
      returns multipart/mixed Expo manifest (or noUpdateAvailable)
  → GET /bundles/<key>  and  /assets/<key>   (only the new/changed blobs)
      Worker streams them from R2, immutable-cached at the edge
  → applies on the NEXT cold start
```

**Storage**

| Binding | What | Keys |
|---|---|---|
| `BUNDLES` (R2) | JS bundles + assets, content-addressed | `bundles/<md5>`, `assets/<md5>` |
| `MANIFESTS` (KV) | the served manifest + rollback snapshots + history | `latest:…`, `manifest:<id>`, `history:…` |

**Endpoints**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/manifest` | — | Expo Updates manifest (headers `expo-platform`, `expo-runtime-version`, `expo-channel-name`, `expo-protocol-version`) |
| GET | `/bundles/:key` | — | JS bundle blob (immutable) |
| GET | `/assets/:key` | — | asset blob (immutable) |
| GET | `/health` | — | liveness |
| POST | `/admin/publish` | `x-ota-admin-token` | register a manifest (used by publish script) |
| POST | `/admin/rollback` | `x-ota-admin-token` | repoint `latest` to a past `id` |
| GET | `/admin/state` | `x-ota-admin-token` (or `?token=`) | current + last 30 published |

## Channels

`channel` (default `production`) lets you run a `staging` track. The app build's
`expo-channel-name` (set via EAS channel or `app.json`) decides which one it
pulls. Publish to staging with `./scripts/publish-ota.sh staging`.

## Code signing

Not enabled (keeps it free and simple). The app build has no
`updates.codeSigningCertificate`, so the client does not require a signature.
The manifest still carries per-asset SHA-256 hashes that expo-updates verifies
on download, so a corrupted/MITM'd bundle is rejected. To add end-to-end
signing later, generate a cert, add `codeSigningCertificate` to `app.json`, and
sign the manifest in `handleManifest` (add an `expo-signature` header to the
manifest part).

## Notes / gotchas

- **`runtimeVersion` must match** between the installed build and the published
  manifest, or the client ignores the update (this is the native-compat guard).
  It's pinned to `1.0.0` for now — bump it in `app.json` **and** publish with
  `RUNTIME_VERSION=` set to the same value whenever native code changes.
- The Worker never lists R2/KV on the hot path — every request is a single
  point read, so it stays well under free-tier CPU limits.
- Blob keys are content hashes → re-publishing unchanged assets is a no-op
  overwrite; only changed files cost an upload.
