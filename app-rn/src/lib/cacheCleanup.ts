// Daily cache cleanup (Phase 10, CACHE1). Foreground-triggered (runs on app
// start when >24h since the last run) — no expo-background-fetch dependency.
// Prunes the local DM cache (60-day rolling) and evicts media older than 7 days.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { pruneOld } from './localChat';
import { evictOldMedia } from './mediaCache';

const KEY = 'meyou:cacheCleanup:lastRun';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Run the daily sweep if it hasn't run in the last 24h. Best-effort. */
export async function runDailyCleanupIfDue(): Promise<void> {
  try {
    const last = Number(await AsyncStorage.getItem(KEY)) || 0;
    if (Date.now() - last < DAY_MS) return;
    await AsyncStorage.setItem(KEY, String(Date.now()));
    await pruneOld();
    await evictOldMedia();
  } catch {
    // never block app start over cache maintenance
  }
}
