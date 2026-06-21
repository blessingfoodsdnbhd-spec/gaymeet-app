/**
 * Cloudflare Pages Function — meyou.uk/api/waitlist
 *
 * Backs the beta waitlist / "搶先預約 · Notify me" form on the landing page.
 * The form (index.html `#waitlist`) already POSTs JSON `{ email, source }` to
 * whatever URL is in its `data-endpoint` attribute — point that at
 * `/api/waitlist` and submissions land here.
 *
 * Storage: a Cloudflare KV namespace bound as `WAITLIST`. Each signup is one
 * key `email:<lowercased>` → JSON `{ email, source, at, ua, country, ref }`,
 * so re-submitting the same address is an idempotent upsert (no dupes). A
 * `meta:count` counter tracks unique signups for the simple stats display.
 *
 * Reading the list (owner only):
 *   GET /api/waitlist?key=<WAITLIST_ADMIN_KEY>            → JSON
 *   GET /api/waitlist?key=<WAITLIST_ADMIN_KEY>&format=csv → CSV download
 *   GET /api/waitlist?count=1                             → { count } (public, no emails)
 *
 * Setup (one-time, in the `meyou` Pages project — see functions/README.md):
 *   1. Create a KV namespace, e.g. `wrangler kv:namespace create meyou_waitlist`
 *   2. Pages → Settings → Functions → KV namespace bindings:
 *        Variable name `WAITLIST` → the namespace above.
 *   3. Pages → Settings → Environment variables:
 *        `WAITLIST_ADMIN_KEY` = a long random string (your export password).
 *
 * The function degrades gracefully: if `WAITLIST` is not bound it still returns
 * `{ ok: true, stored: false }` so the visitor sees the thank-you state, and
 * logs a warning to the Pages function log.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    // tolerate form-encoded bodies too
    try {
      const text = await request.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } catch (_e) {
      body = {};
    }
  }

  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || 'meyou-website').slice(0, 64);

  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  // Honeypot: real form has no `website` field; bots tend to fill every input.
  if (body.website) {
    return json({ ok: true, stored: false, deduped: true }); // silently drop
  }

  if (!env || !env.WAITLIST) {
    console.warn('[waitlist] KV namespace WAITLIST not bound — signup not stored:', email);
    return json({ ok: true, stored: false });
  }

  const key = `email:${email}`;
  const existing = await env.WAITLIST.get(key);

  const record = {
    email,
    source,
    at: new Date().toISOString(),
    ua: (request.headers.get('User-Agent') || '').slice(0, 256),
    country: request.headers.get('CF-IPCountry') || '',
    ref: (request.headers.get('Referer') || '').slice(0, 256),
  };

  await env.WAITLIST.put(key, JSON.stringify(record));

  if (!existing) {
    // bump the public counter only for genuinely new addresses
    const prev = parseInt((await env.WAITLIST.get('meta:count')) || '0', 10) || 0;
    await env.WAITLIST.put('meta:count', String(prev + 1));
  }

  return json({ ok: true, stored: true, deduped: Boolean(existing) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Public, email-free count for an optional "N people waiting" badge.
  if (url.searchParams.get('count')) {
    const count = env && env.WAITLIST
      ? parseInt((await env.WAITLIST.get('meta:count')) || '0', 10) || 0
      : 0;
    return json({ count });
  }

  // Owner export — gated on the admin key.
  const key = url.searchParams.get('key') || '';
  if (!env || !env.WAITLIST_ADMIN_KEY || key !== env.WAITLIST_ADMIN_KEY) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (!env.WAITLIST) {
    return json({ ok: false, error: 'kv_not_bound' }, 500);
  }

  const rows = [];
  let cursor;
  do {
    const page = await env.WAITLIST.list({ prefix: 'email:', cursor });
    for (const k of page.keys) {
      const raw = await env.WAITLIST.get(k.name);
      if (raw) {
        try { rows.push(JSON.parse(raw)); } catch (_) { /* skip corrupt */ }
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  if (url.searchParams.get('format') === 'csv') {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const header = 'email,source,at,country,ref,ua';
    const lines = rows.map((r) => [r.email, r.source, r.at, r.country, r.ref, r.ua].map(esc).join(','));
    return new Response([header, ...lines].join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="meyou-waitlist.csv"',
        ...CORS,
      },
    });
  }

  return json({ ok: true, count: rows.length, signups: rows });
}
