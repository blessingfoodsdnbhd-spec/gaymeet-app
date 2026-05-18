import React, { useEffect, useState } from 'react';
import { MatchOverlay } from '../screens/discover/MatchOverlay';
import { useAuth } from '../store/auth';
import { on, type WsMatchNew } from '../api/ws';
import type { DiscoverCardUser } from '../api/discover';

/**
 * Mounted at the app root. Listens for `match:new` WS events the user
 * receives from the OTHER side of a mutual swipe and pops the same
 * MatchOverlay that's shown to the swiper.
 */
export function GlobalMatchListener() {
  const me = useAuth((s) => s.user);
  const [matched, setMatched] = useState<DiscoverCardUser | null>(null);

  useEffect(() => {
    if (!me) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    on('match:new', (payload: WsMatchNew) => {
      if (cancelled) return;
      // Adapt the WS user shape into a DiscoverCardUser shape — fields we
      // don't have just default to safe values.
      const u: DiscoverCardUser = {
        id: payload.user.id,
        email: '',
        nickname: payload.user.nickname,
        interests: (payload.user.interests ?? []) as any,
        interestsOnboardedAt: null,
        prompts: [],
        distance: null,
        distKm: null,
        sharedTags: [],
        avatarIdx: 0,
      };
      setMatched(u);
    }).then((u) => {
      unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [me]);

  return (
    <MatchOverlay
      open={matched != null}
      matchedUser={matched}
      me={me}
      onMessage={() => setMatched(null)}
      onLater={() => setMatched(null)}
    />
  );
}
