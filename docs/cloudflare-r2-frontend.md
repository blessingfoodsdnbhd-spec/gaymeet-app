# Fix #2 — Put a CDN/transform in front of B2 (speed up EXISTING images)

Fix #1 (server-side resize on upload, shipped) only shrinks **new** uploads.
The photos users see today were uploaded full-resolution (up to ~4 MB) and are
served straight from B2's origin (`f005.backblazeb2.com`) with **no CDN** — for
Malaysia users that's a slow, un-cached, cross-region fetch every time.

This doc covers the three ways to fix that, in order of recommendation.

Current state:
- Storage: Backblaze **B2** (native API), bucket `meyou-media`.
- Public URL prefix: `R2_PUBLIC_URL = https://f005.backblazeb2.com/file/meyou-media`
  (env var on Render; consumed by `backend-express/src/services/r2Service.js`).
- The only code coupling is `R2_PUBLIC_URL`: change it and every newly-returned
  image URL points at the new front-end. (Existing DB rows keep the old host —
  see "Migrating existing URLs" below.)

---

## Option A — Cloudflare in front of B2 via Bandwidth Alliance (recommended)

B2 + Cloudflare have **free egress** between them (Bandwidth Alliance). You front
the bucket with a Cloudflare-proxied custom domain; Cloudflare edge-caches near
users. Add a Worker (or Cloudflare Image Resizing) for on-the-fly variants so the
existing 4 MB originals are downscaled at the edge.

Steps:
1. **Custom domain on the bucket.** In B2, the public file URL is
   `https://f005.backblazeb2.com/file/meyou-media/<key>`. Create a CNAME
   `cdn.meyou.uk → f005.backblazeb2.com` in Cloudflare DNS (proxied / orange
   cloud). Cloudflare must be the authoritative DNS for the domain.
2. **Cache rule.** Cloudflare → Caching → Cache Rules: cache everything under
   `cdn.meyou.uk/file/meyou-media/*`, respect origin `Cache-Control` (Fix #1 now
   sets `public, max-age=31536000, immutable`), Edge TTL = a year.
3. **On-the-fly resize (the part that rescues existing images):** either
   - **Cloudflare Image Resizing** (URL-based, on paid plans): request
     `/cdn-cgi/image/width=1080,quality=80,format=auto/<origin-url>` — Cloudflare
     fetches the big origin once, caches the resized+webp variant at the edge. Or
   - **A Worker** (snippet below) that rewrites incoming requests to the Image
     Resizing endpoint, so app URLs stay clean (`cdn.meyou.uk/file/...`).
4. **Point the app at it:** set Render env `R2_PUBLIC_URL=https://cdn.meyou.uk/file/meyou-media`
   and redeploy. New uploads return the CDN host; combine with the Worker so the
   client can append `?w=1080` (or the Worker forces a sensible default width).
5. **Verify:** `curl -I https://cdn.meyou.uk/file/meyou-media/<key>` shows
   `cf-cache-status: HIT` (2nd hit) and a reduced `content-length`.

Minimal Worker (default-resize + edge cache):

```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // Map cdn.meyou.uk/file/<bucket>/<key> → B2 origin, resized via Cloudflare.
    const origin = `https://f005.backblazeb2.com${url.pathname}`;
    const width = url.searchParams.get('w') || '1080';
    return fetch(origin, {
      cf: {
        image: { width: Number(width), quality: 80, format: 'auto' },
        cacheTtl: 31536000,
        cacheEverything: true,
      },
    });
  },
};
```

Pros: rescues existing images, free B2↔CF egress, edge-cached near users,
auto-webp. Cons: Image Resizing needs a paid Cloudflare plan; some DNS/Worker
setup.

---

## Option B — Migrate storage to Cloudflare R2

We already use the `R2_*` env naming, so this is "less change" conceptually. R2 is
S3-compatible, sits natively behind Cloudflare's CDN, and pairs with Image
Resizing the same way as Option A.

Steps:
1. Create an R2 bucket + an R2 public domain (`cdn.meyou.uk`).
2. Rewrite `r2Service.js` to use the S3 API (`@aws-sdk/client-s3`) against R2 —
   note the existing comment in that file: the AWS SDK previously tripped a
   signing bug with B2's S3 endpoint; **R2's** S3 endpoint does not have that
   issue, so the SDK path is viable here.
3. Copy existing objects B2 → R2 (rclone: `rclone copy b2:meyou-media r2:meyou-media`).
4. Flip `R2_PUBLIC_URL` to the R2 domain; redeploy. Layer Image Resizing as in A.

Pros: native CF integration, one vendor, no cross-origin hop. Cons: a storage
migration + an `r2Service.js` rewrite + data copy; bigger blast radius.

---

## Option C — Cloudflare Images (easiest, paid)

Upload images to **Cloudflare Images**; it stores, resizes, and serves named
variants (`/thumbnail`, `/public`) globally. Change the upload path in
`r2Service.js` to POST to the Images API and store the returned delivery URL.

Pros: least infra to operate; built-in variants + global delivery. Cons: per-
image + per-delivery pricing; a second storage system to manage; existing B2
images would need a bulk import to benefit.

---

## Migrating existing URLs (applies to A and B)

New uploads pick up the new host automatically (via `R2_PUBLIC_URL`). Existing
`User.photos[]` / `avatarUrl` / `Announcement.imageUrl` / moment images still hold
the old `f005.backblazeb2.com` host. Two choices:
- **Keep the old host working** (simplest): leave a Cloudflare route that also
  proxies the legacy path, OR keep B2 public — old URLs still resolve (just
  un-CDN'd) while all *new* ones are fast. Acceptable as a transition.
- **Rewrite in place** (full win): a one-off script that swaps the host prefix on
  every stored image URL once the CDN domain serves the same keys. Scoped,
  reversible; run after the CDN is verified.

## Recommendation

**Option A.** Lowest-change path that *also* speeds up the already-uploaded
images users are complaining about, with free B2↔Cloudflare egress. Stand up the
proxied domain + cache rule first (instant edge-caching + the Fix #1 immutable
headers), then add the resize Worker to downscale the legacy 4 MB originals.
