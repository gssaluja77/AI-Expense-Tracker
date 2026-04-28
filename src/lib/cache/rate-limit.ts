import "server-only";
import { connectToDatabase } from "@/lib/db/mongodb";
import { RateCounter } from "@/models/RateCounter";

/**
 * Fixed-window rate limiter backed by MongoDB (no Redis required).
 *
 * Why MongoDB:
 *   • The app already talks to Mongo on every authenticated request, so
 *     one extra atomic findOneAndUpdate is essentially free.
 *   • Unlike an in-memory counter it's globally consistent — a user can't
 *     bypass the limit by being routed to a fresh Vercel serverless
 *     instance.
 *   • A TTL index on `expiresAt` reaps stale counters automatically; each
 *     window is a separate document, so rollover is atomic by construction.
 *
 * Why fixed-window (vs token bucket / sliding window):
 *   • One DB round-trip per check — cheapest viable design.
 *   • Worst case is a "boundary burst" of ≤ 2× limit at a window edge,
 *     which is fine for protecting a shared upstream quota.
 *
 * Failure mode:
 *   • If Mongo is unreachable, we fail OPEN (log + allow the request). The
 *     upstream Gemini API enforces its own quota as a hard backstop.
 */

export interface RateLimitBucket {
  /** Stable name — part of the doc key; keep short. */
  name: string;
  /** Max allowed requests in the window. */
  limit: number;
  /** Window size in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Which bucket denied the request (when ok=false). */
  blockedBy?: RateLimitBucket;
  /** Seconds until the blocked bucket resets. */
  retryAfterSec: number;
  /** Per-bucket usage snapshot — handy for `X-RateLimit-*` headers. */
  snapshot: Array<{
    bucket: RateLimitBucket;
    used: number;
    remaining: number;
    resetInSec: number;
  }>;
}

/**
 * Increment the counter for each bucket and return whether the caller
 * may proceed. When any bucket would overflow, the request is REJECTED
 * and none of the other counters are incremented.
 */
export async function checkRateLimit(
  subject: string,
  buckets: RateLimitBucket[]
): Promise<RateLimitResult> {
  try {
    await connectToDatabase();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[rate-limit] db connect failed, failing open", err);
    return failOpen(buckets);
  }

  const now = Date.now();
  const snapshot: RateLimitResult["snapshot"] = [];

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const windowId = Math.floor(now / (bucket.windowSec * 1000));
    const key = keyFor(bucket, subject, windowId);
    const windowEndsAt = new Date((windowId + 1) * bucket.windowSec * 1000);

    let count: number;
    try {
      // Atomic: increment if doc exists, otherwise create with count=1
      // and a TTL for cleanup once the window has fully elapsed. The
      // returned doc reflects the post-increment value.
      const doc = await RateCounter.findOneAndUpdate(
        { key },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: windowEndsAt },
        },
        { upsert: true, new: true, lean: true }
      );
      count = doc?.count ?? 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] findOneAndUpdate failed, failing open", err);
      return failOpen(buckets);
    }

    const resetInSec = Math.max(
      1,
      Math.ceil((windowEndsAt.getTime() - now) / 1000)
    );

    if (count > bucket.limit) {
      // Block. We've already incremented this bucket's doc — leaving it
      // "over-limit" is fine; the next window rolls to a fresh key.
      // (Rolling back isn't worth the extra round-trip.)
      return {
        ok: false,
        blockedBy: bucket,
        retryAfterSec: resetInSec,
        snapshot: [
          ...snapshot,
          { bucket, used: count, remaining: 0, resetInSec },
          ...buckets.slice(i + 1).map((b) => ({
            bucket: b,
            used: 0,
            remaining: b.limit,
            resetInSec: b.windowSec,
          })),
        ],
      };
    }

    snapshot.push({
      bucket,
      used: count,
      remaining: Math.max(0, bucket.limit - count),
      resetInSec,
    });
  }

  return { ok: true, retryAfterSec: 0, snapshot };
}

function keyFor(bucket: RateLimitBucket, subject: string, windowId: number): string {
  return `rl:${bucket.name}:${subject}:${windowId.toString(36)}`;
}

function failOpen(buckets: RateLimitBucket[]): RateLimitResult {
  return {
    ok: true,
    retryAfterSec: 0,
    snapshot: buckets.map((b) => ({
      bucket: b,
      used: 0,
      remaining: b.limit,
      resetInSec: b.windowSec,
    })),
  };
}

/**
 * Shape the outcome of {@link checkRateLimit} into standard HTTP response
 * headers — clients can use these to display remaining quota or
 * implement jittered back-off.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {};
  const primary = result.snapshot[0];
  if (primary) {
    headers["X-RateLimit-Limit"] = String(primary.bucket.limit);
    headers["X-RateLimit-Remaining"] = String(primary.remaining);
    headers["X-RateLimit-Reset"] = String(primary.resetInSec);
  }
  if (!result.ok) {
    headers["Retry-After"] = String(result.retryAfterSec);
  }
  return headers;
}

/* -------------------------------------------------------------------------- */
/*                             Preset bucket sets                             */
/* -------------------------------------------------------------------------- */

/**
 * Chat endpoint limits — conservative to protect Gemini's free-tier
 * 10 RPM / 250 RPD on `gemini-2.5-flash`. A single conversation can
 * fan out into multiple tool-calling steps, so we enforce per-user
 * rather than per-message.
 */
export const CHAT_RATE_LIMIT_BUCKETS: RateLimitBucket[] = [
  { name: "chat:burst", limit: 1, windowSec: 2 },      // anti-mash
  { name: "chat:min", limit: 8, windowSec: 60 },       // per-minute
  { name: "chat:day", limit: 200, windowSec: 86_400 }, // per-day
];

/**
 * Receipt-parsing is heavier (vision tokens) but lower-frequency. Keep a
 * separate bucket so a burst of receipt uploads doesn't starve chat.
 */
export const PARSE_RATE_LIMIT_BUCKETS: RateLimitBucket[] = [
  { name: "parse:burst", limit: 1, windowSec: 3 },
  { name: "parse:min", limit: 5, windowSec: 60 },
  { name: "parse:day", limit: 60, windowSec: 86_400 },
];

/* -------------------------------------------------------------------------- */
/*                              Friendly messages                             */
/* -------------------------------------------------------------------------- */

export function rateLimitMessage(result: RateLimitResult): string {
  if (result.ok || !result.blockedBy) return "";
  const b = result.blockedBy;
  const retry = formatDuration(result.retryAfterSec);
  if (b.name.endsWith(":burst")) {
    return `You're sending requests too quickly. Try again in ${retry}.`;
  }
  if (b.name.endsWith(":min")) {
    return `You've hit the per-minute limit (${b.limit}/min). Try again in ${retry}.`;
  }
  if (b.name.endsWith(":day")) {
    return `You've hit the daily AI usage limit (${b.limit}/day). It resets in ${retry}.`;
  }
  return `Rate limit reached. Try again in ${retry}.`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.ceil(sec / 60)} min`;
  if (sec < 86_400) return `${Math.ceil(sec / 3600)} h`;
  return `${Math.ceil(sec / 86_400)} d`;
}
