import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getCachedUserProfile,
  type CachedUserProfile,
} from "@/lib/auth/user-profile";

/**
 * Helpers for reading the current session inside Server Components and
 * Server Actions. Centralising them means we can swap providers later
 * without touching every caller.
 *
 * Layering:
 *   getCurrentSession() — raw NextAuth JWT session (fast, no I/O)
 *   getCurrentUser()    — JWT session + app-specific profile hydrated
 *                          from MongoDB, cached in Redis for SESSION TTL.
 */

export async function getCurrentSession() {
  return auth();
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns the hydrated user (JWT identity merged with cached Mongo profile)
 * or `null` when the viewer is unauthenticated.
 */
export async function getCurrentUser(): Promise<CachedUserProfile | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getCachedUserProfile({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });
}

/**
 * Guard helper for Server Components / Server Actions / Route Handlers.
 * Redirects unauthenticated users to /login and returns the hydrated user.
 */
export async function requireUser(): Promise<CachedUserProfile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
