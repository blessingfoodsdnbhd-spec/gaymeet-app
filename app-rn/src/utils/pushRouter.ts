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
 *   follow   → { type, fromUserId }            tap → UserDetail(fromUserId)
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
    // Moment activity → open the moment's comments/detail. `moment_like` is a
    // like on your MOMENT (distinct from `like`, which is a swipe-like feed).
    case 'comment':
    case 'comment_reply':
    case 'moment_like':
    case 'moment_tag': {
      const id = data.momentId ? String(data.momentId) : null;
      if (!id) return false;
      return safeNavigate('Comments', { momentId: id });
    }
    case 'like': {
      return safeNavigate('MatchesList');
    }
    case 'follow': {
      // Open the FOLLOWER's full-screen profile (the user who just followed
      // you), not the followers list. The backend puts the follower's id on
      // data.fromUserId (routes/follows.js). Fall back to the list if absent.
      const fromUserId = data.fromUserId ? String(data.fromUserId) : null;
      if (!fromUserId) return safeNavigate('FriendsList');
      return safeNavigate('UserDetail', { userId: fromUserId });
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
    case 'world_chat_reply':
    case 'world_chat_mention':
    case 'world_chat_message': {
      // Reply / @mention / new room message (我在的房间) → open the room and, when
      // a specific message is referenced, scroll to it. `custom` ('1'/'0') flags
      // a user-created room.
      const roomId = data.roomId ? String(data.roomId) : null;
      if (!roomId) return safeNavigate('Main');
      const scrollToMessageId = data.messageId ? String(data.messageId) : undefined;
      return safeNavigate('WorldChatRoom', {
        roomId,
        custom: String(data.custom ?? '') === '1',
        scrollToMessageId,
      });
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
    case 'daily_digest': {
      return safeNavigate('VotesList');
    }
    case 'daily_matches': {
      // "今日缘分" daily recommendations nudge → open the Discover tab where the
      // fresh interest+geo-ranked picks are computed.
      return safeNavigate('Main', { screen: 'Discover' });
    }
    case 'invite_redeemed': {
      return safeNavigate('InviteFriends');
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
    case 'hidden_photo_request': {
      // Owner side: someone asked to see their hidden photos → management hub
      // (which shows the pending request with approve/reject).
      return safeNavigate('MyHiddenPhotos');
    }
    case 'hidden_photo_approved': {
      // Requester side: their request was approved (or the owner opened
      // proactively) → open the owner's profile so the now-unlocked photos show.
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
    // ── Admin moderation deep-links ──────────────────────────────────────────
    case 'verification_submitted':
      // Admin: a user submitted an action-photo verification → review queue.
      return safeNavigate('AdminVerifications');
    case 'report_submitted':
      // Admin: a new user report landed → reports dashboard.
      return safeNavigate('AdminReports');
    case 'verification_result':
      // User: their verification was approved/rejected → their status screen.
      return safeNavigate('Verification');
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
