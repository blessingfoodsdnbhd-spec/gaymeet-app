/**
 * Room share-landing page — GET /r/:roomId
 *
 * Served at meyou.uk/r/{roomId} (via the Cloudflare Pages proxy in
 * webpage/functions/r/[roomId].js) and directly on the API host. It's a tiny
 * self-contained HTML page that:
 *   1. immediately tries the custom-scheme deep link meyou://room/{roomId}
 *      (opens the app + the room if installed),
 *   2. shows an "Open in Meyou" button as a manual fallback,
 *   3. links to the app store for visitors without the app installed,
 *   4. carries OG tags + the iOS smart-app-banner meta so previews and Safari
 *      surface the app.
 *
 * No auth — this is a public landing page. The room TITLE is shown to make the
 * link enticing; it is HTML-escaped because custom-room titles are user input.
 */
const mongoose = require('mongoose');
const ChatRoom = require('../models/ChatRoom');
const { ROOMS } = require('../config/worldChatRooms');

// Store fallbacks. Overridable via env once the listings have stable IDs; the
// Play URL is deterministic from the package id, the iOS one falls back to the
// marketing site until the numeric App Store id is known.
const PLAY_URL =
  process.env.ANDROID_PLAY_URL ||
  'https://play.google.com/store/apps/details?id=com.meetupnearby.app';
const IOS_URL = process.env.IOS_APP_STORE_URL || 'https://meyou.uk';
// e.g. "6471234567" — enables the native iOS smart app banner when set.
const IOS_APP_ID = process.env.IOS_APP_STORE_ID || '';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resolve a friendly room name for display. Falls back to a generic label for
// private/unknown rooms so the page never 404s and never leaks private titles.
async function resolveRoomName(roomId) {
  const builtin = ROOMS.find((r) => r.id === roomId);
  if (builtin) return `${builtin.flag} ${builtin.en}`;
  if (mongoose.isValidObjectId(roomId)) {
    try {
      const room = await ChatRoom.findById(roomId).select('title isPrivate status').lean();
      // Don't reveal a private room's title on a public page.
      if (room && !room.isPrivate) return room.title;
    } catch (_) {
      /* fall through to generic */
    }
  }
  return 'Meyou';
}

function renderHtml({ roomId, roomName }) {
  const deepLink = `meyou://room/${encodeURIComponent(roomId)}`;
  const safeName = escapeHtml(roomName);
  const title = `Join “${safeName}” on Meyou`;
  const desc = 'Tap to open the chat in the Meyou app.';
  const banner = IOS_APP_ID
    ? `<meta name="apple-itunes-app" content="app-id=${escapeHtml(IOS_APP_ID)}, app-argument=${escapeHtml(deepLink)}">`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
${banner}
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 22px; padding: 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #4F8FE8, #8B5CD8, #E25CAE, #F08A4A);
    color: #fff; text-align: center;
  }
  .card {
    background: rgba(255,255,255,0.14); backdrop-filter: blur(8px);
    border-radius: 28px; padding: 32px 26px; max-width: 360px; width: 100%;
    box-shadow: 0 18px 48px rgba(0,0,0,0.22);
  }
  .logo { font-size: 40px; margin-bottom: 6px; }
  h1 { font-size: 22px; margin: 6px 0 4px; font-weight: 800; }
  .room { font-size: 17px; opacity: 0.95; margin: 0 0 22px; word-break: break-word; }
  a.btn {
    display: block; text-decoration: none; padding: 15px 18px; border-radius: 999px;
    font-size: 16px; font-weight: 700; margin-top: 12px;
  }
  .primary { background: #fff; color: #B23D87; }
  .ghost { background: rgba(0,0,0,0.18); color: #fff; }
  .hint { font-size: 13px; opacity: 0.85; margin-top: 18px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">💬</div>
    <h1>Meyou 密友</h1>
    <p class="room">${safeName}</p>
    <a class="btn primary" id="open" href="${escapeHtml(deepLink)}">Open in Meyou</a>
    <a class="btn ghost" id="store" href="${escapeHtml(PLAY_URL)}">Get the app</a>
    <p class="hint">If nothing happens, tap “Open in Meyou”.</p>
  </div>
<script>
  (function () {
    var deepLink = ${JSON.stringify(deepLink)};
    var ios = ${JSON.stringify(IOS_URL)};
    var play = ${JSON.stringify(PLAY_URL)};
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua);
    var storeUrl = isIOS ? ios : play;
    document.getElementById('store').href = storeUrl;
    // Auto-attempt the deep link on load; if the app isn't installed the page
    // just stays put and the buttons remain.
    var t = setTimeout(function () {}, 0);
    try { window.location.href = deepLink; } catch (e) {}
    document.getElementById('open').addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = deepLink;
    });
  })();
</script>
</body>
</html>`;
}

async function roomLanding(req, res) {
  const roomId = String(req.params.roomId || '').trim();
  if (!roomId || roomId.length > 64) return res.status(404).send('Not found');
  const roomName = await resolveRoomName(roomId);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=60');
  return res.send(renderHtml({ roomId, roomName }));
}

module.exports = { roomLanding };
