import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";

/**
 * Helpers for reading the current session inside Server Components and
 * Server Actions. Centralising them means we can swap providers later
 * without touching every caller.
 */

export async function getCurrentSession() {
  return auth();
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Guard helper for Server Actions / Route Handlers.
 * Redirects unauthenticated users to /login.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}
