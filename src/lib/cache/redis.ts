import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client (serverless, REST-based).
 *
 * Falls back to a no-op in-memory stub when credentials are absent, so the
 * app still runs locally without Redis configured.
 */

interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: number,
    opts?: { match?: string; count?: number }
  ): Promise<[string | number, string[]]>;
}

function createStubRedis(): RedisLike {
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(
      "[redis] UPSTASH_REDIS_REST_URL not set — using in-memory stub. " +
        "Caching disabled across processes."
    );
  }
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key, value, opts) {
      const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
      store.set(key, { value, expiresAt });
      return "OK";
    },
    async del(...keys) {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n++;
      return n;
    },
    async scan(_cursor, opts) {
      const match = opts?.match;
      const keys = [...store.keys()].filter((k) => {
        if (!match) return true;
        // simple glob: only supports trailing *
        if (match.endsWith("*")) return k.startsWith(match.slice(0, -1));
        return k === match;
      });
      return [0, keys];
    },
  };
}

const upstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

export const redis: RedisLike = upstashConfigured
  ? (Redis.fromEnv() as unknown as RedisLike)
  : createStubRedis();

/**
 * When `true`, the app is running on the in-memory stub (no real Upstash
 * connection). Consumers of `withCache` can use this to bypass caching so
 * they always reflect the latest DB state — the stub lives inside a single
 * Node.js process, has no cross-request TTL observability, and can keep
 * serving stale data for up to `CACHE_TTL.DASHBOARD` seconds even after a
 * `revalidatePath`/`router.refresh()` when the underlying process held onto
 * the write-through cache across hot-reloads.
 */
export const isCacheEnabled = upstashConfigured;

/* -------------------------------------------------------------------------- */
/*                          High-level cache helpers                           */
/* -------------------------------------------------------------------------- */

/** Default TTL in seconds. */
export const CACHE_TTL = {
  DASHBOARD: 60 * 5, // 5 min
  CATEGORY_TOTALS: 60 * 10, // 10 min
  EXCHANGE_RATES: 60 * 60, // 1 h
  SESSION: 60 * 60 * 24, // 24 h
  AI_RESPONSE: 60 * 60, // 1 h
} as const;

/**
 * Namespaced cache key builder — avoids accidental collisions.
 */
export const cacheKey = {
  userProfile: (userId: string) => `user:${userId}:profile:v2`,
  dashboard: (userId: string) => `user:${userId}:dashboard`,
  categoryTotals: (userId: string, month: string) =>
    `user:${userId}:cat-totals:${month}`,
  budgets: (userId: string) => `user:${userId}:budgets`,
  subscriptions: (userId: string) => `user:${userId}:subs`,
  exchangeRate: (from: string, to: string) => `fx:${from}:${to}`,
  userScope: (userId: string) => `user:${userId}:*`,
} as const;

/**
 * Cache-aside helper. Reads from Redis; on miss, runs `fetcher`, writes the
 * result, then returns it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Without a real Redis backing store, caching does more harm than good:
  // in-memory state can outlive invalidation calls across hot-reloads and
  // cause the UI to show stale dashboards. Always go straight to the DB.
  if (!isCacheEnabled) return fetcher();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[redis] get failed", { key, err });
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, fresh as unknown, { ex: ttlSeconds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[redis] set failed", { key, err });
  }

  return fresh;
}

/**
 * Invalidate one or more cache keys.
 */
export async function invalidateCache(keys: string | string[]): Promise<void> {
  const arr = Array.isArray(keys) ? keys : [keys];
  if (!arr.length) return;
  try {
    await redis.del(...arr);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[redis] del failed", { keys: arr, err });
  }
}

/**
 * Invalidate every cached key matching a pattern (e.g. after a mutation
 * invalidate everything for the current user).
 */
export async function invalidateByPattern(pattern: string): Promise<void> {
  try {
    let cursor: string | number = 0;
    const matched: string[] = [];
    do {
      const [next, keys] = await redis.scan(Number(cursor), {
        match: pattern,
        count: 100,
      });
      cursor = next;
      matched.push(...keys);
    } while (Number(cursor) !== 0);
    if (matched.length) await redis.del(...matched);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[redis] invalidateByPattern failed", { pattern, err });
  }
}
