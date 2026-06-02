import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../store/auth';
import { getUserById } from '../api/me';
import { swipe, type DiscoverCardUser } from '../api/discover';
import { AboutUserSheet } from '../screens/discover/AboutUserSheet';

// Deterministic 0–9 placeholder-gradient index. Mirrors the idxFor helpers in
// MomentItem / CommentsScreen so the avatar gradient stays stable for a user
// across surfaces.
function idxFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * Reusable controller for the AboutUserSheet (the Nearby profile sheet) so it
 * can be opened anywhere a user id is available — Moments feed, Comments, etc.
 *
 * The feed/comment author objects are minimal ({ _id, nickname, avatarUrl }),
 * so we fetch the full profile via getUserById and shape it into the
 * DiscoverCardUser the sheet expects (distance/sharedTags aren't meaningful off
 * the Nearby grid, so they're nulled/empty).
 *
 * openAbout(userId) is a no-op for your own id — you can't 想认识/关注/信息
 * yourself — matching the sheet's internal self-guard but stopping it from even
 * opening.
 *
 * Usage:
 *   const { openAbout, aboutSheet } = useAboutUserSheet();
 *   ...onPress={() => openAbout(author._id)}
 *   ...{aboutSheet}   // render once at the screen root
 */
export function useAboutUserSheet() {
  const myId = useAuth((s) => s.user?.id);
  const [openId, setOpenId] = useState<string | null>(null);

  const userQ = useQuery({
    queryKey: ['user', 'by-id', openId],
    queryFn: () => getUserById(openId as string),
    enabled: !!openId,
    staleTime: 60_000,
  });

  const openAbout = useCallback(
    (userId?: string | null) => {
      if (!userId) return;
      if (myId && userId === myId) return; // self-guard: don't open own sheet
      setOpenId(userId);
    },
    [myId],
  );

  const close = useCallback(() => setOpenId(null), []);

  const sheetUser: DiscoverCardUser | null = useMemo(
    () =>
      userQ.data
        ? {
            ...userQ.data,
            distance: null,
            distKm: null,
            sharedTags: [],
            avatarIdx: idxFor(userQ.data.id),
          }
        : null,
    [userQ.data],
  );

  // Only mount the sheet open once the full profile has loaded, so it never
  // flashes empty during the fetch (cached after the first open).
  const aboutSheet = (
    <AboutUserSheet
      open={!!openId && !!sheetUser}
      user={sheetUser}
      onClose={close}
      onLike={() => {
        const id = sheetUser?.id;
        close();
        // "想认识" records a like, same as from the Discover deck. Fire and
        // forget — the sheet already greyed the button optimistically.
        if (id) swipe(id, 'like').catch(() => {});
      }}
    />
  );

  return { openAbout, aboutSheet };
}
