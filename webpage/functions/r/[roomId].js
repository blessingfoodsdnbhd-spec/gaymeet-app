/**
 * Cloudflare Pages Function — meyou.uk/r/{roomId}
 *
 * The room share-landing page. The catch-all SPA on meyou.uk would otherwise
 * swallow /r/* , so this function intercepts it and proxies the canonical HTML
 * from the API host (which knows the room title and renders the deep-link
 * bounce page). Mirrors how /u/:id is served.
 *
 * Deploy: this directory is uploaded to the `meyou` Cloudflare Pages project
 * alongside the rest of the site. The API origin can be overridden with the
 * MEYOU_API_ORIGIN environment variable in the Pages project settings.
 */
export async function onRequestGet(context) {
  const { params, env, request } = context;
  const roomId = encodeURIComponent(params.roomId || '');
  const origin = (env && env.MEYOU_API_ORIGIN) || 'https://gaymeet-api.onrender.com';
  try {
    const upstream = await fetch(`${origin}/r/${roomId}`, {
      headers: { 'User-Agent': request.headers.get('User-Agent') || 'meyou-pages' },
    });
    const html = await upstream.text();
    return new Response(html, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    // Fall back to a bare redirect to the deep link if the API is unreachable.
    return Response.redirect(`meyou://room/${roomId}`, 302);
  }
}
