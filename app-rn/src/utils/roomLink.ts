/**
 * Share-link <-> room-id mapping for Plaza/World-Chat rooms.
 *
 * Rooms have colon-namespaced ids (`country:world:chitchat`, `country:my:social`)
 * plus a few legacy/simple forms (`world`, a bare country code, or a 24-hex
 * ObjectId for UGC rooms). Pasting the raw id into a URL looks ugly
 * (`/r/country:world:chitchat`), so the share link uses a friendlier slug.
 *
 *   country:<cc>:<key>  <->  <cc>-<key>     e.g. country:world:chitchat <-> world-chitchat
 *   everything else      ==   itself         (world / country code / ObjectId / channel id)
 *
 * `slugToRoomId` also accepts the OLD colon slugs verbatim, so links already
 * shared into chats keep resolving. Keep this in sync with the backend twin in
 * backend-express/src/web/roomLanding.js (slugToRoomId / roomIdToSlug).
 */
const SHARE_BASE = 'https://meyou.uk';

/** Canonical room id -> pretty URL slug. */
export function roomIdToSlug(roomId: string): string {
  if (!roomId) return '';
  if (roomId.startsWith('country:')) {
    const [, cc, key] = roomId.split(':');
    if (cc && key) return `${cc}-${key}`;
  }
  return roomId;
}

/** URL slug (pretty OR legacy colon form) -> canonical room id. */
export function slugToRoomId(slug: string): string {
  if (!slug) return '';
  if (slug.includes(':')) return slug; // legacy colon link or channel id — already canonical
  const i = slug.indexOf('-');
  if (i > 0) return `country:${slug.slice(0, i)}:${slug.slice(i + 1)}`;
  return slug; // 'world', bare country code, or ObjectId
}

/** Full shareable https link for a room. */
export function roomShareUrl(roomId: string): string {
  return `${SHARE_BASE}/r/${roomIdToSlug(roomId)}`;
}
