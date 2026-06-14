import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../store/auth';
import { getStreakStatus, type StreakStatus } from '../api/streak';
import { StreakModal } from './StreakModal';

// UTC day key — matches the server's streak day boundary.
function todayKey() {
  return `meyou:streak:seen:${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Mounts once at the App root next to AnnouncementBootstrap. On the first authed
 * arrival of a new UTC day, fetches the streak status and shows the check-in
 * celebration once. A small delay lets any AnnouncementModal settle first so the
 * two don't animate on top of each other.
 */
export function StreakBootstrap() {
  const user = useAuth((s) => s.user);
  const isAuthed = !!user;
  const [status, setStatus] = useState<StreakStatus | null>(null);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (!isAuthed || decided) return;
    let cancelled = false;
    (async () => {
      try {
        const key = todayKey();
        const seen = await AsyncStorage.getItem(key);
        if (seen) {
          setDecided(true);
          return;
        }
        const s = await getStreakStatus();
        await AsyncStorage.setItem(key, '1');
        if (!cancelled && (s?.current ?? 0) > 0) {
          // Defer so it doesn't collide with the announcement modal.
          setTimeout(() => {
            if (!cancelled) setStatus(s);
          }, 700);
        }
      } catch {
        // Non-critical — never block app start over the check-in.
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, decided]);

  if (!status) return null;
  return <StreakModal status={status} onClose={() => setStatus(null)} />;
}
