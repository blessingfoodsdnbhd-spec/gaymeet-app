import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../store/auth';
import { getCurrentAnnouncements, type CurrentAnnouncement } from '../api/announcements';
import {
  AnnouncementModal,
  announcementDismissKey,
} from './AnnouncementModal';

/**
 * Mounts once at the App root. Watches the auth state and, the first
 * time a user is present in a given session (cold-start with cached
 * token OR fresh login), fetches the current announcement and decides
 * whether to render the modal.
 *
 *   - useQuery is enabled only when isAuthed = true. The unauthed
 *     Welcome flow never hits the network.
 *   - On query success, we check AsyncStorage for the "don't show
 *     again" flag scoped to the announcement id. If present, skip.
 *   - "shown" is a local-component flag; we deliberately don't
 *     re-render the modal on subsequent re-mounts within the same
 *     session, which keeps the spec "post-login arrival" behaviour.
 *
 * This component renders no UI when nothing is to be shown, so it can
 * safely live inside <NavigationContainer> alongside other listeners.
 */
export function AnnouncementBootstrap() {
  const user = useAuth((s) => s.user);
  const isAuthed = !!user;
  const [toShow, setToShow] = useState<CurrentAnnouncement[]>([]);
  const [decided, setDecided] = useState(false);

  const q = useQuery({
    queryKey: ['announcement', 'current'],
    queryFn: getCurrentAnnouncements,
    enabled: isAuthed,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (decided) return;
    if (!q.isSuccess) return;
    const all = q.data ?? [];
    if (!all.length) {
      setDecided(true);
      return;
    }
    (async () => {
      try {
        // Drop the ones this user has permanently dismissed.
        const flags = await AsyncStorage.multiGet(
          all.map((a) => announcementDismissKey(a.id)),
        );
        const dismissed = new Set(
          flags.filter(([, v]) => v === '1').map(([k]) => k),
        );
        setToShow(all.filter((a) => !dismissed.has(announcementDismissKey(a.id))));
      } catch {
        // If storage read fails, default to showing all — admin-managed
        // content is supposed to surface.
        setToShow(all);
      } finally {
        setDecided(true);
      }
    })();
  }, [decided, q.isSuccess, q.data]);

  if (!toShow.length) return null;
  return (
    <AnnouncementModal announcements={toShow} onClose={() => setToShow([])} />
  );
}
