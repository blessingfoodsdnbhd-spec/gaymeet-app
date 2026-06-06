import { safeNavigate, navigationRef } from '../navigation/navigationRef';

/**
 * Push payload shape — backend must put one of these `type` values on
 * messaging().send({ data: { type, ... } }) for tap routing to work.
 *
 * Backend reference (when push send is implemented):
 *   message  → { type, matchId }              tap → ChatDetail
 *   match    → { type, matchId }              tap → ChatDetail (the new match opens chat)
 *   comment  → { type, momentId }             tap → Comments
 *   like     → { type, fromUserId? }          tap → MatchesList (likes-received feed)
 *   follow   → { type, fromUserId? }          tap → FriendsList
 *   gift / energy / other → no nav            tap → Main (default tab, soft no-op)
 *
 * Note: FCM's `data` payload values are ALWAYS strings (FCM marshals
 * objects to flat string maps). We accept that and don't coerce types.
 */
export type PushData = {
  type?: string;
  matchId?: string;
  momentId?: string;
  fromUserId?: string;
  [k: string]: unknown;
};

/**
 * Translate a push `data` payload into a navigation action.
 * Returns true if it navigated, false if it was a no-op (unknown type,
 * missing required field, or navigationRef not ready yet).
 */
export function routeFromPushData(data: PushData | undefined | null): boolean {
  if (!data) return false;
  const type = String(data.type ?? '').toLowerCase();

  switch (type) {
    case 'message':
    case 'match': {
      const id = data.matchId ? String(data.matchId) : null;
      if (!id) return false;
      return safeNavigate('ChatDetail', { chatId: id });
    }
    case 'comment': {
      const id = data.momentId ? String(data.momentId) : null;
      if (!id) return false;
      return safeNavigate('Comments', { momentId: id });
    }
    case 'like': {
      return safeNavigate('MatchesList');
    }
    case 'follow': {
      return safeNavigate('FriendsList');
    }
    case 'note': {
      return safeNavigate('NotesInbox');
    }
    case 'vote_first_vote':
    case 'vote_ending_24h':
    case 'vote_ending_1h':
    case 'vote_ended':
    case 'vote_result': {
      const eventId = data.eventId ? String(data.eventId) : null;
      if (!eventId) return safeNavigate('VotesList');
      return safeNavigate('VoteDetail', { eventId });
    }
    case 'room_invite': {
      const roomId = data.roomId ? String(data.roomId) : null;
      if (!roomId) return safeNavigate('Main');
      return safeNavigate('WorldChatRoom', { roomId, custom: true });
    }
    case 'viewers_digest': {
      return safeNavigate('Viewers');
    }
    case 'wants_you_digest': {
      return safeNavigate('LikedMe');
    }
    case 'comeback': {
      return safeNavigate('Main');
    }
    case 'photo_request': {
      // Owner side: new request landed in their inbox.
      return safeNavigate('PhotoRequests');
    }
    case 'photo_request_approved': {
      // Requester side: open the owner's profile so the (now unlocked)
      // private photos block re-renders with the granted photos.
      const ownerId = data.ownerId ? String(data.ownerId) : null;
      if (!ownerId) return safeNavigate('Main');
      return safeNavigate('UserDetail', { userId: ownerId });
    }
    case 'topic_unlock_requested': {
      // Owner side: jump into the unlock inbox.
      return safeNavigate('UnlockRequests');
    }
    case 'topic_unlock_approved': {
      // Viewer side: cross-topic visibility just unlocked for them.
      // Best landing is the discover tab — they'll see the persona's
      // sheet next time they open it. We don't have a slug here so we
      // just deep-link to the requester's profile.
      const ownerId = data.ownerId ? String(data.ownerId) : null;
      if (!ownerId) return safeNavigate('Main');
      return safeNavigate('UserDetail', { userId: ownerId });
    }
    default:
      return false;
  }
}

/**
 * If a tap routing came in before <NavigationContainer> mounted, hold the
 * data here and replay it once the ref reports ready.
 */
let pendingColdTap: PushData | null = null;

export function stashColdTap(data: PushData | null) {
  pendingColdTap = data;
}

export function drainColdTap() {
  if (!pendingColdTap) return;
  const data = pendingColdTap;
  pendingColdTap = null;
  // Defer one tick so any default RootNavigator-driven nav settles first.
  setTimeout(() => {
    if (navigationRef.isReady()) routeFromPushData(data);
  }, 200);
}
