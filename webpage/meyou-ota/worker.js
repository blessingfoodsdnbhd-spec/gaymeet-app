/**
 * Meyou 密友 — self-hosted OTA (Expo Updates) server on Cloudflare Workers.
 *
 * Replaces EAS Update. $0/month within the Cloudflare free tier
 * (10M Worker requests + 10GB R2 + 1GB KV).
 *
 * Implements the Expo Updates Protocol (protocol versions 0 and 1) so a
 * production Meyou build with `expo-updates` pointed at
 *   https://updates.meyou.uk/manifest
 * fetches JS-only updates on cold start.
 *
 * Bindings (see wrangler.toml):
 *   BUNDLES    R2 bucket  — stores JS bundles + assets (content-addressed)
 *   MANIFESTS  KV         — the "latest" manifest pointer per channel/platform/rtv
 *                          + per-id snapshots for rollback + a short history list
 *   OTA_ADMIN_TOKEN (secret) — gate for /admin/* (rollback, state)
 *   HOSTNAME   (var)      — absolute origin, e.g. https://updates.meyou.uk
 *
 * KV layout:
 *   latest:<channel>:<platform>:<rtv>   → manifest JSON (served by /manifest)
 *   manifest:<id>                       → manifest JSON (snapshot, for rollback)
 *   history:<channel>:<platform>:<rtv>  → JSON [{id, createdAt}], newest first
 *
 * Endpoints:
 *   GET  /manifest?platform=&runtimeVersion=&channel=   (Expo Updates manifest)
 *   GET  /bundles/:key                                  (JS bundle blob from R2)
 *   GET  /assets/:key                                   (asset blob from R2)
 *   GET  /health                                        ({ ok: true })
 *   GET  /                                              (human info page)
 *   GET  /admin/state?channel=&platform=&runtimeVersion=   (current + history)
 *   POST /admin/rollback  { channel, platform, runtimeVersion, id }
 *   POST /admin/publish   { channel, platform, runtimeVersion, manifest }  (used by publish script)
 */

const DEFAULT_CHANNEL = 'production';
const IMMUTABLE = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/health') return json({ ok: true });
      if (pathname === '/' || pathname === '') return infoPage(env);

      if (pathname === '/manifest') return handleManifest(request, url, env);

      if (pathname.startsWith('/bundles/'))
        return serveBlob(env, 'bundles/' + decodeURIComponent(pathname.slice('/bundles/'.length)));
      if (pathname.startsWith('/assets/'))
        return serveBlob(env, 'assets/' + decodeURIComponent(pathname.slice('/assets/'.length)));

      if (pathname.startsWith('/admin/')) return handleAdmin(request, url, env, pathname);

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message ? e.message : e) }, 500);
    }
  },
};

// ── /manifest ────────────────────────────────────────────────────────────────
// Expo Updates clients send platform/runtime-version/channel via headers
// (expo-*). We also accept query params so the endpoint is curl-testable.
async function handleManifest(request, url, env) {
  const h = request.headers;
  const platform = (h.get('expo-platform') || url.searchParams.get('platform') || '').toLowerCase();
  const runtimeVersion =
    h.get('expo-runtime-version') || url.searchParams.get('runtimeVersion') || '';
  const channel =
    h.get('expo-channel-name') || url.searchParams.get('channel') || DEFAULT_CHANNEL;
  const protocolVersion = parseInt(h.get('expo-protocol-version') || '0', 10);

  if (platform !== 'ios' && platform !== 'android')
    return json({ error: 'Unsupported or missing platform (expo-platform)' }, 400);
  if (!runtimeVersion)
    return json({ error: 'Missing runtimeVersion (expo-runtime-version)' }, 400);

  const key = `latest:${channel}:${platform}:${runtimeVersion}`;
  const manifestStr = await env.MANIFESTS.get(key);

  if (!manifestStr) {
    // Nothing published for this slot → tell the client to keep its embedded
    // bundle. Protocol 1 has a first-class directive for this; protocol 0
    // has no directive concept, so a 404 is the correct "no update" signal.
    if (protocolVersion >= 1) {
      return multipart(
        { name: 'directive', json: { type: 'noUpdateAvailable' } },
        protocolVersion,
      );
    }
    return json({ error: 'No update available' }, 404);
  }

  const manifest = JSON.parse(manifestStr);
  return multipart({ name: 'manifest', json: manifest }, protocolVersion);
}

// Build the multipart/mixed body Expo Updates expects. `part` is the single
// manifest-or-directive body part.
function multipart(part, protocolVersion) {
  const boundary = 'meyou' + hex16();
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Disposition: form-data; name="${part.name}"\r\n\r\n` +
    `${JSON.stringify(part.json)}\r\n` +
    `--${boundary}--\r\n`;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': `multipart/mixed; boundary=${boundary}`,
      'expo-protocol-version': String(protocolVersion || 0),
      'expo-sfv-version': '0',
      'cache-control': 'private, max-age=0, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
}

// ── /bundles/:key  and  /assets/:key ─────────────────────────────────────────
async function serveBlob(env, r2Key) {
  const obj = await env.BUNDLES.get(r2Key);
  if (!obj) return json({ error: 'blob not found: ' + r2Key }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers); // content-type set at upload time
  if (!headers.get('content-type')) headers.set('content-type', 'application/octet-stream');
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', IMMUTABLE); // content-addressed → never changes
  headers.set('access-control-allow-origin', '*');
  return new Response(obj.body, { headers });
}

// ── /admin/* ─────────────────────────────────────────────────────────────────
async function handleAdmin(request, url, env, pathname) {
  const token = request.headers.get('x-ota-admin-token') || url.searchParams.get('token');
  if (!env.OTA_ADMIN_TOKEN) return json({ error: 'admin disabled — OTA_ADMIN_TOKEN unset' }, 503);
  if (token !== env.OTA_ADMIN_TOKEN) return json({ error: 'forbidden' }, 403);

  if (pathname === '/admin/state' && request.method === 'GET') {
    const channel = url.searchParams.get('channel') || DEFAULT_CHANNEL;
    const platform = (url.searchParams.get('platform') || 'ios').toLowerCase();
    const rtv = url.searchParams.get('runtimeVersion') || '';
    const cur = await env.MANIFESTS.get(`latest:${channel}:${platform}:${rtv}`);
    const hist = await env.MANIFESTS.get(`history:${channel}:${platform}:${rtv}`);
    const m = cur ? JSON.parse(cur) : null;
    return json({
      channel,
      platform,
      runtimeVersion: rtv,
      current: m ? { id: m.id, createdAt: m.createdAt } : null,
      history: hist ? JSON.parse(hist) : [],
    });
  }

  if (pathname === '/admin/publish' && request.method === 'POST') {
    const { channel = DEFAULT_CHANNEL, platform, runtimeVersion, manifest } =
      await request.json();
    if (!platform || !runtimeVersion || !manifest)
      return json({ error: 'platform, runtimeVersion, manifest required' }, 400);
    await putManifest(env, channel, platform, runtimeVersion, manifest);
    return json({ ok: true, id: manifest.id });
  }

  if (pathname === '/admin/rollback' && request.method === 'POST') {
    const { channel = DEFAULT_CHANNEL, platform, runtimeVersion, id } = await request.json();
    if (!platform || !runtimeVersion || !id)
      return json({ error: 'platform, runtimeVersion, id required' }, 400);
    const snap = await env.MANIFESTS.get(`manifest:${id}`);
    if (!snap) return json({ error: 'unknown manifest id: ' + id }, 404);
    await env.MANIFESTS.put(`latest:${channel}:${platform}:${runtimeVersion}`, snap);
    return json({ ok: true, rolledBackTo: id });
  }

  return json({ error: 'not found' }, 404);
}

// Store a manifest as the new "latest", snapshot it by id, and prepend to the
// (capped) history list. Shared by /admin/publish and could be reused by KV
// puts from the publish script.
async function putManifest(env, channel, platform, runtimeVersion, manifest) {
  const str = JSON.stringify(manifest);
  await env.MANIFESTS.put(`latest:${channel}:${platform}:${runtimeVersion}`, str);
  await env.MANIFESTS.put(`manifest:${manifest.id}`, str);
  const hk = `history:${channel}:${platform}:${runtimeVersion}`;
  const prev = await env.MANIFESTS.get(hk);
  const list = prev ? JSON.parse(prev) : [];
  list.unshift({ id: manifest.id, createdAt: manifest.createdAt });
  await env.MANIFESTS.put(hk, JSON.stringify(list.slice(0, 30)));
}

// ── helpers ──────────────────────────────────────────────────────────────────
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

function hex16() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function infoPage(env) {
  const host = env.HOSTNAME || 'https://updates.meyou.uk';
  return new Response(
    `Meyou OTA (Expo Updates) server — OK\n\n` +
      `manifest : ${host}/manifest?platform=ios&runtimeVersion=1.0.0&channel=production\n` +
      `bundles  : ${host}/bundles/<key>\n` +
      `assets   : ${host}/assets/<key>\n` +
      `health   : ${host}/health\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
}
