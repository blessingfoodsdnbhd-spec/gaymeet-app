// Local private-chat store (Phase 10, CACHE1) — expo-sqlite. A write-through
// mirror of DM messages so history survives even once the server moves to
// relay-only + 30-day retention (Phase 9). Rolling window (default 60 days,
// can be lowered to 7). All calls are best-effort and never throw — a cache
// failure must never break chat.
import * as SQLite from 'expo-sqlite';

export const DM_ROLLING_DAYS_DEFAULT = 60;

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function db(): Promise<SQLite.SQLiteDatabase | null> {
  try {
    if (!_dbPromise) {
      _dbPromise = (async () => {
        const d = await SQLite.openDatabaseAsync('meyou-chat.db');
        await d.execAsync(
          `CREATE TABLE IF NOT EXISTS dm_messages (
             id TEXT PRIMARY KEY,
             matchId TEXT NOT NULL,
             createdAt INTEGER NOT NULL,
             raw TEXT NOT NULL
           );
           CREATE INDEX IF NOT EXISTS idx_dm_match_time ON dm_messages (matchId, createdAt);`,
        );
        return d;
      })();
    }
    return await _dbPromise;
  } catch {
    _dbPromise = null;
    return null;
  }
}

export interface LocalDMMessage {
  id: string;
  createdAt: string; // ISO
  [k: string]: any;
}

/** Write-through: persist a batch of messages for a match (idempotent upsert). */
export async function saveMessages(matchId: string, messages: LocalDMMessage[]): Promise<void> {
  if (!matchId || !messages?.length) return;
  const d = await db();
  if (!d) return;
  try {
    await d.withTransactionAsync(async () => {
      for (const m of messages) {
        if (!m?.id) continue;
        const ts = Date.parse(m.createdAt || '') || Date.now();
        await d.runAsync(
          'INSERT OR REPLACE INTO dm_messages (id, matchId, createdAt, raw) VALUES (?, ?, ?, ?)',
          [String(m.id), matchId, ts, JSON.stringify(m)],
        );
      }
    });
  } catch {
    // ignore — cache write is best-effort
  }
}

/** Read cached messages for a match, newest first. */
export async function getMessages(matchId: string, limit = 50): Promise<LocalDMMessage[]> {
  const d = await db();
  if (!d) return [];
  try {
    const rows = await d.getAllAsync<{ raw: string }>(
      'SELECT raw FROM dm_messages WHERE matchId = ? ORDER BY createdAt DESC LIMIT ?',
      [matchId, limit],
    );
    return rows.map((r) => JSON.parse(r.raw)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Drop messages older than the rolling window. Returns rows removed. */
export async function pruneOld(maxAgeDays = DM_ROLLING_DAYS_DEFAULT): Promise<number> {
  const d = await db();
  if (!d) return 0;
  try {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const res = await d.runAsync('DELETE FROM dm_messages WHERE createdAt < ?', [cutoff]);
    return res.changes ?? 0;
  } catch {
    return 0;
  }
}

/** Total cached message count (for the storage settings screen). */
export async function messageCount(): Promise<number> {
  const d = await db();
  if (!d) return 0;
  try {
    const row = await d.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM dm_messages');
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Wipe the local chat cache (manual "clear" in settings). */
export async function clearAll(): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    await d.execAsync('DELETE FROM dm_messages');
  } catch {
    // ignore
  }
}
