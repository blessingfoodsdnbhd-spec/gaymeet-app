import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../store/auth';
import { getCurrentAnnouncement } from '../api/announcements';
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
  const [shouldShow, setShouldShow] = useState(false);
  const [decided, setDecided] = useState(false);

  const q = useQuery({
    queryKey: ['announcement', 'current'],
    queryFn: getCurrentAnnouncement,
    enabled: isAuthed,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (decided) return;
    if (!q.isSuccess) return;
    const ann = q.data;
    if (!ann) {
      setDecided(true);
      return;
    }
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(announcementDismissKey(ann.id));
        if (!flag) setShouldShow(true);
      } catch {
        // If storage read fails, default to showing — admin-managed
        // content is supposed to surface.
        setShouldShow(true);
      } finally {
        setDecided(true);
      }
    })();
  }, [decided, q.isSuccess, q.data]);

  if (!shouldShow || !q.data) return null;
  return (
    <AnnouncementModal
      id={q.data.id}
      imageUrl={q.data.imageUrl}
      ctaUrl={q.data.ctaUrl}
      onClose={() => setShouldShow(false)}
    />
  );
}
