/**
 * Tiny counter / list store for anti-spam rate limiting.
 *
 * Backed by Redis (ioredis) when `REDIS_URL` is set AND the module is
 * installed; otherwise falls back to a self-contained in-memory store with
 * the same async interface. The in-memory path needs no extra dependency, so
 * the "cheap & free" default works out of the box on a single instance.
 *
 * Caveats of the in-memory fallback:
 *   - counters reset on process restart (lifetime caps are best-effort)
 *   - not shared across instances (fine while we run a single Render dyno)
 * Adding `REDIS_URL` + `npm i ioredis` upgrades both transparently.
 *
 * Exposed methods mirror the Redis commands used by the middleware:
 *   incr, expire, ttl, lpush, lrange, ltrim, del.
 */

const REDIS_URL = process.env.REDIS_URL;

function makeMemoryStore() {
  const counters = new Map(); // key → { value, expireAt|null }
  const lists = new Map(); // key → { arr: string[], expireAt|null }

  const alive = (entry) => entry && (entry.expireAt == null || entry.expireAt > Date.now());

  const getCounter = (key) => {
    const e = counters.get(key);
    if (!alive(e)) {
      counters.delete(key);
      return null;
    }
    return e;
  };
  const getList = (key) => {
    const e = lists.get(key);
    if (!alive(e)) {
      lists.delete(key);
      return null;
    }
    return e;
  };

  // Opportunistic sweep so dead keys don't leak memory under churn.
  let lastSweep = 0;
  const sweep = () => {
    const now = Date.now();
    if (now - lastSweep < 60000) return;
    lastSweep = now;
    for (const [k, e] of counters) if (e.expireAt != null && e.expireAt <= now) counters.delete(k);
    for (const [k, e] of lists) if (e.expireAt != null && e.expireAt <= now) lists.delete(k);
  };

  return {
    async incr(key) {
      sweep();
      const e = getCounter(key);
      if (!e) {
        counters.set(key, { value: 1, expireAt: null });
        return 1;
      }
      e.value += 1;
      return e.value;
    },
    async expire(key, sec) {
      const e = getCounter(key);
      if (!e) return 0;
      e.expireAt = Date.now() + sec * 1000;
      return 1;
    },
    async ttl(key) {
      const e = getCounter(key);
      if (!e) return -2;
      if (e.expireAt == null) return -1;
      return Math.max(0, Math.ceil((e.expireAt - Date.now()) / 1000));
    },
    async lpush(key, val) {
      const e = getList(key) || { arr: [], expireAt: null };
      e.arr.unshift(String(val));
      lists.set(key, e);
      return e.arr.length;
    },
    async lrange(key, start, stop) {
      const e = getList(key);
      if (!e) return [];
      // Mirror Redis: negative stop counts from the end; -1 = last element.
      const end = stop < 0 ? e.arr.length + stop + 1 : stop + 1;
      return e.arr.slice(start, end);
    },
    async ltrim(key, start, stop) {
      const e = getList(key);
      if (!e) return 'OK';
      const end = stop < 0 ? e.arr.length + stop + 1 : stop + 1;
      e.arr = e.arr.slice(start, end);
      return 'OK';
    },
    async del(key) {
      counters.delete(key);
      lists.delete(key);
      return 1;
    },
  };
}

function makeStore() {
  if (REDIS_URL) {
    try {
      // Lazy require so the in-memory path needs no dependency installed.
      const Redis = require('ioredis');
      const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
      client.on('error', (e) => console.error('[rateStore] redis error:', e.message));
      console.log('[rateStore] using Redis');
      return {
        incr: (k) => client.incr(k),
        expire: (k, s) => client.expire(k, s),
        ttl: (k) => client.ttl(k),
        lpush: (k, v) => client.lpush(k, v),
        lrange: (k, a, b) => client.lrange(k, a, b),
        ltrim: (k, a, b) => client.ltrim(k, a, b),
        del: (k) => client.del(k),
      };
    } catch (e) {
      console.warn('[rateStore] REDIS_URL set but ioredis unavailable — falling back to in-memory:', e.message);
    }
  }
  console.log('[rateStore] using in-memory store');
  return makeMemoryStore();
}

module.exports = makeStore();
