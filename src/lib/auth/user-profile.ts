import "server-only";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import {
  CACHE_TTL,
  cacheKey,
  invalidateCache,
  redis,
  withCache,
} from "@/lib/cache/redis";

/**
 * Redis-backed user profile hydration.
 *
 * NextAuth issues JWT-only sessions (fast, stateless), which carry just the
 * bare OAuth identity (id, email, name, image). Our app however needs each
 * request to know the user's app-specific preferences (base currency,
 * locale, time-zone, notification settings). Reading those from MongoDB on
 * every request would defeat the point of JWT sessions, so we wrap the
 * Mongo lookup in a Redis cache keyed by user id.
 *
 * Flow on every server-rendered request:
 *   1. Ask Redis for the cached profile. Hit → return immediately.
 *   2. Miss → load from Mongo (creating the `app_users` doc on first
 *      sign-in if it doesn't yet exist), then write back to Redis.
 *
 * The cache is invalidated explicitly on sign-out and whenever the user
 * updates their preferences.
 */

export interface CachedUserProfile {
  /** NextAuth session id (from the JWT). */
  id: string;
  /**
   * Mongo `_id` of the matching document in `app_users`. This is the
   * foreign key used by every user-scoped application collection
   * (transactions, budgets, subscriptions…).
   */
  appUserId: string;
  email: string;
  name: string | null;
  image: string | null;
  baseCurrency: string;
  locale: string;
  timeZone: string;
  preferences: {
    notifyOnSubscriptionDetected: boolean;
    notifyOnBudgetExceeded: boolean;
    notifyOnPredictedBill: boolean;
    aiSuggestionsEnabled: boolean;
  };
}

interface SessionIdentity {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

interface ResolvedIdentity {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/**
 * Loads (or creates) the `app_users` doc for the given identity and returns
 * a plain, cache-friendly snapshot. Results are memoised in Redis for 24 h.
 */
export async function getCachedUserProfile(
  identity: SessionIdentity
): Promise<CachedUserProfile | null> {
  const resolved = resolveIdentity(identity);
  if (!resolved) return null;

  return withCache<CachedUserProfile>(
    cacheKey.userProfile(resolved.id),
    CACHE_TTL.SESSION,
    () => loadOrCreateProfile(resolved)
  );
}

/**
 * Drop the cached profile for a user — call after profile mutations or
 * on sign-out so the next read pulls fresh data.
 */
export async function invalidateUserProfile(userId: string): Promise<void> {
  if (!userId) return;
  await invalidateCache(cacheKey.userProfile(userId));
}

/**
 * Prime the Redis cache in advance (e.g. right after first sign-in) so the
 * first dashboard load is a pure cache hit. Safe to call eagerly; failures
 * fall back to the lazy path above.
 */
export async function primeUserProfile(
  identity: SessionIdentity
): Promise<CachedUserProfile | null> {
  const resolved = resolveIdentity(identity);
  if (!resolved) return null;
  const profile = await loadOrCreateProfile(resolved);
  try {
    await redis.set(cacheKey.userProfile(profile.id), profile, {
      ex: CACHE_TTL.SESSION,
    });
  } catch {
    /* non-fatal */
  }
  return profile;
}

function resolveIdentity(
  identity: SessionIdentity
): ResolvedIdentity | null {
  if (!identity.id || !identity.email) return null;
  return {
    id: identity.id,
    email: identity.email.toLowerCase(),
    name: identity.name ?? null,
    image: identity.image ?? null,
  };
}

async function loadOrCreateProfile(
  identity: ResolvedIdentity
): Promise<CachedUserProfile> {
  await connectToDatabase();

  // Atomic upsert — safe against concurrent first-sign-in requests that would
  // otherwise both pass a findOne→null check and race to insert, creating
  // duplicate app_users documents. $setOnInsert only fires when a new doc is
  // created, so subsequent logins never overwrite the user's saved preferences.
  const doc = await User.findOneAndUpdate(
    { email: identity.email },
    {
      $setOnInsert: {
        name: identity.name ?? undefined,
        image: identity.image ?? undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    id: identity.id,
    appUserId: doc!._id.toString(),
    email: identity.email,
    name: doc!.name ?? identity.name,
    image: doc!.image ?? identity.image,
    baseCurrency: doc!.baseCurrency,
    locale: doc!.locale,
    timeZone: doc!.timeZone,
    preferences: { ...doc!.preferences },
  };
}
