"use server";

import { auth, signIn, signOut } from "@/lib/auth/config";
import { invalidateUserProfile } from "@/lib/auth/user-profile";

/**
 * Server Actions for auth. Colocated so client components can bind them
 * directly to <form action={...}> without any client-side SDK.
 */

type Provider = "google" | "facebook";

function safeCallbackUrl(input: FormDataEntryValue | null): string {
  if (typeof input !== "string" || !input) return "/dashboard";
  // Only allow same-origin paths to avoid open-redirect abuse.
  if (!input.startsWith("/")) return "/dashboard";
  return input;
}

export async function signInWithProvider(provider: Provider, formData: FormData) {
  const redirectTo = safeCallbackUrl(formData.get("callbackUrl"));
  await signIn(provider, { redirectTo });
}

export async function signInWithGoogle(formData: FormData) {
  await signInWithProvider("google", formData);
}

export async function signInWithFacebook(formData: FormData) {
  await signInWithProvider("facebook", formData);
}

export async function signOutAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    // Drop the cached profile so a subsequent sign-in starts from a clean
    // Redis state (e.g. if the user updated their profile elsewhere).
    await invalidateUserProfile(userId).catch(() => {
      /* non-fatal */
    });
  }
  await signOut({ redirectTo: "/" });
}
